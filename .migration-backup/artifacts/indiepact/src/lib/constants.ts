import { hasFeature } from "./permissions";

export { hasFeature } from "./permissions";
export type { Feature } from "./permissions";

export const DEMO_USER_ID = "d41ce8b9-22a5-4a5b-bd0c-0e8fe3ae7adf";

// ─── Tier order ───────────────────────────────────────────────────────────────
// free < starter < pro < business < agency < enterprise
// pay_per_scan is treated as business-level for feature access.

// ─── Feature permission sets (kept for reference / legacy use) ────────────────

/** Any paid plan — unlocks PDF uploads, exports, scan history, improved AI summaries */
export const PAID_PLANS = new Set(["starter", "pro", "business", "agency", "enterprise", "pay_per_scan"]);

// ─── Permission helpers (delegate to hasFeature) ─────────────────────────────

export function isPaidPlan(plan: string): boolean {
  return PAID_PLANS.has(plan.toLowerCase());
}

export function canUploadFiles(plan: string): boolean {
  return hasFeature(plan, "UPLOADS");
}

export function canExport(plan: string): boolean {
  return hasFeature(plan, "EXPORTS");
}

export function canAccessAIAttorney(plan: string): boolean {
  return hasFeature(plan, "AI_ATTORNEY");
}

export function canAccessClauseArmory(plan: string): boolean {
  return hasFeature(plan, "CLAUSE_ARMORY");
}

export function canAccessNegotiation(plan: string): boolean {
  return hasFeature(plan, "NEGOTIATION");
}

export function canAccessPaymentLock(plan: string): boolean {
  return hasFeature(plan, "PAYMENT_LOCK");
}

export function canAccessLegalStrategy(plan: string): boolean {
  return hasFeature(plan, "LEGAL_STRATEGY");
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
  pay_per_scan: 999,    // $9.99 one-time
  starter: 1900,        // $19/mo
  pro: 4900,            // $49/mo
  business: 9900,       // $99/mo
  agency: 14900,        // $149/mo
  enterprise: 19900,    // $199/mo
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

// ─── Minimum plan label for upgrade copy ─────────────────────────────────────

export const PLAN_UPGRADE_FROM: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

// ─── Legacy — DO NOT USE in new code ─────────────────────────────────────────
export const IS_PRO = false;
