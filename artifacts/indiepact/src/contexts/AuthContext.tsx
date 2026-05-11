import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { buildAuthRedirectUrl } from "@/lib/auth";
import { DEMO_USER_ID, PLAN_LIMITS } from "@/lib/constants";

interface SubscriptionState {
  userPlan: string;
  scansUsed: number;
  scansLimit: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  userId: string;
  isGuest: boolean;
  showAuthModal: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  userPlan: string;
  scansUsed: number;
  scansLimit: number;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
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

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = buildAuthRedirectUrl();
    console.info("[IndiePact] OAuth redirectTo:", redirectTo);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) console.error("[IndiePact] Google OAuth error:", error.message);
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const redirectTo = buildAuthRedirectUrl();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSubscription({ userPlan: "free", scansUsed: 0, scansLimit: 2 });
  }, []);

  const openAuthModal = useCallback(() => setShowAuthModal(true), []);
  const closeAuthModal = useCallback(() => setShowAuthModal(false), []);

  const userId = user?.id ?? DEMO_USER_ID;
  const isGuest = !user;

  return (
    <AuthContext.Provider value={{
      user, session, isLoading, userId, isGuest,
      showAuthModal, openAuthModal, closeAuthModal,
      signInWithGoogle, signInWithEmail, signOut,
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
