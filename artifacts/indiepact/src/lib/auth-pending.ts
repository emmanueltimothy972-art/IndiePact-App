/**
 * auth-pending — persistent auth flow state (localStorage + TTL)
 *
 * WHY localStorage instead of sessionStorage?
 *   sessionStorage is wiped by iOS Safari when it evicts a backgrounded tab
 *   from memory. When the user switches to their email app to get the OTP code
 *   and then switches back, Safari may cold-restart the tab — losing all
 *   sessionStorage. localStorage survives this, so the OTP flow is restored.
 *
 * TTL (30 min) matches Supabase's OTP validity window. Stale entries are
 * pruned on read so they never accumulate.
 */

// ─── OTP pending ──────────────────────────────────────────────────────────────

export const OTP_PENDING_KEY = "ip_auth_pending";

const OTP_TTL_MS = 30 * 60 * 1000; // 30 minutes — matches Supabase OTP validity

export interface PendingAuth {
  email: string;
  sentAt: number;
}

export function saveOtpPending(email: string): void {
  try {
    const entry: PendingAuth = { email, sentAt: Date.now() };
    localStorage.setItem(OTP_PENDING_KEY, JSON.stringify(entry));
    console.log("[OTP] Pending state saved to localStorage", { email });
  } catch {}
}

export function loadOtpPending(): PendingAuth | null {
  try {
    const raw = localStorage.getItem(OTP_PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PendingAuth;
    const ageMs = Date.now() - data.sentAt;
    if (ageMs > OTP_TTL_MS) {
      localStorage.removeItem(OTP_PENDING_KEY);
      console.log("[OTP] Pending state expired and cleared");
      return null;
    }
    console.log("[OTP] Loaded pending state from localStorage", {
      email: data.email,
      ageMs,
      remainingSec: Math.round((OTP_TTL_MS - ageMs) / 1000),
    });
    return data;
  } catch { return null; }
}

export function clearOtpPending(): void {
  try {
    localStorage.removeItem(OTP_PENDING_KEY);
    console.log("[OTP] Pending state cleared");
  } catch {}
}

// ─── Return-to ────────────────────────────────────────────────────────────────
// Where to send the user after a successful OTP sign-in.
// Stored in localStorage (not sessionStorage) for the same iOS Safari reason.

export const RETURN_TO_PENDING_KEY = "indiepact_return_to";

const RETURN_TTL_MS = 30 * 60 * 1000;

interface ReturnToEntry { path: string; savedAt: number }

export function saveReturnTo(path: string): void {
  try {
    const entry: ReturnToEntry = { path, savedAt: Date.now() };
    localStorage.setItem(RETURN_TO_PENDING_KEY, JSON.stringify(entry));
  } catch {}
}

/**
 * Reads and removes the saved return-to path.
 * Returns null if missing or expired.
 */
export function consumeReturnTo(): string | null {
  try {
    const raw = localStorage.getItem(RETURN_TO_PENDING_KEY);
    localStorage.removeItem(RETURN_TO_PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ReturnToEntry;
    if (Date.now() - data.savedAt > RETURN_TTL_MS) return null;
    return data.path || null;
  } catch { return null; }
}
