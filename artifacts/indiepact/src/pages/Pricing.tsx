import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Check, X, ArrowLeft, Zap, Brain, Loader2, FileText, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { initiatePaystackPayment } from "@/lib/paystack";
import { PLAN_PRICES_CENTS } from "@/lib/constants";
import { useBillingCheckout } from "@/hooks/useBillingCheckout";

// ─── Plan definitions ─────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Free",
    key: "free",
    price: 0,
    tagline: "See if IndiePact is right for you.",
    cta: "Start Free",
    popular: false,
    features: [
      { text: "2 contract reviews per month",       included: true },
      { text: "Text paste only",                     included: true },
      { text: "Basic contract explanation",           included: true },
      { text: "Basic risk detection",                 included: true },
      { text: "PDF / DOCX uploads",                  included: false },
      { text: "AI Attorney",                          included: false },
      { text: "Negotiation War Room",                 included: false },
      { text: "Payment Lock",                         included: false },
      { text: "AI Legal Strategy",                    included: false },
      { text: "Export reports",                       included: false },
    ],
  },
  {
    name: "Starter",
    key: "starter",
    price: 19,
    tagline: "Professional contract review for freelancers.",
    cta: "Get Starter",
    popular: false,
    features: [
      { text: "10 contract reviews per month",       included: true },
      { text: "PDF & DOCX uploads",                  included: true },
      { text: "Improved AI summaries",               included: true },
      { text: "Basic clause explanations",           included: true },
      { text: "Scan history",                        included: true },
      { text: "Export to PDF",                       included: true },
      { text: "AI Attorney",                         included: false },
      { text: "Clause Armory",                       included: false },
      { text: "Negotiation War Room",                included: false },
      { text: "Payment Lock",                        included: false },
      { text: "AI Legal Strategy",                   included: false },
    ],
  },
  {
    name: "Pro",
    key: "pro",
    price: 49,
    tagline: "The first real premium intelligence tier.",
    cta: "Get Pro",
    popular: false,
    features: [
      { text: "50 contract reviews per month",       included: true },
      { text: "AI Attorney",                         included: true },
      { text: "Clause Armory",                       included: true },
      { text: "Negotiation War Room",                included: true },
      { text: "Payment Lock",                        included: true },
      { text: "Advanced clause rewriting",           included: true },
      { text: "Revenue stress analysis",             included: true },
      { text: "Export to PDF",                       included: true },
      { text: "AI Legal Strategy",                   included: false },
    ],
  },
  {
    name: "Business",
    key: "business",
    price: 99,
    tagline: "Full AI contract intelligence — everything included.",
    cta: "Get Business",
    popular: true,
    features: [
      { text: "100 contract reviews per month",      included: true },
      { text: "AI Legal Strategy",                   included: true },
      { text: "Full platform access",                included: true },
      { text: "Multi-document analysis",             included: true },
      { text: "Faster AI processing",                included: true },
      { text: "Priority processing",                 included: true },
      { text: "Team collaboration",                  included: true },
      { text: "Priority support",                    included: true },
    ],
  },
  {
    name: "Agency",
    key: "agency",
    price: 149,
    tagline: "Enterprise-grade tools for agencies and teams.",
    cta: "Get Agency",
    popular: false,
    features: [
      { text: "300 contract reviews per month",      included: true },
      { text: "Everything in Business",              included: true },
      { text: "Bulk uploads",                        included: true },
      { text: "Shared team workspace",               included: true },
      { text: "Advanced collaboration",              included: true },
      { text: "Stronger AI processing",              included: true },
      { text: "Dedicated account support",           included: true },
      { text: "Agency workflow tools",               included: true },
    ],
  },
  {
    name: "Enterprise",
    key: "enterprise",
    price: 199,
    tagline: "Maximum capacity, premium support, full admin control.",
    cta: "Get Enterprise",
    popular: false,
    features: [
      { text: "500 contract reviews per month",      included: true },
      { text: "Full AI suite",                       included: true },
      { text: "Admin controls",                      included: true },
      { text: "Premium analytics",                   included: true },
      { text: "Maximum AI speed",                    included: true },
      { text: "Enterprise exports",                  included: true },
      { text: "Unlimited team members",              included: true },
      { text: "SLA & priority support",              included: true },
    ],
  },
];

