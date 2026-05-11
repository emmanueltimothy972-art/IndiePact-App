import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { DEMO_USER_ID, PLAN_LIMITS } from "@/lib/constants";

// ─── Device memory (remember this device for 30 days) ────────────────────────

const DEVICE_KEY = "indiepact_device";
const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface DeviceMemory {
  email: string;
  expiresAt: number;
}

function readDeviceMemory(): DeviceMemory | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DeviceMemory;
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(DEVICE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeDeviceMemory(email: string) {
  const data: DeviceMemory = { email, expiresAt: Date.now() + DEVICE_TTL_MS };
  localStorage.setItem(DEVICE_KEY, JSON.stringify(data));
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
  /** Step 1 — sends a 6-digit code to the user's email via our API server. */
  sendOtp: (email: string) => Promise<{ error: Error | null }>;
  /** Step 2 — verifies the code and creates a Supabase session. */
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /** Email saved to this device for 30 days (null if not remembered or expired). */
  rememberedEmail: string | null;
  rememberThisDevice: (email: string) => void;
  forgetThisDevice: () => void;
  userPlan: string;
  scansUsed: number;
  scansLimit: number;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(
    () => readDeviceMemory()?.email ?? null
  );
  const [subscription, setSubscription] = useState<SubscriptionState>({
    userPlan: "free",
    scansUsed: 0,
    scansLimit: 2,
  });

  const refreshSubscription = useCallback(async (uid?: string) => {
    const id = uid ?? user?.id;
    if (!id || id === DEMO_USER_ID) return;
    const state = await fetchSubscription(id);
    setSubscription(state);
  }, [user?.id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.user) {
        void fetchSubscription(session.user.id).then(setSubscription);
      }
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

  /**
   * Sends a 6-digit OTP to the given email via the backend.
   *
   * The backend ensures the user account is pre-confirmed before triggering
   * the OTP email — this prevents Supabase from sending the "Follow this link
   * to confirm your user" email that fires for new unconfirmed accounts.
   *
   * Future: when Resend + auth@indiepact.pro is connected as a Supabase Auth
   * Hook, the backend will send a fully branded 6-digit-only email. This
   * frontend call does not need to change.
   */
  const sendOtp = useCallback(async (email: string) => {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    try {
      const res = await fetch(`${window.location.origin}${base}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        return { error: new Error(data.error ?? "Failed to send code") };
      }
      return { error: null };
    } catch {
      return { error: new Error("Network error — please check your connection") };
    }
  }, []);

  /**
   * Verifies the 6-digit code and establishes a Supabase session.
   * On success, onAuthStateChange fires automatically and closes the modal.
   */
  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
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

  const openAuthModal = useCallback(() => setShowAuthModal(true), []);
  const closeAuthModal = useCallback(() => setShowAuthModal(false), []);

  const userId = user?.id ?? DEMO_USER_ID;
  const isGuest = !user;

  return (
    <AuthContext.Provider value={{
      user, session, isLoading, userId, isGuest,
      showAuthModal, openAuthModal, closeAuthModal,
      sendOtp, verifyOtp, signOut,
      rememberedEmail,
      rememberThisDevice,
      forgetThisDevice,
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
