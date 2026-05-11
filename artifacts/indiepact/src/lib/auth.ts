/**
 * Auth configuration helpers.
 *
 * Email delivery architecture
 * ───────────────────────────
 * Currently: Supabase default email delivery (zero-config, works immediately).
 *
 * Future (zero code-change required):
 *  - Switch to Resend, Postmark, or any SMTP provider by configuring it
 *    in the Supabase dashboard under Auth › SMTP Settings.
 *  - Point auth@indiepact.pro as the From address in the same settings.
 *  - Customise the OTP email template in Supabase Auth › Email Templates.
 *
 * Session persistence
 * ───────────────────
 * Sessions are persisted to localStorage under the key "indiepact_auth"
 * and automatically refreshed by the Supabase client. No additional
 * configuration is needed.
 */

/**
 * Returns the canonical base URL for this environment.
 * Used when building absolute URLs for any future redirect-based flows
 * (e.g. email confirmation links, password reset, magic-link fallback).
 */
export function getAppBaseUrl(): string {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  const origin = siteUrl || window.location.origin;
  return `${origin}${base}`;
}

/**
 * Builds an absolute redirect URL for any email-link-based flows.
 * OTP (6-digit code) flows do NOT use this — they verify inline.
 */
export function buildAuthRedirectUrl(path = "/auth/callback"): string {
  return `${getAppBaseUrl()}${path}`;
}
