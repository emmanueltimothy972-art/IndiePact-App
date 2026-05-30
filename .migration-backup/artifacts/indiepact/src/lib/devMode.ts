/**
 * DEV AUTH BYPASS
 *
 * Activates ONLY when BOTH conditions are true:
 *   1. Vite is in development mode  (import.meta.env.DEV === true)
 *      — In production builds Vite hard-codes this to `false` at compile
 *        time, so the bypass is structurally impossible in production.
 *   2. VITE_DEV_AUTH_BYPASS=true is present in .env.development
 *
 * To turn off: delete .env.development or set VITE_DEV_AUTH_BYPASS=false.
 */
export const DEV_AUTH_BYPASS: boolean =
  import.meta.env.DEV === true &&
  import.meta.env.VITE_DEV_AUTH_BYPASS === "true";

export const DEV_MOCK_USER = {
  id: "dev-preview-00000000-0000-0000-0000-000000000000",
  email: "dev@indiepact.local",
  plan: "pro",
  scansUsed: 3,
  scansLimit: 100,
} as const;
