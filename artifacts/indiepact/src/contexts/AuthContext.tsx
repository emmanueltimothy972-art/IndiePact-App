import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { DEMO_USER_ID, PLAN_LIMITS } from "@/lib/constants";
import { DEV_AUTH_BYPASS, DEV_MOCK_USER } from "@/lib/devMode";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import {
  loadOtpPending,
  saveReturnTo as savePendingReturnTo,
  consumeReturnTo as consumePendingReturnTo,
} from "@/lib/auth-pending";

// ─── Dev tier override (localStorage) ────────────────────────────────────────

const DEV_TIER_KEY = "indiepact_dev_tier";
const DEV_TIER_DEFAULT = "pro";

function readDevTier(): string {
  if (!DEV_AUTH_BYPASS) return DEV_TIER_DEFAULT;
  try { return localStorage.getItem(DEV_TIER_KEY) ?? DEV_TIER_DEFAULT; } catch { return DEV_TIER_DEFAULT; }
}

function writeDevTier(tier: string) {
  try { localStorage.setItem(DEV_TIER_KEY, tier); } catch {}
}

// ─── Return-to intent (localStorage, 30-min TTL) ─────────────────────────────
// Saved when the auth modal opens so the OTP flow can redirect the user back
// to what they were doing after sign-in.
//
// Uses localStorage (not sessionStorage) so it survives iOS Safari tab eviction.
// Re-exported here for backward compat — callers import from AuthContext.

export function saveReturnTo(returnTo?: string): void {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const fallback = window.location.pathname.replace(base, "") || "/";
  savePendingReturnTo(returnTo ?? fallback);
}

export function consumeReturnTo(): string | null {
  return consumePendingReturnTo();
}

// Kept for any legacy callers that reference the key directly.
export const RETURN_TO_KEY = "indiepact_return_to";

// ─── Subscription state ───────────────────────────────────────────────────────

interface SubscriptionState {
  userPlan: string;
  scansUsed: number;
  scansLimit: number;
}

async function fetchSubscription(uid: string, token?: string | null): Promise<SubscriptionState> {
  try {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(
      `${window.location.origin}${base}/api/subscription?userId=${encodeURIComponent(uid)}`,
      { headers },
    );
    if (!res.ok) throw new Error("Failed to fetch subscription");
    const data = (await res.json()) as { plan?: string; scansUsed?: number; scansLimit?: number };
    const plan = (data.plan ?? "free").trim().toLowerCase();
    const scansUsed = data.scansUsed ?? 0;
    const scansLimit = data.scansLimit ?? PLAN_LIMITS[plan] ?? 2;
    return { userPlan: plan, scansUsed, scansLimit };
  } catch {
    return { userPlan: "free", scansUsed: 0, scansLimit: 2 };
  }
}