// ─── One-time scan features ───────────────────────────────────────────────────

const PAY_PER_SCAN_FEATURES = [
  "Full negotiation scripts (Direct, Diplomatic, Legal)",
  "AI Attorney — clause-by-clause risk intelligence",
  "AI Legal Strategy",
  "Payment Lock",
  "Export to PDF",
];

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isCurrentPlan,
  isLoading,
  isDisabled,
  onCta,
}: {
  plan: typeof PLANS[number];
  isCurrentPlan: boolean;
  /** True when THIS card's checkout is in progress — shows spinner + "Redirecting…" */
  isLoading: boolean;
  /** True when any other card's checkout is in progress — disables without spinner */
  isDisabled: boolean;
  onCta: () => void;
}) {
  const blocked = isCurrentPlan || isDisabled;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-colors ${
        plan.popular
          ? "border-slate-600 bg-[#0c0c0c]"
          : "border-slate-800 bg-[#0a0a0a] hover:border-slate-700"
      }`}
    >
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wide whitespace-nowrap">
          Current Plan
        </div>
      )}
      {plan.popular && !isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-900 text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wide whitespace-nowrap">
          Most Popular
        </div>
      )}

      <div className="mb-5">
        <h2 className="text-base font-bold text-white mb-1">{plan.name}</h2>
        <div className="flex items-end gap-1 mb-2">
          {plan.price === 0 ? (
            <span className="text-3xl font-bold text-white tracking-tight">Free</span>
          ) : (
            <>
              <span className="text-3xl font-bold text-white tracking-tight">${plan.price}</span>
              <span className="text-slate-500 text-sm mb-1">/mo</span>
            </>
          )}
        </div>
        <p className="text-slate-500 text-xs leading-snug">{plan.tagline}</p>
      </div>

      <button
        onClick={onCta}
        disabled={isLoading || blocked}
        aria-busy={isLoading}
        aria-label={isCurrentPlan ? `${plan.name} — current plan` : isLoading ? `Redirecting to ${plan.name} checkout` : plan.cta}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold mb-5 transition-colors flex items-center justify-center gap-2 ${
          isCurrentPlan
            ? "bg-slate-800 text-slate-600 cursor-default"
            : isLoading
            ? "bg-slate-700 text-slate-300 cursor-wait"
            : blocked
            ? "bg-slate-800 text-slate-700 cursor-not-allowed opacity-50"
            : plan.popular
            ? "bg-slate-200 hover:bg-white text-slate-900"
            : "bg-slate-800 hover:bg-slate-700 text-white"
        }`}
      >
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {isCurrentPlan
          ? "Current Plan"
          : isLoading
          ? "Redirecting to checkout…"
          : plan.cta}
      </button>

      <ul className="space-y-2.5 flex-1">
        {plan.features.map((f, j) => (
          <li key={j} className="flex items-start gap-2.5 text-sm">
            {f.included ? (
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <X className="h-4 w-4 text-slate-800 mt-0.5 shrink-0" />
            )}
            <span className={f.included ? "text-slate-300" : "text-slate-700"}>{f.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Pricing() {
  const { isGuest, openAuthModal, user, refreshSubscription, userPlan } = useAuth();
  const { toast } = useToast();

  // ── Recurring subscription checkout (all paid tiers) ─────────────────────
  // Single hook owns auth gating, JWT injection, backend call, and redirect.
  const { handleBillingCheckout, loadingTier, isLoading: isAnyPlanLoading } = useBillingCheckout();

  // ── Pay-per-scan (one-time, Paystack inline popup — separate flow) ────────
  const [payPerScanLoading, setPayPerScanLoading] = useState(false);

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

  // ─── Free plan / pay-per-scan CTA ────────────────────────────────────────

  const handleFreeCta = () => {
    if (isGuest) { openAuthModal(); return; }
    window.location.href = `${window.location.origin}${base}/dashboard`;
  };

  const handlePayPerScan = async () => {
    if (isGuest) { openAuthModal(); return; }

    if (userPlan === "pay_per_scan") {
      toast({ title: "Already active", description: "You already have a one-time scan available." });
      return;
    }

    if (!user?.email) {
      toast({ title: "Sign in required", description: "Please sign in first.", variant: "destructive" });
      return;
    }

    const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
    if (!paystackKey) {
      toast({
        title: "Payments not configured yet",
        description: "Payment processing is being set up. Check back soon.",
        variant: "destructive",
      });
      return;
    }

    if (payPerScanLoading || isAnyPlanLoading) return;
    setPayPerScanLoading(true);

    try {
      await initiatePaystackPayment({
        email: user.email,
        amountCents: PLAN_PRICES_CENTS["pay_per_scan"] ?? 999,
        currency: "USD",
        metadata: { userId: user.id, planKey: "pay_per_scan" },
        onSuccess: async (reference) => {
          toast({ title: "Payment received!", description: "Verifying your scan credit…" });
          try {
            const res = await fetch(
              `${window.location.origin}${base}/api/subscription/verify-payment`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id, reference, planKey: "pay_per_scan" }),
              },
            );
            if (res.ok) {
              await refreshSubscription();
              toast({ title: "Scan credit added!", description: "Your one-time scan is ready." });
            } else {
              toast({
                title: "Verification failed",
                description: `Payment received but verification failed. Keep your reference: ${reference}`,
                variant: "destructive",
              });
            }
          } catch {
            toast({ title: "Network error", description: "Could not verify payment. Contact support.", variant: "destructive" });
          }
          setPayPerScanLoading(false);
        },
        onClose: () => setPayPerScanLoading(false),
      });
    } catch (err) {
      toast({
        title: "Payment error",
        description: err instanceof Error ? err.message : "Could not launch payment. Please try again.",
        variant: "destructive",
      });
      setPayPerScanLoading(false);
    }
  };

  const isPayPerScanCurrent = !isGuest && userPlan === "pay_per_scan";
  const anyButtonBusy = isAnyPlanLoading || payPerScanLoading;

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 sticky top-0 z-50 bg-[#050505]">
        <Link href="/" className="flex items-center gap-2 font-bold text-base text-white">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          IndiePact
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-slate-500 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16 md:py-20">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-semibold px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            <Zap className="h-3 w-3" /> Simple, Transparent Pricing
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white">
            Protect every contract.
            <br />
            <span className="text-emerald-500">Pay only for what you need.</span>
          </h1>
          <p className="text-slate-500 text-base max-w-lg mx-auto">
            Start free. Upgrade when you're ready. Cancel anytime. No surprises.
          </p>
        </div>

        {/* ── One-Time Scan ──────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="rounded-2xl border border-slate-700 bg-[#0a0a0a] p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-slate-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white">One-Time Scan</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 uppercase tracking-widest">
                      No Subscription
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm max-w-lg leading-relaxed">
                    Review one contract now with full premium access — the same depth as the Business plan, for a single document. Premium access expires after the review is complete.
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                    {PAY_PER_SCAN_FEATURES.map((f) => (
                      <span key={f} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Check className="h-3 w-3 text-emerald-600 shrink-0" /> {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
                <div>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-white tracking-tight">$9.99</span>
                    <span className="text-slate-500 text-sm mb-1">one-time</span>
                  </div>
                  <p className="text-xs text-slate-700">No recurring charges</p>
                </div>
                <button
                  onClick={() => void handlePayPerScan()}
                  disabled={payPerScanLoading || isPayPerScanCurrent || isAnyPlanLoading}
                  aria-busy={payPerScanLoading}
                  className={`px-7 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
                    isPayPerScanCurrent
                      ? "bg-slate-800 text-slate-500 cursor-default"
                      : payPerScanLoading
                      ? "bg-emerald-800 text-emerald-200 cursor-wait"
                      : isAnyPlanLoading
                      ? "bg-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                      : "bg-emerald-700 hover:bg-emerald-600 text-white"
                  }`}
                >
                  {payPerScanLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isPayPerScanCurrent ? "Active" : payPerScanLoading ? "Processing…" : "Buy One Scan — $9.99"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 mx-1">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[10px] text-slate-700 uppercase tracking-widest font-mono">or choose a monthly plan</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>
        </div>

        {/* ── Plan grid: top row (Free, Starter, Pro) ───────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {PLANS.slice(0, 3).map((plan) => {
            if (plan.key === "free") {
              return (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  isCurrentPlan={!isGuest && userPlan === plan.key}
                  isLoading={false}
                  isDisabled={anyButtonBusy}
                  onCta={handleFreeCta}
                />
              );
            }
            return (
              <PlanCard
                key={plan.key}
                plan={plan}
                isCurrentPlan={!isGuest && userPlan === plan.key}
                isLoading={loadingTier === plan.key}
                isDisabled={anyButtonBusy && loadingTier !== plan.key}
                onCta={() => void handleBillingCheckout(plan.key)}
              />
            );
          })}
        </div>

        {/* ── Plan grid: bottom row (Business, Agency, Enterprise) ───── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          {PLANS.slice(3).map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              isCurrentPlan={!isGuest && userPlan === plan.key}
              isLoading={loadingTier === plan.key}
              isDisabled={anyButtonBusy && loadingTier !== plan.key}
              onCta={() => void handleBillingCheckout(plan.key)}
            />
          ))}
        </div>

        {/* ── Feature comparison table ──────────────────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] overflow-hidden mb-14">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="font-semibold text-white text-sm">Feature Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-6 py-3 text-slate-600 font-semibold uppercase tracking-widest w-[30%]">Feature</th>
                  {["Free", "Starter", "Pro", "Business+"].map((h) => (
                    <th key={h} className="px-4 py-3 text-slate-600 font-semibold uppercase tracking-widest text-center">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {[
                  ["Contract reviews / mo", "2", "10",  "50",  "100–500"],
                  ["Text paste",            "✓", "✓",   "✓",   "✓"],
                  ["PDF / DOCX uploads",    "—", "✓",   "✓",   "✓"],
                  ["Improved AI summaries", "—", "✓",   "✓",   "✓"],
                  ["Scan history",          "—", "✓",   "✓",   "✓"],
                  ["Export to PDF",         "—", "✓",   "✓",   "✓"],
                  ["AI Attorney",           "—", "—",   "✓",   "✓"],
                  ["Clause Armory",         "—", "—",   "✓",   "✓"],
                  ["Negotiation War Room",  "—", "—",   "✓",   "✓"],
                  ["Payment Lock",          "—", "—",   "✓",   "✓"],
                  ["Revenue stress test",   "—", "—",   "✓",   "✓"],
                  ["AI Legal Strategy",     "—", "—",   "—",   "✓"],
                  ["Team collaboration",    "—", "—",   "—",   "✓"],
                  ["Priority processing",   "—", "—",   "—",   "✓"],
                ].map(([feature, ...cells]) => (
                  <tr key={feature}>
                    <td className="px-6 py-3 text-slate-400">{feature}</td>
                    {cells.map((cell, i) => (
                      <td key={i} className={`px-4 py-3 text-center font-mono ${
                        cell === "✓" ? "text-emerald-600" :
                        cell === "—" ? "text-slate-800" :
                        "text-slate-400"
                      }`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Guarantee ─────────────────────────────────────────────── */}
        <div className="text-center">
          <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl border border-slate-800 bg-[#0a0a0a]">
            <ShieldCheck className="h-7 w-7 text-emerald-600" />
            <div>
              <p className="font-semibold text-white mb-1 text-sm">7-day money-back guarantee</p>
              <p className="text-slate-500 text-sm">Not satisfied? Full refund, no questions asked.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800/50 px-6 py-6 text-center">
        <p className="text-xs text-slate-700">
          © 2025 IndiePact ·{" "}
          <Link href="/" className="hover:text-slate-400 transition-colors">Home</Link>
          {" "}·{" "}
          <span className="flex items-center gap-1 inline-flex">
            <Lock className="h-2.5 w-2.5" /> All payments secured by Paystack
          </span>
        </p>
      </footer>
    </div>
  );
}
