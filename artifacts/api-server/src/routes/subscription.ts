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
};

const PLAN_PRICES_USD_CENTS: Record<string, number> = {
  starter: 1900,
  pro: 4999,
  business: 9900,
  agency: 14900,
  enterprise: 19900,
};

const UserQuerySchema = z.object({ userId: z.string().min(1) });

const VerifyPaymentSchema = z.object({
  userId: z.string().min(1),
  reference: z.string().min(1),
  planKey: z.enum(["starter", "pro", "business", "agency", "enterprise"]),
});

async function getOrCreateSubscription(userId: string) {
  const db = requireSupabase();

  const { data, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    const { data: newRow, error: insertErr } = await db
      .from("subscriptions")
      .insert({ user_id: userId, plan: "free", scans_used: 0, period_start: new Date().toISOString() })
      .select()
      .single();
    if (insertErr) throw insertErr;
    return newRow as Record<string, unknown>;
  }

  const row = data as Record<string, unknown>;
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
    return resetRow as Record<string, unknown>;
  }

  return row;
}

router.get("/subscription", async (req, res) => {
  const parse = UserQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const row = await getOrCreateSubscription(parse.data.userId);
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

router.post("/subscription/verify-payment", async (req, res) => {
  const parse = VerifyPaymentSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request", details: parse.error.message });
  }

  const { userId, reference, planKey } = parse.data;
  const secretKey = process.env["PAYSTACK_SECRET_KEY"];

  if (!secretKey) {
    req.log.warn("PAYSTACK_SECRET_KEY not configured — skipping verification, trusting frontend");
    const db = requireSupabase();
    await db
      .from("subscriptions")
      .upsert({
        user_id: userId,
        plan: planKey,
        scans_used: 0,
        period_start: new Date().toISOString(),
        paystack_reference: reference,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    return res.json({ success: true, plan: planKey, message: "Plan updated (unverified)" });
  }

  try {
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

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

    const db = requireSupabase();
    await db
      .from("subscriptions")
      .upsert({
        user_id: userId,
        plan: planKey,
        scans_used: 0,
        period_start: new Date().toISOString(),
        paystack_reference: reference,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    return res.json({ success: true, plan: planKey });
  } catch (err) {
    req.log.error({ err }, "Payment verification failed");
    return res.status(500).json({ error: "Payment verification failed" });
  }
});

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
          .upsert({
            user_id: userId,
            plan: planKey,
            scans_used: 0,
            period_start: new Date().toISOString(),
            paystack_reference: reference,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
      } catch (err) {
        req.log.error({ err }, "Failed to update subscription from webhook");
      }
    }
  }

  return res.sendStatus(200);
});

export default router;