// ─── Context types ────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  userId: string;
  isGuest: boolean;

  showAuthModal: boolean;
  /** Short phrase shown in the auth modal, e.g. "review your contract".
   *  The modal prepends "Sign in to " to this string. */
  authContext: string | null;
  /** Open the auth modal.
   *  @param returnTo  App-relative path to redirect to after sign-in (e.g. "/scan").
   *                   Defaults to the current page.
   *  @param context   Short phrase for contextual headline, e.g. "review your contract".
   */
  openAuthModal: (returnTo?: string, context?: string) => void;
  closeAuthModal: () => void;

  signOut: () => Promise<void>;

  userPlan: string;
  scansUsed: number;
  scansLimit: number;
  remainingScans: number;
  canScan: boolean;
  refreshSubscription: () => Promise<void>;

  // Dev-mode tier simulator (no-op in production)
  devTier: string;
  setDevTier: (tier: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Dev mock user ────────────────────────────────────────────────────────────

const DEV_MOCK_SUPABASE_USER = DEV_AUTH_BYPASS
  ? ({
      id: DEV_MOCK_USER.id,
      email: DEV_MOCK_USER.email,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as unknown as User)
  : null;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DEV_AUTH_BYPASS ? DEV_MOCK_SUPABASE_USER : null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!DEV_AUTH_BYPASS);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authContext, setAuthContext] = useState<string | null>(null);

  const [devTier, setDevTierState] = useState<string>(() => readDevTier());

  const [subscription, setSubscription] = useState<SubscriptionState>(() => {
    const plan = DEV_AUTH_BYPASS ? readDevTier() : "free";
    return {
      userPlan: plan,
      scansUsed: DEV_AUTH_BYPASS ? DEV_MOCK_USER.scansUsed : 0,
      scansLimit: DEV_AUTH_BYPASS ? (PLAN_LIMITS[plan] ?? DEV_MOCK_USER.scansLimit) : 2,
    };
  });

  const setDevTier = useCallback((tier: string) => {
    if (!DEV_AUTH_BYPASS) return;
    writeDevTier(tier);
    setDevTierState(tier);
    setSubscription({
      userPlan: tier,
      scansUsed: DEV_MOCK_USER.scansUsed,
      scansLimit: PLAN_LIMITS[tier] ?? DEV_MOCK_USER.scansLimit,
    });
  }, []);

  const refreshSubscription = useCallback(async (uid?: string) => {
    if (DEV_AUTH_BYPASS) return;
    const id = uid ?? user?.id;
    if (!id || id === DEMO_USER_ID) return;
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const state = await fetchSubscription(id, currentSession?.access_token);
    setSubscription(state);
  }, [user?.id]);

  // ── Real Supabase auth (skipped entirely in dev bypass mode) ──────────────

  useEffect(() => {
    if (DEV_AUTH_BYPASS) return;

    // Wire the API client to always include the current session's Bearer token.
    setAuthTokenGetter(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.user) {
        void fetchSubscription(session.user.id, session.access_token).then(setSubscription);
      } else {
        // ── Auto-restore OTP flow after page refresh / iOS tab reload ─────────
        // If the user was in the middle of OTP verification when the page was
        // refreshed (or iOS Safari evicted the tab), the pending state in
        // localStorage tells us to re-open the modal so they can still enter
        // their code. This is the ONLY place that re-opens the modal
        // automatically — AuthModal's own restore effect requires the modal to
        // already be open (showAuthModal=true), so we must trigger it here.
        const pending = loadOtpPending();
        if (pending) {
          console.log(
            "[AuthContext] Pending OTP found on page load — auto-restoring modal",
            { email: pending.email, route: window.location.pathname },
          );
          setShowAuthModal(true);
        } else {
          console.log(
            "[AuthContext] No pending OTP — guest session, modal stays closed",
            { route: window.location.pathname },
          );
        }
      }
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.user) {
        setShowAuthModal(false);
        void fetchSubscription(session.user.id, session.access_token).then(setSubscription);
      } else {
        setSubscription({ userPlan: "free", scansUsed: 0, scansLimit: 2 });
      }
    });

    return () => {
      authSub.unsubscribe();
      setAuthTokenGetter(null);
    };
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    if (DEV_AUTH_BYPASS) return;
    // Clear any pending OTP session so a subsequent user on the same device
    // doesn't see the previous user's OTP verify screen.
    try { sessionStorage.removeItem("ip_auth_pending"); } catch {}
    await supabase.auth.signOut();
    setSubscription({ userPlan: "free", scansUsed: 0, scansLimit: 2 });
  }, []);

  const openAuthModal = useCallback((returnTo?: string, context?: string) => {
    if (DEV_AUTH_BYPASS) return;
    saveReturnTo(returnTo);
    setAuthContext(context ?? null);
    setShowAuthModal(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false);
    setAuthContext(null);
  }, []);

  const userId = user?.id ?? DEMO_USER_ID;
  const isGuest = !user;

  const remainingScans = Math.max(0, subscription.scansLimit - subscription.scansUsed);
  const canScan = remainingScans > 0;

  return (
    <AuthContext.Provider value={{
      user, session, isLoading, userId, isGuest,
      showAuthModal, authContext, openAuthModal, closeAuthModal,
      signOut,
      userPlan: subscription.userPlan,
      scansUsed: subscription.scansUsed,
      scansLimit: subscription.scansLimit,
      remainingScans,
      canScan,
      refreshSubscription,
      devTier,
      setDevTier,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
