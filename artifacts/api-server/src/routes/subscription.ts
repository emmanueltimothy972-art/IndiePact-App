import { Router } from "express";
import { z } from "zod";
import { requireSupabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

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

const PLAN_PRICES_USD_CENTS: Record<string, number> = {
  starter: 1900,
  pro: 4999,
  business: 9900,
  agency: 14900,
  enterprise: 19900,
};

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

const VerifyPaymentSchema = z.object({
  reference: z.string().min(1),
  planKey: z.enum(["starter", "pro", "business", "agency", "enterprise"]),
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

router.get("/subscription", requireAuth, async (req, res) => {
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

router.post("/subscription/verify-payment", requireAuth, async (req, res) => {
  const parse = VerifyPaymentSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const userId = req.userId!;
  const { reference, planKey } = parse.data;
  const secretKey = process.env["PAYSTACK_SECRET_KEY"];
  const db = requireSupabase();

  if (!secretKey) {
    req.log.error({ userId, event: "paystack_secret_missing" }, "PAYSTACK_SECRET_KEY is not configured — refusing to upgrade plan without verified payment");
    return res.status(503).json({ error: "Payment verification is unavailable. Please try again later or contact support." });
  }

  try {
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );

    if (!verifyRes.ok) {
      return res.status(400).json({ error: "Paystack verification request failed" });
    }

    const verifyData = (await verifyRes.json()) as {
      status: boolean;
      data: { status: string; amount: number };
    };

    if (!verifyData.status || verifyData.data.status !== "success") {
      return res.status(400).json({ error: "Payment was not successful" });
    }

    const paidCents = verifyData.data.amount;
    const expectedCents = PLAN_PRICES_USD_CENTS[planKey];
    if (expectedCents && paidCents < expectedCents) {
      req.log.warn({ paidCents, expectedCents, planKey }, "Payment amount mismatch");
      return res.status(400).json({ error: "Payment amount does not match plan price" });
    }

    await persistPlan(userId, planKey, req.log as ReqLog);
    await db.from("subscriptions").update({ paystack_reference: reference }).eq("user_id", userId);

    req.log.info({ userId, planKey, event: "payment_verified" }, "Payment verified — plan upgraded");
    return res.json({ success: true, plan: planKey });
  } catch (err) {
    req.log.error({ err }, "Payment verification failed");
    return res.status(500).json({ error: "Payment verification failed" });
  }
});

// ─── POST /paystack/webhook ───────────────────────────────────────────────────
// NOTE: This route intentionally has no requireAuth — it is called by Paystack
// servers, not by authenticated users. It is protected by HMAC signature verification.

router.post("/paystack/webhook", async (req, res) => {
  const secret = process.env["PAYSTACK_SECRET_KEY"];
  if (secret) {
    const { createHmac } = await import("crypto");
    const hash = createHmac("sha512", secret).update(JSON.stringify(req.body)).digest("hex");
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    if (hash !== signature) {
      return res.status(400).json({ error: "Invalid signature" });
    }
  }

  const event = req.body as { event: string; data: Record<string, unknown> };

  if (event.event === "charge.success") {
    const metadata = (event.data["metadata"] as Record<string, unknown>) ?? {};
    const userId = metadata["userId"] as string | undefined;
    const planKey = metadata["planKey"] as string | undefined;
    const reference = event.data["reference"] as string | undefined;

    if (userId && planKey && PLAN_PRICES_USD_CENTS[planKey] !== undefined) {
      try {
        await persistPlan(userId, planKey, req.log as ReqLog);
        const db = requireSupabase();
        await db.from("subscriptions").update({ paystack_reference: reference }).eq("user_id", userId);
      } catch (err) {
        req.log.error({ err }, "Failed to update subscription from webhook");
      }
    }
  }

  return res.sendStatus(200);
});

export default router;
