export const DEMO_USER_ID = "d41ce8b9-22a5-4a5b-bd0c-0e8fe3ae7adf";

export const IS_PRO = false;

export const PLAN_LIMITS: Record<string, number> = {
  free: 2,
  starter: 10,
  pro: 50,
  business: 100,
  agency: 300,
  enterprise: 500,
};

export const PLAN_PRICES_CENTS: Record<string, number> = {
  starter: 1900,
  pro: 4999,
  business: 9900,
  agency: 14900,
  enterprise: 19900,
};

export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  agency: "Agency",
  enterprise: "Enterprise",
};
