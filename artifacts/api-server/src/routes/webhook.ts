/**
 * artifacts/api-server/src/routes/webhook.ts
 *
 * Paystack webhook ingestion pipeline — the authoritative billing lifecycle
 * processor for IndiePact subscriptions.
 *
 * Security model:
 *   1. HMAC SHA-512 over the raw request body (not re-serialised JSON).
 *   2. Invalid signatures are rejected with 401 before any data is read.
 *   3. Duplicate events are skipped via the webhook_events idempotency table.
 *   4. All DB writes use the service-role Supabase client (requireSupabase).
 *
 * Event support:
 *   ✓ charge.success       — first payment / recurring rebill
 *   ✓ subscription.create  — Paystack subscription object created
 *   ✓ subscription.disable — subscription cancelled / disabled
 *   ✓ subscription.not_renew — upcoming non-renewal notice
 *   ✓ invoice.payment_failed — failed rebill attempt
 *   ○ Everything else      — acknowledged (200) and ignored
 *
 * Future-proofing:
 *   • To add a new event: add a case to the switch and a handler function.
 *   • To migrate to USD: update PLAN_CODE_TO_TIER with new plan codes only.
 *   • To add multi-instance idempotency: webhook_events table already persists
 *     processed references — no in-memory state is relied upon.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { Router, type Request, type Response } from "express";
import { requireSupabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── Plan code → tier name (centralised reverse map) ─────────────────────────
// Mirror of PLAN_CODES_USD in subscription.ts.
// This handler is currency-agnostic: it maps plan codes → tier names regardless
// of whether the transaction was in USD or NGN. Currency is never inspected.
//
// ACTION REQUIRED: Once USD plans are created in the Paystack dashboard and
// PLAN_CODES_USD in subscription.ts is updated, add the new USD plan codes here
// to mirror the change. Both maps must stay in sync.

const PLAN_CODE_TO_TIER: Record<string, string> = {
  PLN_y5ll9xzjk6xxr7x: "starter",   // TODO: add USD plan code alongside or replace
  PLN_egffun046ak2yxj: "pro",        // TODO: add USD plan code alongside or replace
  PLN_tg9lemlwpmhqj5g: "business",   // TODO: add USD plan code alongside or replace
  PLN_ztt9md695jjntfe: "agency",     // TODO: add USD plan code alongside or replace
  PLN_6w86ii89f8jwql1: "enterprise", // TODO: add USD plan code alongside or replace
};

const PLAN_LIMITS: Record<string, number> = {
  free: 2, starter: 10, pro: 50, business: 100, agency: 300, enterprise: 500,
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaystackCustomer {
  email?: string;
  customer_code?: string;
}

interface PaystackPlan {
  plan_code?: string;
  name?: string;
}

interface PaystackAuthorization {
  authorization_code?: string;
}

interface PaystackEventData {
  reference?: string;
  subscription_code?: string;
  status?: string;
  amount?: number;
  currency?: string;
  paid_at?: string;
  next_payment_date?: string;
  customer?: PaystackCustomer;
  plan?: PaystackPlan;
  plan_object?: PaystackPlan;
  authorization?: PaystackAuthorization;
  metadata?: Record<string, unknown>;
}

interface PaystackWebhookEvent {
  event: string;
  data: PaystackEventData;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the Supabase userId for a webhook event.
 *
 * Priority:
 *   1. metadata.userId — set by us during checkout initialisation.
 *   2. Customer email lookup via auth.admin.listUsers() — fallback for events
 *      where metadata was not propagated by Paystack.
 */
