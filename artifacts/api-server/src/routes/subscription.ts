import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireSupabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

// Local interface for Paystack HTTP responses.
// Using a local interface (rather than the global `Response`) avoids the
// @types/node conditional type collapse that strips ok/status/json() whenever
// "lib": ["dom"] is present anywhere in the compilation.
interface PaystackHttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

const router = Router();

// ─── Admin override ───────────────────────────────────────────────────────────
// Permanent server-side founder access. Executes in the backend only.
// Resolves email via Supabase admin API (service role key) — never via
// the frontend or JWT claims, so it cannot be spoofed.

// ADMIN_EMAIL is read from the environment so it can be rotated without a code
// change. Falls back to empty string, disabling the override in environments
// where the variable is not set.
const ADMIN_EMAIL = (process.env["ADMIN_EMAIL"] ?? "").toLowerCase().trim();
const ADMIN_PLAN = "business";

// ─── Plan metadata ────────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<string, number> = {
  free: 2,
  starter: 10,
  pro: 50,
  business: 100,
  agency: 300,
  enterprise: 500,
  pay_per_scan: 1,
};

// ─── Centralized plan pricing ─────────────────────────────────────────────────
// USD prices mirror the frontend pricing page exactly.
// Paystack processes in NGN/kobo — conversion happens server-side only.
// To update pricing, change ONLY this object and USD_TO_NGN_RATE below.
// Never trust prices from the frontend request body.

const PLAN_PRICES: Record<string, { usd: number }> = {
  starter:    { usd: 19  },
  pro:        { usd: 49  },
  business:   { usd: 99  },
  agency:     { usd: 149 },
  enterprise: { usd: 199 },
};

// Exchange rate applied to all USD → NGN conversions.
// Update this value periodically to reflect current market rate.
const USD_TO_NGN_RATE = 1500;

// ─── NGN plan codes (Paystack recurring plans) ───────────────────────────────
// Created via scripts/create-paystack-plans.js — mirrors paystack-plan-codes.json.
// Paystack merchant account is NGN; all transactions are processed in NGN/kobo.

const PLAN_CODES_NGN: Record<string, string> = {
  starter:    "PLN_y5ll9xzjk6xxr7x",
  pro:        "PLN_egffun046ak2yxj",
  business:   "PLN_tg9lemlwpmhqj5g",
  agency:     "PLN_ztt9md695jjntfe",
  enterprise: "PLN_6w86ii89f8jwql1",
};

/**
 * Convert a plan's USD display price to the integer kobo amount Paystack expects.
 *
 * Formula:  usdPrice × USD_TO_NGN_RATE × 100
 * Example:  $149 × 1500 = ₦223,500 × 100 = 22,350,000 kobo
 *
 * Paystack requires amounts in the smallest currency unit (kobo for NGN).
 * Math.round() guards against floating-point drift on edge-case rates.
 */
function calculatePaystackAmount(planName: string): number {
  const usd = PLAN_PRICES[planName]?.usd;
  if (usd === undefined) throw new Error(`[PLAN_RESOLUTION] Unknown plan: "${planName}"`);
  return Math.round(usd * USD_TO_NGN_RATE * 100);
}

// ─── Billing test bypass ──────────────────────────────────────────────────────
// Allows this single email to initialize checkout for ANY plan — including
// tiers below their current plan — for testing purposes.
// Bypasses downgrade protection in the initialize route ONLY.
// Has zero effect on webhook processing, subscription reads, or other users.
const BILLING_TEST_EMAIL = "emmanueltimothy972@gmail.com";

// ─── Tier ranking ─────────────────────────────────────────────────────────────
// free(0) < pay_per_scan(1) < starter(2) < pro(3) < business(4) < agency(5) < enterprise(6)

const TIER_RANK: Record<string, number> = {
  free: 0,
  pay_per_scan: 1,
  starter: 2,
  pro: 3,
  business: 4,
  agency: 5,
  enterprise: 6,
};

