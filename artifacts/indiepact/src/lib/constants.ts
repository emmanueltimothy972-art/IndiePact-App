export const DEMO_USER_ID = "d41ce8b9-22a5-4a5b-bd0c-0e8fe3ae7adf";

// ─── Plan helpers ─────────────────────────────────────────────────────────────

/** Plans that unlock paid negotiation scripts and Path to Victory */
export const PAID_PLANS = new Set(["starter", "pro", "business", "agency", "enterprise", "pay_per_scan"]);

/** Plans that include PDF/report export */
export const EXPORT_PLANS = new Set(["pro", "business", "agency", "enterprise", "pay_per_scan"]);

export function isPaidPlan(plan: string): boolean {
  return PAID_PLANS.has(plan);
}

export function canExport(plan: string): boolean {
  return EXPORT_PLANS.has(plan);
}

// ─── Plan limits (scans per month) ───────────────────────────────────────────

export const PLAN_LIMITS: Record<string, number> = {
  free: 2,
  pay_per_scan: 1,
  starter: 10,
  pro: 50,
  business: 100,
  agency: 300,
  enterprise: 500,
};

// ─── Prices in cents ──────────────────────────────────────────────────────────

export const PLAN_PRICES_CENTS: Record<string, number> = {
  pay_per_scan: 999,   // $9.99 one-time
  starter: 1900,       // $19/mo
  pro: 4999,           // $49.99/mo
  business: 9900,      // $99/mo
  agency: 14900,       // $149/mo
  enterprise: 19900,   // $199/mo
};

// ─── Display names ────────────────────────────────────────────────────────────

export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: "Free",
  pay_per_scan: "Pay-Per-Scan",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  agency: "Agency",
  enterprise: "Enterprise",
};

// ─── Legacy — DO NOT USE in new code ─────────────────────────────────────────
// Kept only so old import sites compile while being migrated.
// Use isPaidPlan(userPlan) from AuthContext instead.
export const IS_PRO = false;
