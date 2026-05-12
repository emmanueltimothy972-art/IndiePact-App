import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { DEMO_USER_ID, PLAN_LIMITS } from "@/lib/constants";
import { DEV_AUTH_BYPASS, DEV_MOCK_USER } from "@/lib/devMode";

// ─── Device memory (remember this device for 30 days) ────────────────────────

const DEVICE_KEY = "indiepact_device";
const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface DeviceMemory {
  email: string;
  expiresAt: number;
}

function readDeviceMemory(): DeviceMemory | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DeviceMemory;
    if (Date.now() > data.expiresAt) { localStorage.removeItem(DEVICE_KEY); return null; }
    return data;
  } catch { return null; }
}

function writeDeviceMemory(email: string) {
  localStorage.setItem(DEVICE_KEY, JSON.stringify({ email, expiresAt: Date.now() + DEVICE_TTL_MS }));
}

function clearDeviceMemory() {
  localStorage.removeItem(DEVICE_KEY);
}

// ─── Subscription ─────────────────────────────────────────────────────────────

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
  sendOtp: (email: string) => Promise<{ error: Error | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  rememberedEmail: string | null;
  rememberThisDevice: (email: string) => void;
  forgetThisDevice: () => void;
  userPlan: string;
  scansUsed: number;
  scansLimit: number;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Dev bypass mock values ───────────────────────────────────────────────────
// When DEV_AUTH_BYPASS=true, the provider returns these instead of real
// Supabase state. The full auth architecture (OTP, session, gates) remains
// intact — only the session check is short-circuited.

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
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(
    () => readDeviceMemory()?.email ?? null,
  );
  const [subscription, setSubscription] = useState<SubscriptionState>(
    DEV_AUTH_BYPASS
      ? { userPlan: DEV_MOCK_USER.plan, scansUsed: DEV_MOCK_USER.scansUsed, scansLimit: DEV_MOCK_USER.scansLimit }
      : { userPlan: "free", scansUsed: 0, scansLimit: 2 },
  );

  const refreshSubscription = useCallback(async (uid?: string) => {
    if (DEV_AUTH_BYPASS) return;
    const id = uid ?? user?.id;
    if (!id || id === DEMO_USER_ID) return;
    const state = await fetchSubscription(id);
    setSubscription(state);
  }, [user?.id]);

  // Real Supabase auth — skipped entirely in dev bypass mode
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

  const sendOtp = useCallback(async (email: string) => {
    if (DEV_AUTH_BYPASS) return { error: null };
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    try {
      const res = await fetch(`${window.location.origin}${base}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) return { error: new Error(data.error ?? "Failed to send code") };
      return { error: null };
    } catch {
      return { error: new Error("Network error — please check your connection") };
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    if (DEV_AUTH_BYPASS) return { error: null };
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    if (DEV_AUTH_BYPASS) return;
    clearDeviceMemory();
    setRememberedEmail(null);
    await supabase.auth.signOut();
    setSubscription({ userPlan: "free", scansUsed: 0, scansLimit: 2 });
  }, []);

  const rememberThisDevice = useCallback((email: string) => {
    writeDeviceMemory(email);
    setRememberedEmail(email);
  }, []);

  const forgetThisDevice = useCallback(() => {
    clearDeviceMemory();
    setRememberedEmail(null);
  }, []);

  const openAuthModal = useCallback(() => {
    if (DEV_AUTH_BYPASS) return; // no-op in dev mode
    setShowAuthModal(true);
  }, []);
  const closeAuthModal = useCallback(() => setShowAuthModal(false), []);

  const userId = user?.id ?? DEMO_USER_ID;
  const isGuest = !user;

  return (
    <AuthContext.Provider value={{
      user, session, isLoading, userId, isGuest,
      showAuthModal, openAuthModal, closeAuthModal,
      sendOtp, verifyOtp, signOut,
      rememberedEmail, rememberThisDevice, forgetThisDevice,
      userPlan: subscription.userPlan,
      scansUsed: subscription.scansUsed,
      scansLimit: subscription.scansLimit,
      refreshSubscription,
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