async function resolveUserId(
  metadata: Record<string, unknown> | undefined,
  email: string | undefined,
): Promise<string | null> {
  // Primary: metadata.userId is always set by our checkout initialization.
  // This path is taken for 100% of our own transactions.
  const metaUserId = metadata?.["userId"] as string | undefined;
  if (metaUserId && metaUserId.trim()) return metaUserId.trim();

  // Fallback: look up by customer email (for manually-created Paystack orders
  // or events where metadata was not propagated).
  // Uses paginated listUsers to handle arbitrarily large user bases.
  if (!email) return null;

  try {
    const db = requireSupabase();
    const normalizedEmail = email.toLowerCase();
    let page = 1;
    const perPage = 1000;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage });
      if (error || !data) return null;

      const match = data.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail,
      );
      if (match) return match.id;

      // If the page returned fewer rows than requested, we've seen all users.
      if (data.users.length < perPage) return null;
      page++;
    }
  } catch {
    return null;
  }
}

/**
 * Upsert the user's subscription row and profile tier.
 * All fields that may be absent are left untouched if undefined.
 */
async function syncSubscription(
  userId: string,
  tier: string,
  fields: {
    reference?: string;
    subscriptionCode?: string;
    authorizationCode?: string;
    paidAt?: string;
    nextPaymentDate?: string;
    status?: string;
  },
): Promise<void> {
  const db = requireSupabase();
  const now = new Date().toISOString();
  const status = fields.status ?? "active";

  const subRow: Record<string, unknown> = {
    user_id: userId,
    plan: tier,
    subscription_status: status,
    period_start: fields.paidAt ?? now,
    updated_at: now,
  };

  if (status === "active") subRow["scans_used"] = 0; // reset on new billing period
  if (fields.reference)          subRow["paystack_reference"]          = fields.reference;
  if (fields.subscriptionCode)   subRow["subscription_code"]           = fields.subscriptionCode;
  if (fields.authorizationCode)  subRow["paystack_authorization_code"] = fields.authorizationCode;
  if (fields.paidAt)             subRow["last_payment_at"]             = fields.paidAt;
  if (fields.nextPaymentDate)    subRow["next_payment_date"]           = fields.nextPaymentDate;

  const [subResult, profileResult] = await Promise.allSettled([
    db.from("subscriptions").upsert(subRow, { onConflict: "user_id" }),
    db.from("profiles").update({
      subscription_tier: tier,
      subscription_plan: tier,
      subscription_status: status,
      monthly_scan_limit: PLAN_LIMITS[tier] ?? 2,
      updated_at: now,
    }).eq("id", userId),
  ]);

  if (subResult.status === "rejected") {
    logger.warn({ userId, tier, err: subResult.reason }, "[WEBHOOK_SYNC_FAILED] subscriptions upsert failed");
    throw subResult.reason;
  }
  if (profileResult.status === "rejected") {
    // Non-fatal — subscription row is the source of truth for billing
    logger.warn({ userId, tier, err: profileResult.reason }, "[WEBHOOK_SYNC_FAILED] profiles update failed (non-fatal)");
  }
}

/**
 * Mark an event as processed for idempotency.
 * Uses the webhook_events table (see supabase-schema.sql).
 * Returns false if the event was already processed (duplicate).
 * Returns true if successfully recorded as new.
 * On table-not-found or other DB error: returns true (allow processing,
 * prefer false-negatives over false-positives in billing).
 */
