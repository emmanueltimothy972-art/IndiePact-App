import { requireSupabase } from "./supabase.js";

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SCAN_LIMITS: Record<string, number> = {
  free: 2,
  starter: 10,
  pro: 50,
  business: 100,
  agency: 300,
  enterprise: 500,
  pay_per_scan: 1,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScanGateResult {
  allowed: boolean;
  plan: string;
  scansUsed: number;
  scansLimit: number;
  remaining: number;
  reason?: string;
}

// ─── Gate check ───────────────────────────────────────────────────────────────

/**
 * Check whether a user is allowed to run a new scan.
 *
 * - Reads scan counts from `profiles` (authoritative per the product spec).
 * - Cross-references `subscriptions.period_start` to auto-reset the counter
 *   when a new 30-day billing period begins.
 * - Returns a clean result shape so the caller only needs to check `.allowed`.
 */
export async function checkScanGate(userId: string): Promise<ScanGateResult> {
  const db = requireSupabase();

  const [profileResult, subResult] = await Promise.allSettled([
    db
      .from("profiles")
      .select("subscription_tier, monthly_scan_limit, scans_used")
      .eq("id", userId)
      .single(),
    db
      .from("subscriptions")
      .select("plan, period_start")
      .eq("user_id", userId)
      .single(),
  ]);

  const profile =
    profileResult.status === "fulfilled" && !profileResult.value.error
      ? (profileResult.value.data as Record<string, unknown>)
      : null;

  const sub =
    subResult.status === "fulfilled" && !subResult.value.error
      ? (subResult.value.data as Record<string, unknown>)
      : null;

  // Resolve effective plan (subscriptions table is authoritative for the plan,
  // profiles.subscription_tier is a denormalised copy used as fallback).
  const subPlan = ((sub?.["plan"] as string) ?? "free").toLowerCase();
  const profileTier = ((profile?.["subscription_tier"] as string) ?? "free").toLowerCase();
  const plan = subPlan !== "free" ? subPlan : profileTier;

  const scansLimit =
    Number(profile?.["monthly_scan_limit"]) || DEFAULT_SCAN_LIMITS[plan] || 2;

  let scansUsed = Number(profile?.["scans_used"] ?? 0);

  // ── Monthly reset ──────────────────────────────────────────────────────────
  // When the 30-day billing period has expired, reset the profile scan counter
  // so the user starts fresh without manual intervention.
  if (sub?.["period_start"]) {
    const periodStart = new Date(sub["period_start"] as string);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (periodStart < thirtyDaysAgo) {
      await db.from("profiles").update({ scans_used: 0 }).eq("id", userId);
      scansUsed = 0;
    }
  }

  const remaining = Math.max(0, scansLimit - scansUsed);

  if (scansUsed >= scansLimit) {
    const reason =
      plan === "free"
        ? "Free plan scan limit reached. Upgrade to continue."
        : `You've used all ${scansLimit} scans for this billing period. Upgrade to continue.`;

    return { allowed: false, plan, scansUsed, scansLimit, remaining: 0, reason };
  }

  return { allowed: true, plan, scansUsed, scansLimit, remaining };
}

// ─── Increment ────────────────────────────────────────────────────────────────

/**
 * Increment scan usage after a successful AI analysis.
 *
 * Writes to BOTH `profiles.scans_used` (the backend enforcement source) and
 * `subscriptions.scans_used` (the frontend display source) so the frontend
 * `refreshSubscription()` call always reflects the current count without
 * requiring a second source of truth.
 *
 * Non-fatal: a failure here should never fail the scan response — log and move on.
 */
export async function incrementScanUsage(userId: string): Promise<void> {
  const db = requireSupabase();

  const [profileResult, subResult] = await Promise.allSettled([
    db.from("profiles").select("scans_used").eq("id", userId).single(),
    db.from("subscriptions").select("scans_used").eq("user_id", userId).single(),
  ]);

  const profileUsed =
    profileResult.status === "fulfilled" && profileResult.value.data
      ? Number(
          (profileResult.value.data as Record<string, unknown>)["scans_used"] ?? 0,
        )
      : 0;

  const subUsed =
    subResult.status === "fulfilled" && subResult.value.data
      ? Number(
          (subResult.value.data as Record<string, unknown>)["scans_used"] ?? 0,
        )
      : 0;

  await Promise.allSettled([
    db
      .from("profiles")
      .update({ scans_used: profileUsed + 1 })
      .eq("id", userId),
    db
      .from("subscriptions")
      .update({
        scans_used: subUsed + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId),
  ]);
}
