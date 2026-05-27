import { Router } from "express";
import { z } from "zod";
import { requireSupabase } from "../lib/supabase.js";

const router = Router();

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
// Used to resolve conflicts between subscriptions.plan and profiles.subscription_tier.
// Higher index = higher tier. The column authoritative for plan resolution is
// whichever table reports the higher rank.

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

const UserQuerySchema = z.object({ userId: z.string().min(1) });

const VerifyPaymentSchema = z.object({
  userId: z.string().min(1),
  reference: z.string().min(1),
  planKey: z.enum(["starter", "pro", "business", "agency", "enterprise"]),
});

// ─── getOrCreateSubscription ──────────────────────────────────────────────────
// Single source of truth for plan resolution.
//
// Resolution order:
//   1. Read subscriptions.plan  (payment gateway writes here)
//   2. Read profiles.subscription_tier  (admin/manual writes here)
//   3. Resolve effective plan = whichever is the higher tier
//   4. If profiles is higher, write it back to subscriptions so they stay in sync
//   5. Return the effective plan with scan counts from subscriptions

async function getOrCreateSubscription(userId: string, log?: { info: (obj: object, msg: string) => void }) {
  const db = requireSupabase();

  // ── Fetch subscriptions row ────────────────────────────────────────────────
  const { data: subData, error: subError } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (subError && subError.code !== "PGRST116") throw subError;

  // ── Fetch profiles row for cross-reference ────────────────────────────────
  const { data: profileData } = await db
    .from("profiles")
    .select("subscription_tier, subscription_plan, subscription_status, scans_used, monthly_scan_limit")
    .eq("id", userId)
    .single();

  const profileTier = ((profileData as Record<string, unknown> | null)?.["subscription_tier"] as string ?? "free").toLowerCase();

  // ── Create subscriptions row if missing ───────────────────────────────────
  let row: Record<string, unknown>;

  if (!subData) {
    const effectivePlan = profileTier !== "free" ? profileTier : "free";
    const { data: newRow, error: insertErr } = await db
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan: effectivePlan,
        scans_used: 0,
        period_start: new Date().toISOString(),
      })
      .select()
      .single();
    if (insertErr) throw insertErr;
    row = newRow as Record<string, unknown>;
  } else {
    row = subData as Record<string, unknown>;
  }

  // ── Resolve effective plan ────────────────────────────────────────────────
  const subPlan = ((row["plan"] as string) ?? "free").toLowerCase();
  const effectivePlan = higherTier(subPlan, profileTier);

  // ── Sync subscriptions if profiles is authoritative for a higher tier ─────
  // This handles admin manual edits to profiles without a matching subscriptions update.
  if (effectivePlan !== subPlan) {
    const { error: syncErr } = await db
      .from("subscriptions")
      .update({
        plan: effectivePlan,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (syncErr) {
      // Non-fatal — log and continue with the resolved plan anyway
      log?.info({ userId, syncErr, event: "subscription_sync_failed" }, "Failed to sync subscriptions from profiles");
    } else {
      log?.info(
        { userId, subPlan, profileTier, effectivePlan, event: "subscription_synced_from_profile" },
        "subscriptions.plan synced up from profiles.subscription_tier",
      );
      row["plan"] = effectivePlan;
    }
  }

  // ── Monthly reset ─────────────────────────────────────────────────────────
  const periodStart = new Date(row["period_start"] as string);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (periodStart < thirtyDaysAgo) {
    const { data: resetRow, error: resetErr } = await db
      .from("subscriptions")
      .update({
        scans_used: 0,
        period_start: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();
    if (resetErr) throw resetErr;
    row = resetRow as Record<string, unknown>;
    row["plan"] = effectivePlan;
  }

  log?.info(
    {
      userId,
      subPlan,
      profileTier,
      effectivePlan,
      scansUsed: row["scans_used"],
      event: "subscription_resolved",
    },
    `Plan resolved → ${effectivePlan}`,
  );

  return { ...row, plan: effectivePlan };
}

// ─── GET /subscription ────────────────────────────────────────────────────────

router.get("/subscription", async (req, res) => {
  const parse = UserQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const row = await getOrCreateSubscription(parse.data.userId, req.log);
    const plan = (row["plan"] as string) ?? "free";
    const scansUsed = Number(row["scans_used"]) || 0;
    const scansLimit = PLAN_LIMITS[plan] ?? 2;

    return res.json({
      plan,
      scansUsed,
      scansLimit,
      periodStart: row["period_start"],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get subscription");
    return res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// ─── POST /subscription/verify-payment ────────────────────────────────────────

router.post("/subscription/verify-payment", async (req, res) => {
  const parse = VerifyPaymentSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { userId, reference, planKey } = parse.data;
  const secretKey = process.env["PAYSTACK_SECRET_KEY"];

  const db = requireSupabase();

  if (!secretKey) {
    req.log.warn("PAYSTACK_SECRET_KEY not configured — skipping verification, trusting frontend");

    await db
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan: planKey,
          scans_used: 0,
          period_start: new Date().toISOString(),
          paystack_reference: reference,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    // Keep profiles in sync
    await db
      .from("profiles")
      .update({
        subscription_tier: planKey,
        subscription_plan: planKey,
        subscription_status: "active",
        monthly_scan_limit: PLAN_LIMITS[planKey] ?? 2,
      })
      .eq("id", userId);

    return res.json({ success: true, plan: planKey, message: "Plan updated (unverified)" });
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
      data: { status: string; amount: number; currency: string; metadata?: Record<string, unknown> };
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

    await db
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan: planKey,
          scans_used: 0,
          period_start: new Date().toISOString(),
          paystack_reference: reference,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    // Keep profiles in sync with confirmed payment
    await db
      .from("profiles")
      .update({
        subscription_tier: planKey,
        subscription_plan: planKey,
        subscription_status: "active",
        monthly_scan_limit: PLAN_LIMITS[planKey] ?? 2,
      })
      .eq("id", userId);

    req.log.info({ userId, planKey, event: "payment_verified" }, "Payment verified — plan upgraded");
    return res.json({ success: true, plan: planKey });
  } catch (err) {
    req.log.error({ err }, "Payment verification failed");
    return res.status(500).json({ error: "Payment verification failed" });
  }
});

// ─── POST /paystack/webhook ───────────────────────────────────────────────────

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
        const db = requireSupabase();

        await db
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              plan: planKey,
              scans_used: 0,
              period_start: new Date().toISOString(),
              paystack_reference: reference,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );

        // Keep profiles in sync with webhook-confirmed payment
        await db
          .from("profiles")
          .update({
            subscription_tier: planKey,
            subscription_plan: planKey,
            subscription_status: "active",
            monthly_scan_limit: PLAN_LIMITS[planKey] ?? 2,
          })
          .eq("id", userId);
      } catch (err) {
        req.log.error({ err }, "Failed to update subscription from webhook");
      }
    }
  }

  return res.sendStatus(200);
});

export default router;