async function markEventProcessed(
  eventType: string,
  idempotencyKey: string,
): Promise<boolean> {
  try {
    const db = requireSupabase();
    const { error } = await db.from("webhook_events").insert({
      event_type: eventType,
      idempotency_key: idempotencyKey,
    });

    if (error) {
      // Postgres unique_violation code — genuine duplicate
      if (error.code === "23505") return false;
      // Table missing or other infra error — allow processing with a warning
      logger.warn({ eventType, idempotencyKey, err: error }, "[WEBHOOK] webhook_events table unavailable — skipping idempotency check");
      return true;
    }
    return true;
  } catch {
    return true; // Fail open — process the event
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleChargeSuccess(data: PaystackEventData): Promise<void> {
  const email        = data.customer?.email;
  const planCode     = data.plan?.plan_code ?? data.plan_object?.plan_code;
  const reference    = data.reference;
  const metadata     = data.metadata;
  const paidAt       = data.paid_at;
  const authCode     = data.authorization?.authorization_code;

  const tier = planCode ? PLAN_CODE_TO_TIER[planCode] : undefined;
  if (!tier) {
    logger.info({ planCode }, "[WEBHOOK_IGNORED] charge.success: unrecognised plan_code — not an IndiePact subscription charge");
    return;
  }

  const userId = await resolveUserId(metadata, email);
  if (!userId) {
    logger.warn({ email, planCode, reference }, "[WEBHOOK_SYNC_FAILED] charge.success: could not resolve userId — skipping sync");
    return;
  }

  await syncSubscription(userId, tier, {
    reference,
    authorizationCode: authCode,
    paidAt,
    status: "active",
  });

  logger.info({ userId, tier, reference, event: "charge.success" }, "[WEBHOOK_SYNC_SUCCESS] Subscription activated/renewed");
}

async function handleSubscriptionCreate(data: PaystackEventData): Promise<void> {
  const email            = data.customer?.email;
  const planCode         = data.plan?.plan_code;
  const subscriptionCode = data.subscription_code;
  const authCode         = data.authorization?.authorization_code;
  const nextPaymentDate  = data.next_payment_date;
  const metadata         = data.metadata;

  const tier = planCode ? PLAN_CODE_TO_TIER[planCode] : undefined;
  if (!tier) {
    logger.info({ planCode }, "[WEBHOOK_IGNORED] subscription.create: unrecognised plan_code");
    return;
  }

  const userId = await resolveUserId(metadata, email);
  if (!userId) {
    logger.warn({ email, planCode, subscriptionCode }, "[WEBHOOK_SYNC_FAILED] subscription.create: could not resolve userId — skipping sync");
    return;
  }

  await syncSubscription(userId, tier, {
    subscriptionCode,
    authorizationCode: authCode,
    nextPaymentDate,
    status: "active",
  });

  logger.info({ userId, tier, subscriptionCode, event: "subscription.create" }, "[WEBHOOK_SYNC_SUCCESS] Subscription created");
}

async function handleSubscriptionDisable(data: PaystackEventData): Promise<void> {
  const email            = data.customer?.email;
  const subscriptionCode = data.subscription_code;
  const metadata         = data.metadata;

  const userId = await resolveUserId(metadata, email);
  if (!userId) {
    logger.warn({ email, subscriptionCode }, "[WEBHOOK_SYNC_FAILED] subscription.disable: could not resolve userId");
    return;
  }

  const db = requireSupabase();
  const now = new Date().toISOString();

  await Promise.allSettled([
    db.from("subscriptions").update({
      subscription_status: "disabled",
      updated_at: now,
    }).eq("user_id", userId),
    db.from("profiles").update({
      subscription_status: "disabled",
      updated_at: now,
    }).eq("id", userId),
  ]);

  logger.info({ userId, subscriptionCode, event: "subscription.disable" }, "[WEBHOOK_SYNC_SUCCESS] Subscription disabled");
}

async function handleInvoicePaymentFailed(data: PaystackEventData): Promise<void> {
  const email            = data.customer?.email;
  const subscriptionCode = data.subscription_code;
  const metadata         = data.metadata;

  const userId = await resolveUserId(metadata, email);
  if (!userId) {
    logger.warn({ email, subscriptionCode }, "[WEBHOOK_SYNC_FAILED] invoice.payment_failed: could not resolve userId");
    return;
  }

  const db = requireSupabase();
  const now = new Date().toISOString();

  await db.from("subscriptions").update({
    subscription_status: "payment_failed",
    updated_at: now,
  }).eq("user_id", userId);

  logger.warn({ userId, subscriptionCode, event: "invoice.payment_failed" }, "[WEBHOOK_SYNC_SUCCESS] Payment failure recorded");
}

// ─── Webhook route ────────────────────────────────────────────────────────────
// No requireAuth — called by Paystack servers, not authenticated users.
// Protected by HMAC SHA-512 signature verification over the raw request body.

router.post("/paystack/webhook", async (req: Request, res: Response) => {
  const secret    = process.env["PAYSTACK_SECRET_KEY"];
  const rawBody   = req.rawBody;
  const signature = req.headers["x-paystack-signature"] as string | undefined;

  // ── 1. HMAC signature verification ────────────────────────────────────────
  // Must use the raw body bytes — not JSON.stringify(req.body) — to avoid
  // whitespace/ordering differences that break the signature comparison.

  if (!secret) {
    logger.error({ event: "webhook_no_secret" }, "[WEBHOOK] PAYSTACK_SECRET_KEY not configured — rejecting all webhook calls");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  if (!rawBody || !signature) {
    logger.warn({ hasRawBody: !!rawBody, hasSignature: !!signature }, "[WEBHOOK] Missing raw body or signature header");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const expectedHash = createHmac("sha512", secret).update(rawBody).digest("hex");

  // timingSafeEqual prevents timing-based signature oracle attacks.
  let signatureValid = false;
  try {
    signatureValid = timingSafeEqual(
      Buffer.from(expectedHash, "hex"),
      Buffer.from(signature,   "hex"),
    );
  } catch {
    signatureValid = false; // Length mismatch — definitely invalid
  }

  if (!signatureValid) {
    logger.warn({ event: "webhook_bad_signature" }, "[WEBHOOK] Invalid Paystack signature — rejecting");
    return res.status(401).json({ error: "Unauthorized" });
  }

  logger.info({ event: "webhook_signature_valid" }, "[WEBHOOK_SIGNATURE_VALID]");

  // ── 2. Parse event ────────────────────────────────────────────────────────
  const webhook = req.body as PaystackWebhookEvent;
  const eventType = webhook?.event ?? "unknown";
  const data      = webhook?.data ?? {};

  // ── 3. Build idempotency key ──────────────────────────────────────────────
  // Key = event type + the most specific unique identifier available.
  // This prevents duplicate processing when Paystack retries delivery.
  const idempotencyRef =
    data.reference ??
    data.subscription_code ??
    JSON.stringify({ email: data.customer?.email, plan: data.plan?.plan_code, ts: data.paid_at });

  const idempotencyKey = `${eventType}:${idempotencyRef}`;

  logger.info({ eventType, idempotencyKey }, "[WEBHOOK_RECEIVED]");

  // ── 4. Idempotency check ──────────────────────────────────────────────────
  const isNew = await markEventProcessed(eventType, idempotencyKey);
  if (!isNew) {
    logger.info({ eventType, idempotencyKey }, "[WEBHOOK_DUPLICATE] Already processed — skipping");
    return res.sendStatus(200);
  }

  // ── 5. Route by event type ────────────────────────────────────────────────
  try {
    switch (eventType) {
      case "charge.success":
        await handleChargeSuccess(data);
        break;

      case "subscription.create":
        await handleSubscriptionCreate(data);
        break;

      case "subscription.disable":
        await handleSubscriptionDisable(data);
        break;

      case "subscription.not_renew":
        // Paystack sends this before the final billing period expires.
        // Current behaviour: log only. Future: send cancellation email,
        // update UI banner, trigger retention flow.
        logger.info({ subscriptionCode: data.subscription_code, event: eventType }, "[WEBHOOK_IGNORED] subscription.not_renew — acknowledged");
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(data);
        break;

      default:
        logger.info({ eventType }, "[WEBHOOK_IGNORED] Unhandled event type — acknowledged");
    }
  } catch (err) {
    // Log the error but still return 200 to prevent Paystack infinite retries.
    // The idempotency record was already written, so on retry we'd skip anyway.
    logger.error({ eventType, idempotencyKey, err }, "[WEBHOOK_SYNC_FAILED] Unhandled error during event processing");
  }

  // ── 6. Acknowledge ────────────────────────────────────────────────────────
  // Paystack expects a 200 within 30 seconds. Always return quickly.
  return res.sendStatus(200);
});

export default router;
