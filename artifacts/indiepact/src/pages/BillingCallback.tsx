import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react";

type Stage = "verifying" | "success" | "already_handled" | "error" | "timeout";

const VERIFICATION_TIMEOUT_MS = 30_000;

export default function BillingCallback() {
  const [, navigate] = useLocation();
  const { refreshSubscription } = useAuth();
  const [stage, setStage] = useState<Stage>("verifying");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ran = useRef(false);

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    // planKey is embedded by the initialize endpoint: /billing/callback?plan=<tier>
    const planKey = params.get("plan");

    console.info("[BillingCallback] Starting verification", {
      payment_reference: reference ?? "(missing)",
      plan_key: planKey ?? "(missing)",
      url: window.location.href,
    });

    if (!reference) {
      // No reference → likely a direct navigation to /billing/callback;
      // treat as already handled and redirect silently.
      console.info("[BillingCallback] No payment reference in URL — treating as already handled");
      setStage("already_handled");
      setTimeout(() => navigate(`${base}/dashboard`), 2000);
      return;
    }

    const timeoutId = setTimeout(() => {
      console.warn("[BillingCallback] Verification timed out after 30 s", { payment_reference: reference });
      setStage("timeout");
      setTimeout(() => navigate(`${base}/dashboard`), 5000);
    }, VERIFICATION_TIMEOUT_MS);

    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          clearTimeout(timeoutId);
          console.warn("[BillingCallback] No active session — redirecting to home");
          setStage("error");
          setErrorMsg("Session expired. Please sign in again.");
          setTimeout(() => navigate(`${base}/`), 3000);
          return;
        }

        const body: Record<string, string> = { reference };
        if (planKey) body["planKey"] = planKey;

        console.info("[BillingCallback] Calling verify-payment", {
          payment_reference: reference,
          plan_key: planKey ?? "(omitted — backend will resolve from Paystack metadata)",
        });

        const res = await fetch(
          `${window.location.origin}${base}/api/subscription/verify-payment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(body),
          },
        );

        clearTimeout(timeoutId);

        const resBody = await res.json().catch(() => ({})) as { error?: string; plan?: string };

        console.info("[BillingCallback] verify-payment response", {
          payment_reference: reference,
          http_status: res.status,
          verification_result: res.ok ? "success" : "failure",
          plan: resBody.plan ?? "(unknown)",
          error: resBody.error ?? null,
        });

        if (res.ok || res.status === 409) {
          // 409 = already verified (idempotent); treat as success
          await refreshSubscription();
          console.info("[BillingCallback] Subscription refreshed — redirecting to dashboard");
          setStage("success");
          setTimeout(() => navigate(`${base}/dashboard`), 2500);
        } else {
          setStage("error");
          setErrorMsg(resBody.error ?? "Payment verification failed. Contact support if your plan hasn't updated.");
          setTimeout(() => navigate(`${base}/dashboard`), 5000);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("[BillingCallback] Network error during verification", {
          payment_reference: reference,
          error: String(err),
        });
        setStage("error");
        setErrorMsg("Network error during payment verification. Your subscription may still be active — check your dashboard.");
        setTimeout(() => navigate(`${base}/dashboard`), 5000);
      }
    })();
  }, [base, navigate, refreshSubscription]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0a0a0a] p-8 flex flex-col items-center text-center gap-5">

        {stage === "verifying" && (
          <>
            <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
            <div>
              <p className="text-white font-semibold text-lg mb-1">Confirming your payment…</p>
              <p className="text-slate-500 text-sm">This only takes a moment.</p>
            </div>
          </>
        )}

        {stage === "success" && (
          <>
            <CheckCircle className="h-10 w-10 text-emerald-400" />
            <div>
              <p className="text-white font-semibold text-lg mb-1">You're all set!</p>
              <p className="text-slate-400 text-sm">Your plan has been activated. Redirecting to your dashboard…</p>
            </div>
          </>
        )}

        {stage === "already_handled" && (
          <>
            <CheckCircle className="h-10 w-10 text-emerald-400" />
            <div>
              <p className="text-white font-semibold text-lg mb-1">Subscription active</p>
              <p className="text-slate-400 text-sm">Redirecting to your dashboard…</p>
            </div>
          </>
        )}

        {stage === "timeout" && (
          <>
            <Clock className="h-10 w-10 text-amber-400" />
            <div>
              <p className="text-white font-semibold text-lg mb-1">Taking longer than expected…</p>
              <p className="text-slate-400 text-sm">Your payment was received. Check your dashboard to confirm your plan is active.</p>
              <p className="text-slate-600 text-xs mt-2">Redirecting to your dashboard…</p>
            </div>
          </>
        )}

        {stage === "error" && (
          <>
            <AlertCircle className="h-10 w-10 text-amber-400" />
            <div>
              <p className="text-white font-semibold text-lg mb-1">Something went wrong</p>
              <p className="text-slate-400 text-sm">{errorMsg}</p>
              <p className="text-slate-600 text-xs mt-2">Redirecting to your dashboard…</p>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