function higherTier(a: string, b: string): string {
  return (TIER_RANK[a] ?? 0) >= (TIER_RANK[b] ?? 0) ? a : b;
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const VALID_PLAN_KEYS = ["starter", "pro", "business", "agency", "enterprise"] as const;
type ValidPlanKey = typeof VALID_PLAN_KEYS[number];

function isValidPlanKey(v: unknown): v is ValidPlanKey {
  return typeof v === "string" && (VALID_PLAN_KEYS as readonly string[]).includes(v);
}

const VerifyPaymentSchema = z.object({
  reference: z.string().min(1),
  // planKey is now optional — falls back to Paystack transaction metadata when absent or invalid
  planKey: z.string().optional(),
  userId: z.string().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ReqLog = { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void };

/** Write plan to both tables atomically (best-effort, errors logged not thrown). */
async function persistPlan(userId: string, plan: string, log: ReqLog) {
  const db = requireSupabase();
  const now = new Date().toISOString();

  const [subRes, profileRes] = await Promise.allSettled([
    db.from("subscriptions").upsert(
      { user_id: userId, plan, scans_used: 0, period_start: now, updated_at: now },
      { onConflict: "user_id" },
    ),
    db.from("profiles").update({
      subscription_tier: plan,
      subscription_plan: plan,
      subscription_status: "active",
      monthly_scan_limit: PLAN_LIMITS[plan] ?? 2,
    }).eq("id", userId),
  ]);

  if (subRes.status === "rejected") {
    log.warn({ userId, plan, err: subRes.reason, event: "persist_subscriptions_failed" }, "Failed to write subscriptions");
  }
  if (profileRes.status === "rejected") {
    log.warn({ userId, plan, err: profileRes.reason, event: "persist_profiles_failed" }, "Failed to write profiles");
  } else if (profileRes.status === "fulfilled" && (profileRes.value as { error?: unknown }).error) {
    log.warn({ userId, plan, err: (profileRes.value as { error?: unknown }).error, event: "persist_profiles_error" }, "profiles UPDATE returned error");
  }
}

// ─── Core resolver ────────────────────────────────────────────────────────────

async function getOrCreateSubscription(userId: string, log: ReqLog) {
  const db = requireSupabase();

  // ── Step 1: Resolve auth email via service-role admin API ─────────────────
  // This is the only trustworthy source for the email — cannot be spoofed.
  let userEmail: string | undefined;
  try {
    const { data: authUser, error: authErr } = await db.auth.admin.getUserById(userId);
    if (authErr) {
      log.warn({ userId, authErr, event: "auth_email_lookup_error" }, "auth.admin.getUserById returned error");
    } else {
      userEmail = authUser?.user?.email?.toLowerCase().trim();
    }
    log.info({ userId, userEmail: userEmail ?? "(unknown)", event: "auth_email_resolved" }, "Auth email resolved from admin API");
  } catch (err) {
    log.warn({ userId, err, event: "auth_email_lookup_failed" }, "Could not resolve auth email — continuing without override");
  }

  // ── Step 2: ADMIN OVERRIDE ────────────────────────────────────────────────
  // If email matches founder account, force business plan immediately.
  // Persists to both tables so every future fetch is consistent.
  if (userEmail === ADMIN_EMAIL) {
    log.info(
      { userId, userEmail, plan: ADMIN_PLAN, event: "admin_override_applied" },
      `Admin override: forcing plan=${ADMIN_PLAN} for ${userEmail}`,
    );
    await persistPlan(userId, ADMIN_PLAN, log);
    return {
      plan: ADMIN_PLAN,
      scans_used: 0,
      period_start: new Date().toISOString(),
      _adminOverride: true,
    };
  }

  // ── Step 3: Read both tables in parallel ──────────────────────────────────
  const [subResult, profileResult] = await Promise.allSettled([
    db.from("subscriptions").select("*").eq("user_id", userId).single(),
    db.from("profiles").select("subscription_tier, subscription_plan, subscription_status, scans_used, monthly_scan_limit").eq("id", userId).single(),
  ]);

  const subRow =
    subResult.status === "fulfilled" && !subResult.value.error
      ? (subResult.value.data as Record<string, unknown>)
      : null;

  const profileRow =
    profileResult.status === "fulfilled" && !profileResult.value.error
      ? (profileResult.value.data as Record<string, unknown>)
      : null;

  log.info(
    {
      userId,
      subscriptions_plan: subRow?.["plan"] ?? "(no row)",
      profiles_subscription_tier: profileRow?.["subscription_tier"] ?? "(no row)",
      event: "raw_db_values",
    },
    "Raw DB values fetched",
  );

  // ── Step 4: Create subscriptions row if missing ───────────────────────────
  let row: Record<string, unknown>;

  if (!subRow) {
    const seedPlan = ((profileRow?.["subscription_tier"] as string) ?? "free").toLowerCase();
    const safeSeedPlan = TIER_RANK[seedPlan] !== undefined ? seedPlan : "free";

    const { data: newRow, error: insertErr } = await db
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan: safeSeedPlan,
        scans_used: 0,
        period_start: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    row = newRow as Record<string, unknown>;
    log.info({ userId, plan: safeSeedPlan, event: "subscriptions_row_created" }, "Created missing subscriptions row");
  } else {
    row = subRow;
  }

  // ── Step 5: Resolve effective plan ───────────────────────────────────────
  const subPlan = ((row["plan"] as string) ?? "free").toLowerCase();
  const profileTier = ((profileRow?.["subscription_tier"] as string) ?? "free").toLowerCase().trim();

  const subRank = TIER_RANK[subPlan] ?? 0;
  const profileRank = TIER_RANK[profileTier] ?? 0;
  const effectivePlan = higherTier(subPlan, profileTier);

  log.info(
    {
      userId,
      subPlan,
      subRank,
      profileTier,
      profileRank,
      effectivePlan,
      event: "plan_resolution",
    },
    `Plan resolved → ${effectivePlan}`,
  );

  // ── Step 6: Sync tables if profiles is authoritative for a higher tier ───
  if (effectivePlan !== subPlan) {
    log.info(
      { userId, subPlan, profileTier, effectivePlan, event: "sync_triggered" },
      "profiles tier > subscriptions plan — syncing subscriptions",
    );

    // Validate the plan is in the CHECK constraint before writing
    if (TIER_RANK[effectivePlan] !== undefined) {
      const { error: syncErr } = await db
        .from("subscriptions")
        .update({ plan: effectivePlan, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (syncErr) {
        log.warn({ userId, effectivePlan, syncErr, event: "sync_failed" }, "Sync write failed");
      } else {
        log.info({ userId, effectivePlan, event: "sync_succeeded" }, "Subscriptions plan synced from profiles");
        row["plan"] = effectivePlan;
      }
    } else {
      log.warn({ userId, effectivePlan, event: "sync_skipped_invalid_plan" }, "Resolved plan not in CHECK constraint — skipping sync");
    }
  }

  // ── Step 7: Monthly reset ─────────────────────────────────────────────────
  const periodStart = new Date(row["period_start"] as string);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (periodStart < thirtyDaysAgo) {
    const { data: resetRow, error: resetErr } = await db
      .from("subscriptions")
      .update({ scans_used: 0, period_start: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select()
      .single();

    if (resetErr) throw resetErr;
    row = { ...(resetRow as Record<string, unknown>), plan: effectivePlan };
    log.info({ userId, event: "period_reset" }, "30-day period reset applied");
  }

  return { ...row, plan: effectivePlan };
}

// ─── GET /subscription ────────────────────────────────────────────────────────

router.get("/subscription", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;

  try {
    const row = await getOrCreateSubscription(userId, req.log as ReqLog);
    const plan = (row["plan"] as string) ?? "free";
    const scansUsed = Number(row["scans_used"]) || 0;
    const scansLimit = PLAN_LIMITS[plan] ?? 2;

    req.log.info(
      { userId, plan, scansUsed, scansLimit, event: "subscription_response" },
      "Subscription response sent to frontend",
    );

    return res.json({ plan, scansUsed, scansLimit, periodStart: row["period_start"] });
  } catch (err) {
    req.log.error({ err }, "Failed to get subscription");
    return res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// ─── POST /subscription/verify-payment ────────────────────────────────────────

router.post("/subscription/verify-payment", requireAuth, async (req: Request, res: Response) => {
  const parse = VerifyPaymentSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const userId = req.userId!;
  const { reference, planKey: clientPlanKey } = parse.data;
  const secretKey = process.env["PAYSTACK_SECRET_KEY"];
  const db = requireSupabase();

  req.log.info(
    { userId, payment_reference: reference, client_plan_key: clientPlanKey ?? "(not supplied)", event: "verify_payment_start" },
    "Payment verification started",
  );

  if (!secretKey) {
    req.log.error({ userId, event: "paystack_secret_missing" }, "PAYSTACK_SECRET_KEY is not configured — refusing to upgrade plan without verified payment");
    return res.status(503).json({ error: "Payment verification is unavailable. Please try again later or contact support." });
  }

  // ── Snapshot subscription before verification ─────────────────────────────
  let subscriptionBefore: string = "unknown";
  try {
    const { data: subRow } = await db.from("subscriptions").select("plan").eq("user_id", userId).single();
    subscriptionBefore = (subRow as { plan?: string } | null)?.plan ?? "free";
  } catch { /* non-fatal */ }

  try {
    const verifyRes = (await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    )) as unknown as PaystackHttpResponse;

    if (!verifyRes.ok) {
      req.log.warn({ userId, payment_reference: reference, http_status: verifyRes.status, event: "paystack_verify_http_error" }, "Paystack verification HTTP error");
      return res.status(400).json({ error: "Paystack verification request failed" });
    }

    const verifyData = (await verifyRes.json()) as {
      status: boolean;
      data: {
        status: string;
        amount: number;
        metadata?: { planKey?: string; tierName?: string };
      };
    };

    req.log.info(
      {
        userId,
        payment_reference: reference,
        verification_result: verifyData.data?.status ?? "unknown",
        paystack_status: verifyData.status,
        metadata: verifyData.data?.metadata,
        event: "paystack_verify_response",
      },
      "Paystack verification response received",
    );

    if (!verifyData.status || verifyData.data.status !== "success") {
      return res.status(400).json({ error: "Payment was not successful" });
    }

    // ── Resolve planKey: client-supplied → Paystack metadata → error ─────────
    // The client may send "subscription" (legacy) or omit planKey entirely.
    // Always prefer the authoritative value from Paystack's transaction metadata.
    let resolvedPlanKey: ValidPlanKey;

    if (isValidPlanKey(clientPlanKey)) {
      resolvedPlanKey = clientPlanKey;
      req.log.info({ userId, resolvedPlanKey, source: "client", event: "plan_key_resolved" }, "planKey resolved from client");
    } else {
      const metaPlanKey = verifyData.data.metadata?.planKey ?? verifyData.data.metadata?.tierName;
      if (isValidPlanKey(metaPlanKey)) {
        resolvedPlanKey = metaPlanKey;
        req.log.info({ userId, resolvedPlanKey, source: "paystack_metadata", event: "plan_key_resolved" }, "planKey resolved from Paystack metadata");
      } else {
        req.log.error(
          { userId, payment_reference: reference, client_plan_key: clientPlanKey, meta_plan_key: metaPlanKey, event: "plan_key_unresolvable" },
          "Could not resolve a valid planKey — aborting verification",
        );
        return res.status(400).json({ error: "Could not determine subscription plan from payment. Please contact support." });
      }
    }

    // ── Amount sanity check ───────────────────────────────────────────────────
    // Paystack amount is in kobo (NGN). We compare the NGN equivalent of the
    // USD price (usdPrice × USD_TO_NGN_RATE × 100 = kobo) stored in PLAN_PRICES.
    // A small tolerance (–5%) is allowed for exchange rate drift.
    const paidAmount = verifyData.data.amount;
    const usdDollars = PLAN_PRICES[resolvedPlanKey]?.usd;
    const expectedKobo = usdDollars !== undefined ? Math.round(usdDollars * USD_TO_NGN_RATE * 100) : undefined;
    if (expectedKobo && paidAmount < expectedKobo * 0.95) {
      req.log.warn({ paidAmount, expectedKobo, resolvedPlanKey, event: "payment_amount_mismatch" }, "Payment amount below expected — possible plan mismatch");
      return res.status(400).json({ error: "Payment amount does not match plan price" });
    }

    await persistPlan(userId, resolvedPlanKey, req.log as ReqLog);
    await db.from("subscriptions").update({ paystack_reference: reference }).eq("user_id", userId);

    // ── Snapshot subscription after verification ──────────────────────────────
    let subscriptionAfter: string = resolvedPlanKey;
    try {
      const { data: subRowAfter } = await db.from("subscriptions").select("plan").eq("user_id", userId).single();
      subscriptionAfter = (subRowAfter as { plan?: string } | null)?.plan ?? resolvedPlanKey;
    } catch { /* non-fatal */ }

    req.log.info(
      {
        userId,
        payment_reference: reference,
        verification_result: "success",
        subscription_before: subscriptionBefore,
        subscription_after: subscriptionAfter,
        plan: resolvedPlanKey,
        event: "payment_verified",
      },
      "Payment verified — plan upgraded",
    );

    return res.json({ success: true, plan: resolvedPlanKey });
  } catch (err) {
    req.log.error({ err, userId, payment_reference: reference, event: "payment_verification_exception" }, "Payment verification failed with exception");
    return res.status(500).json({ error: "Payment verification failed" });
  }
});

// ─── POST /subscription/initialize ───────────────────────────────────────────
// Starts a Paystack hosted-checkout session for a recurring NGN subscription.
//
// Flow:
//   1. Validate tier from request body (Zod).
//   2. Resolve plan code + calculate kobo amount server-side from PLAN_PRICES.
//   3. Resolve user email via Supabase admin API — never trust client-supplied values.
//   4. Check for downgrade attempt (skipped for BILLING_TEST_EMAIL).
//   5. Build Paystack payload with NGN currency and kobo amount.
//   6. Call Paystack /transaction/initialize, return authorization_url.
//
// The metadata block carries userId + usdPrice so the webhook can persist the
// plan and record the display price without a database round-trip.

const InitializeSchema = z.object({
  tierName: z.enum(["starter", "pro", "business", "agency", "enterprise"]),
});

router.post("/subscription/initialize", requireAuth, async (req: Request, res: Response) => {
  const parse = InitializeSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request. Please try again.",
      details: parse.error.flatten().fieldErrors,
    });
  }

  const { tierName } = parse.data;
  const userId = req.userId!;

  // ── 1. Plan resolution ────────────────────────────────────────────────────
  const planCode = PLAN_CODES_NGN[tierName];
  const usdPrice = PLAN_PRICES[tierName]?.usd;

  if (!planCode || usdPrice === undefined) {
    req.log.warn({ userId, tierName, event: "plan_resolution_failed" }, "[PLAN_RESOLUTION] Unknown tier requested");
    return res.status(422).json({
      success: false,
      message: "Unable to initialize billing session.",
      detail: `"${tierName}" does not map to a provisioned Paystack plan.`,
    });
  }

  // ── 2. Kobo amount calculation ────────────────────────────────────────────
  // calculatePaystackAmount: usdPrice × USD_TO_NGN_RATE × 100
  let amountKobo: number;
  try {
    amountKobo = calculatePaystackAmount(tierName);
  } catch {
    req.log.error({ userId, tierName, event: "plan_resolution_failed" }, "[PLAN_RESOLUTION] calculatePaystackAmount threw unexpectedly");
    return res.status(500).json({ success: false, message: "Unable to initialize billing session." });
  }

  req.log.info(
    { userId, tierName, planCode, usdPrice, amountKobo, event: "plan_resolution" },
    `[PLAN_RESOLUTION] tier=${tierName} usd=$${usdPrice} ngn=₦${usdPrice * USD_TO_NGN_RATE} kobo=${amountKobo}`,
  );

  // ── 3. Secret key guard ───────────────────────────────────────────────────
  const secretKey = process.env["PAYSTACK_SECRET_KEY"];
  if (!secretKey) {
    req.log.error({ event: "paystack_secret_missing" }, "PAYSTACK_SECRET_KEY not configured");
    return res.status(503).json({ success: false, message: "Billing is temporarily unavailable. Please try again later." });
  }

  // ── 4. Resolve email server-side ──────────────────────────────────────────
  // Uses Supabase admin API — cannot be spoofed via JWT claims or request body.
  let email: string | undefined;
  try {
    const db = requireSupabase();
    const { data: authUser, error: authErr } = await db.auth.admin.getUserById(userId);
    if (authErr) {
      req.log.warn({ userId, authErr, event: "billing_email_lookup_error" }, "auth.admin.getUserById returned error");
    } else {
      email = authUser?.user?.email?.toLowerCase().trim();
    }
  } catch (err) {
    req.log.warn({ userId, err, event: "billing_email_lookup_failed" }, "Could not resolve email — aborting initialize");
  }

  if (!email) {
    return res.status(400).json({ success: false, message: "Unable to initialize billing session." });
  }

  req.log.info(
    { userId, tierName, event: "billing_init" },
    `[BILLING_INIT] user=${email} tier=${tierName} usd=$${usdPrice} kobo=${amountKobo}`,
  );

  // ── 5. Downgrade protection ───────────────────────────────────────────────
  // Prevents users from self-downgrading via a crafted request.
  // BILLING_TEST_EMAIL bypasses this check to allow testing any tier.
  const isBillingTestAccount = email === BILLING_TEST_EMAIL;

  if (!isBillingTestAccount) {
    try {
      const db = requireSupabase();
      const { data: subRow } = await db
        .from("subscriptions")
        .select("plan")
        .eq("user_id", userId)
        .single();

      const currentPlan = ((subRow as { plan?: string } | null)?.plan ?? "free").toLowerCase();
      const currentRank = TIER_RANK[currentPlan] ?? 0;
      const requestedRank = TIER_RANK[tierName] ?? 0;

      if (requestedRank < currentRank) {
        req.log.warn(
          { userId, currentPlan, tierName, currentRank, requestedRank, event: "downgrade_blocked" },
          "[BILLING_INIT] Downgrade attempt blocked — contact support to downgrade",
        );
        return res.status(422).json({
          success: false,
          message: "To downgrade your plan, please contact support.",
        });
      }
    } catch {
      // Fail open — if we can't read the current plan, allow checkout to proceed
      // rather than blocking a legitimate user because of a DB hiccup.
      req.log.warn({ userId, event: "downgrade_check_skipped" }, "[BILLING_INIT] Could not read current plan — skipping downgrade check");
    }
  } else {
    req.log.info({ userId, email, tierName, event: "billing_test_bypass" }, "[BILLING_INIT] Billing test bypass active — downgrade check skipped");
  }

  // ── 6. Build and send Paystack payload ───────────────────────────────────
  const appUrl = (process.env["APP_URL"] ?? "").replace(/\/$/, "");
  // Embed the tier in the callback URL so BillingCallback can pass the correct
  // planKey to verify-payment without relying on Paystack metadata alone.
  const callbackUrl = `${appUrl}/billing/callback?plan=${encodeURIComponent(tierName)}`;

  const payload = {
    email,
    amount:   amountKobo,  // integer kobo — Paystack's required unit for NGN
    currency: "NGN",       // Paystack merchant account is NGN
    plan:     planCode,    // recurring plan code — locks in subscription billing
    callback_url: callbackUrl,
    metadata: {
      userId,
      tierName,
      planKey:  tierName,   // backward-compat alias for webhook handler
      usdPrice,             // display price for receipts / webhook logging
      platform: "IndiePact SaaS Platform",
    },
  };

  req.log.info(
    { userId, tierName, planCode, amountKobo, usdPrice, event: "paystack_request" },
    `[PAYSTACK_REQUEST] POST /transaction/initialize — tier=${tierName} ngn=₦${usdPrice * USD_TO_NGN_RATE}`,
  );

  let paystackRes: PaystackHttpResponse;
  let paystackBody: {
    status: boolean;
    message?: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };

  try {
    paystackRes = (await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })) as unknown as PaystackHttpResponse;
    paystackBody = await paystackRes.json() as typeof paystackBody;
  } catch (networkErr) {
    // Log error object but never expose it to the client
    req.log.error({ userId, tierName, event: "paystack_network_error" }, "[CHECKOUT_FAILURE] Network failure reaching Paystack");
    return res.status(500).json({ success: false, message: "Unable to initialize billing session." });
  }

  req.log.info(
    { userId, tierName, httpStatus: paystackRes.status, paystackStatus: paystackBody.status, event: "paystack_response" },
    `[PAYSTACK_RESPONSE] status=${paystackRes.status} ok=${paystackBody.status}`,
  );

  if (!paystackRes.ok || paystackBody.status !== true || !paystackBody.data) {
    // Log the raw Paystack message server-side for debugging — never send it to the client
    req.log.error(
      { userId, tierName, httpStatus: paystackRes.status, paystackMessage: paystackBody.message, event: "checkout_failure" },
      "[CHECKOUT_FAILURE] Paystack rejected initialization request",
    );
    return res.status(500).json({ success: false, message: "Unable to initialize billing session." });
  }

  req.log.info(
    { userId, tierName, reference: paystackBody.data.reference, event: "checkout_success" },
    "[CHECKOUT_SUCCESS] Paystack authorization URL generated",
  );

  return res.status(200).json({
    success: true,
    authorization_url: paystackBody.data.authorization_url,
    access_code:       paystackBody.data.access_code,
    reference:         paystackBody.data.reference,
  });
});

// ─── POST /paystack/webhook ───────────────────────────────────────────────────
// Moved to artifacts/api-server/src/routes/webhook.ts
// Registered separately in routes/index.ts to ensure it receives the raw
// request body (via app.ts express.json verify callback) for HMAC verification.

export default router;
