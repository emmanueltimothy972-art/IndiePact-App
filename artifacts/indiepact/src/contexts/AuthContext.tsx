import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { DEMO_USER_ID, PLAN_LIMITS } from "@/lib/constants";
import { DEV_AUTH_BYPASS, DEV_MOCK_USER } from "@/lib/devMode";

// ─── Dev tier override (localStorage) ────────────────────────────────────────
// Only used when DEV_AUTH_BYPASS=true. Persists across refreshes.

const DEV_TIER_KEY = "indiepact_dev_tier";
const DEV_TIER_DEFAULT = "pro";

function readDevTier(): string {
  if (!DEV_AUTH_BYPASS) return DEV_TIER_DEFAULT;
  try { return localStorage.getItem(DEV_TIER_KEY) ?? DEV_TIER_DEFAULT; } catch { return DEV_TIER_DEFAULT; }
}

function writeDevTier(tier: string) {
  try { localStorage.setItem(DEV_TIER_KEY, tier); } catch {}
}

// ─── Subscription state ───────────────────────────────────────────────────────

interface SubscriptionState {
  userPlan: string;
  scansUsed: number;
  scansLimit: number;
}

async function fetchSubscription(uid: string): Promise<SubscriptionState> {
  try {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    const res = await fetch(`${window.location.origin}${base}/api/subscription?userId=${encodeURIComponent(uid)}`);
    if (!res.ok) throw new Error("Failed to fetch subscription");
    const data = (await res.json()) as { plan?: string; scansUsed?: number; scansLimit?: number };
    const plan = data.plan ?? "free";
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
  openAuthModal: () => void;
  closeAuthModal: () => void;

  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;

  userPlan: string;
  scansUsed: number;
  scansLimit: number;
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

  // Dev tier switcher state — only meaningful when DEV_AUTH_BYPASS=true
  const [devTier, setDevTierState] = useState<string>(() => readDevTier());

  // Subscription for real auth
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
    // Also update live subscription so all isPaidPlan() checks react immediately
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
    const state = await fetchSubscription(id);
    setSubscription(state);
  }, [user?.id]);

  // ── Real Supabase auth (skipped entirely in dev bypass mode) ──────────────

  useEffect(() => {
    if (DEV_AUTH_BYPASS) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.user) void fetchSubscription(session.user.id).then(setSubscription);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.user) {
        setShowAuthModal(false);
        void fetchSubscription(session.user.id).then(setSubscription);
      } else {
        setSubscription({ userPlan: "free", scansUsed: 0, scansLimit: 2 });
      }
    });

    return () => authSub.unsubscribe();
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const signInWithGoogle = useCallback(async (): Promise<{ error: Error | null }> => {
    if (DEV_AUTH_BYPASS) return { error: null }; // no-op in dev mode

    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    const redirectTo = `${window.location.origin}${base}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    if (DEV_AUTH_BYPASS) return;
    await supabase.auth.signOut();
    setSubscription({ userPlan: "free", scansUsed: 0, scansLimit: 2 });
  }, []);

  const openAuthModal = useCallback(() => {
    if (DEV_AUTH_BYPASS) return;
    setShowAuthModal(true);
  }, []);

  const closeAuthModal = useCallback(() => setShowAuthModal(false), []);

  const userId = user?.id ?? DEMO_USER_ID;
  const isGuest = !user;

  return (
    <AuthContext.Provider value={{
      user, session, isLoading, userId, isGuest,
      showAuthModal, openAuthModal, closeAuthModal,
      signInWithGoogle, signOut,
      userPlan: subscription.userPlan,
      scansUsed: subscription.scansUsed,
      scansLimit: subscription.scansLimit,
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
