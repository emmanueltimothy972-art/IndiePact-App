export type Feature =
  | "UPLOADS"
  | "EXPORTS"
  | "AI_ATTORNEY"
  | "CLAUSE_ARMORY"
  | "NEGOTIATION"
  | "PAYMENT_LOCK"
  | "LEGAL_STRATEGY"
  | "TEAM_WORKSPACE";

const FEATURE_PLANS: Record<Feature, Set<string>> = {
  UPLOADS:        new Set(["starter", "pro", "business", "agency", "enterprise", "pay_per_scan"]),
  EXPORTS:        new Set(["starter", "pro", "business", "agency", "enterprise", "pay_per_scan"]),
  AI_ATTORNEY:    new Set(["pro", "business", "agency", "enterprise", "pay_per_scan"]),
  CLAUSE_ARMORY:  new Set(["pro", "business", "agency", "enterprise", "pay_per_scan"]),
  NEGOTIATION:    new Set(["pro", "business", "agency", "enterprise", "pay_per_scan"]),
  PAYMENT_LOCK:   new Set(["pro", "business", "agency", "enterprise", "pay_per_scan"]),
  LEGAL_STRATEGY: new Set(["business", "agency", "enterprise", "pay_per_scan"]),
  TEAM_WORKSPACE: new Set(["agency", "enterprise"]),
};

export function hasFeature(plan: string, feature: Feature): boolean {
  return FEATURE_PLANS[feature].has(plan.toLowerCase());
}
