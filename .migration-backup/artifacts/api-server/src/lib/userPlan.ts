import { requireSupabase } from "./supabase.js";

export interface UserPlanInfo {
  plan: string;
  scansUsed: number;
  scansLimit: number;
  periodExpired: boolean;
}

export const PLAN_SCAN_LIMITS: Record<string, number> = {
  free: 2,
  pay_per_scan: 1,
  starter: 10,
  pro: 50,
  business: 100,
  agency: 300,
  enterprise: 500,
};

export const FEATURE_PLANS: Record<string, Set<string>> = {
  UPLOADS:        new Set(["starter", "pro", "business", "agency", "enterprise", "pay_per_scan"]),
  EXPORTS:        new Set(["starter", "pro", "business", "agency", "enterprise", "pay_per_scan"]),
  AI_ATTORNEY:    new Set(["pro", "business", "agency", "enterprise", "pay_per_scan"]),
  CLAUSE_ARMORY:  new Set(["pro", "business", "agency", "enterprise", "pay_per_scan"]),
  NEGOTIATION:    new Set(["pro", "business", "agency", "enterprise", "pay_per_scan"]),
  PAYMENT_LOCK:   new Set(["pro", "business", "agency", "enterprise", "pay_per_scan"]),
  LEGAL_STRATEGY: new Set(["business", "agency", "enterprise", "pay_per_scan"]),
  TEAM_WORKSPACE: new Set(["agency", "enterprise"]),
};

export function hasBackendFeature(
  plan: string,
  feature: keyof typeof FEATURE_PLANS,
): boolean {
  return FEATURE_PLANS[feature]?.has(plan.toLowerCase()) ?? false;
}

export async function getUserPlan(userId: string): Promise<UserPlanInfo> {
  const db = requireSupabase();

  const { data, error } = await db
    .from("subscriptions")
    .select("plan, scans_used, period_start")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return { plan: "free", scansUsed: 0, scansLimit: 2, periodExpired: false };
  }

  const row = data as Record<string, unknown>;
  const plan = ((row["plan"] as string) ?? "free").toLowerCase();
  const scansUsed = Number(row["scans_used"]) || 0;
  const scansLimit = PLAN_SCAN_LIMITS[plan] ?? 2;

  const periodStart = new Date((row["period_start"] as string) || 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const periodExpired = periodStart < thirtyDaysAgo;

  return {
    plan,
    scansUsed: periodExpired ? 0 : scansUsed,
    scansLimit,
    periodExpired,
  };
}
