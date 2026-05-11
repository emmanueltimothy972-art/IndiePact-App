/**
 * Builds the absolute redirect URL for OAuth / magic-link flows.
 *
 * Priority:
 *  1. VITE_SITE_URL env var — set this on Vercel / any production host so that
 *     Supabase always receives the canonical production URL regardless of which
 *     machine or proxy the browser is hitting.
 *  2. window.location.origin — correct for Replit preview, mobile browsers, and
 *     any environment where no explicit override is configured.
 *
 * Never uses a hard-coded localhost value.
 */
export function buildAuthRedirectUrl(): string {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

  // Explicit canonical URL configured at build/deploy time (e.g. Vercel).
  const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  const origin = siteUrl || window.location.origin;

  return `${origin}${base}/auth/callback`;
}
