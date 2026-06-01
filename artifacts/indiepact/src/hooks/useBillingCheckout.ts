/**
 * useBillingCheckout
 *
 * Single authoritative frontend entry point for all recurring subscription
 * checkout flows. Call handleBillingCheckout(tierName) from any pricing
 * surface — the hook owns auth gating, duplicate-click prevention, tier
 * validation, JWT injection, backend communication, and redirect.
 *
 * SECURITY RULES (enforced here, not negotiable):
 *   • Only `tierName` is sent to the backend — no email, userId, amount, or
 *     plan codes. The server derives everything from the authenticated JWT.
 *   • The JWT access token is always fetched fresh from Supabase immediately
 *     before the request, never cached in component state.
 *
 * FUTURE COMPATIBILITY:
 *   • Add new tiers: update TIER_RANK and PAID_TIERS — no logic changes.
 *   • Downgrade flow: replace the toast stub in the downgrade branch.
 *   • Annual billing: pass `{ tierName, interval: "annual" }` to backend.
 *   • Coupon codes: add `coupon` field to the POST body.
 *   • Stripe migration: swap the fetch URL only.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// ─── Tier ranking ─────────────────────────────────────────────────────────────
// free(0) < pay_per_scan(1) < starter(2) < pro(3) < business(4) < agency(5) < enterprise(6)
// Used to detect upgrades vs. downgrades without hardcoding comparisons.

const TIER_RANK: Record<string, number> = {
  free:         0,
  pay_per_scan: 1,
  starter:      2,
  pro:          3,
  business:     4,
  agency:       5,
  enterprise:   6,
};

const PAID_RECURRING_TIERS = new Set([
  "starter", "pro", "business", "agency", "enterprise",
]);

// ─── Session storage key for post-auth checkout resume ────────────────────────

const PENDING_CHECKOUT_KEY = "indiepact_pending_checkout_tier";

function savePendingTier(tier: string) {
  try { sessionStorage.setItem(PENDING_CHECKOUT_KEY, tier); } catch {}
}

function consumePendingTier(): string | null {
  try {
    const val = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    return val;
  } catch { return null; }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface BillingCheckoutReturn {
  /**
   * Initiate a checkout session for the given recurring tier.
   * Safe to call from any pricing surface — handles all edge cases internally.
   */
  handleBillingCheckout: (tierName: string) => Promise<void>;
  /** The tier currently being checked out, or null if idle. */
  loadingTier: string | null;
  /** True when any tier checkout is in progress. Use to disable all buttons. */
  isLoading: boolean;
}

export function useBillingCheckout(): BillingCheckoutReturn {
  const { isGuest, openAuthModal, userPlan } = useAuth();
  const { toast } = useToast();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const isLoading = loadingTier !== null;

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

  // ── Core checkout function ────────────────────────────────────────────────

  const handleBillingCheckout = useCallback(async (tierName: string): Promise<void> => {
    // ── Guard: only handle known recurring tiers ──────────────────────────
    if (!PAID_RECURRING_TIERS.has(tierName)) {
      console.warn(`[BillingCheckout] "${tierName}" is not a recognized recurring tier.`);
      return;
    }

    // ── Guard: duplicate-click / concurrent request prevention ───────────
    // The loading state persists until redirect or error — no double-fire possible.
    if (isLoading) return;

    // ── Guard: same plan ──────────────────────────────────────────────────
    if (userPlan === tierName) {
      toast({
        title: "Already subscribed",
        description: `You're already on the ${tierName.charAt(0).toUpperCase() + tierName.slice(1)} plan.`,
      });
      return;
    }

    // ── Guard: auth — unauthenticated users ──────────────────────────────
    if (isGuest) {
      savePendingTier(tierName);
      openAuthModal("/pricing", "upgrade your plan");
      return;
    }

    // ── Guard: downgrade detection ────────────────────────────────────────
    const currentRank  = TIER_RANK[userPlan]  ?? 0;
    const requestedRank = TIER_RANK[tierName] ?? 0;
    if (requestedRank < currentRank) {
      toast({
        title: "Plan downgrade",
        description:
          "To downgrade your subscription, please contact support at support@indiepact.com. " +
          "Your current access continues until the end of the billing period.",
      });
      return;
    }

    // ── Begin checkout ────────────────────────────────────────────────────
    setLoadingTier(tierName);

    try {
      // ── Resolve a fresh JWT — never use a stale cached token ─────────
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        // Session expired mid-flow — save tier and re-prompt auth.
        savePendingTier(tierName);
        openAuthModal("/pricing", "upgrade your plan");
        setLoadingTier(null);
        return;
      }

      // ── POST to backend — only tierName, nothing else ─────────────────
      // The server derives email, userId, plan code, and amount from the JWT.
      let response: Response;
      try {
        response = await fetch(
          `${window.location.origin}${base}/api/subscription/initialize`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ tierName }),
          },
        );
      } catch (networkErr) {
        throw new Error(
          "Could not reach the payment server. Check your connection and try again.",
        );
      }

      // ── Parse response ────────────────────────────────────────────────
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an unexpected response. Please try again.");
      }

      if (!response.ok) {
        const serverMessage = (data as { error?: string; detail?: string })?.error
          ?? (data as { error?: string; detail?: string })?.detail;
        throw new Error(
          serverMessage ?? `Payment server error (${response.status}). Please try again.`,
        );
      }

      const { success, authorization_url } = data as {
        success?: boolean;
        authorization_url?: string;
      };

      if (!success || !authorization_url) {
        throw new Error(
          "Payment processor did not return a checkout URL. Please try again or contact support.",
        );
      }

      // ── Redirect — loading state intentionally NOT cleared ────────────
      // The page navigates away; clearing state would cause a UI flash.
      window.location.href = authorization_url;

    } catch (err) {
      setLoadingTier(null);
      toast({
        title: "Billing connection error",
        description:
          err instanceof Error
            ? err.message
            : "Billing connection error. Please try again or contact support.",
        variant: "destructive",
      });
    }
  }, [isGuest, isLoading, userPlan, openAuthModal, toast, base]);

  // ── Auto-resume checkout after authentication ─────────────────────────────
  // When a guest clicks upgrade → auth modal → signs in → this effect fires
  // and automatically resumes the checkout for the tier they originally clicked.

  useEffect(() => {
    if (isGuest) return; // still unauthenticated — wait

    const pendingTier = consumePendingTier();
    if (pendingTier && PAID_RECURRING_TIERS.has(pendingTier)) {
      void handleBillingCheckout(pendingTier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]); // run once when auth state changes from guest → authenticated

  return { handleBillingCheckout, loadingTier, isLoading };
}
