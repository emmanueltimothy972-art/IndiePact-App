import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Check, X, ArrowLeft, Zap, Brain, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { initiatePaystackPayment } from "@/lib/paystack";
import { PLAN_PRICES_CENTS } from "@/lib/constants";

const PLANS = [
  {
    name: "Free",
    key: "free",
    price: 0,
    period: "forever",
    tagline: "See if IndiePact is right for you.",
    cta: "Start Free",
    featured: false,
    popular: false,
    features: [
      { text: "2 contract reviews per month", included: true },
      { text: "Text paste only (no PDF uploads)", included: true },
      { text: "Basic contract explanation", included: true },
      { text: "Basic risk detection", included: true },
      { text: "Negotiation assistant", included: false },
      { text: "Save review history", included: false },
      { text: "Export reports", included: false },
      { text: "AI Legal Strategy", included: false },
    ],
  },
  {
    name: "Starter",
    key: "starter",
    price: 19,
    period: "per month",
    tagline: "For freelancers reviewing contracts regularly.",
    cta: "Get Starter",
    featured: false,
    popular: false,
    features: [
      { text: "10 contract reviews per month", included: true },
      { text: "PDF & document uploads", included: true },
      { text: "Better AI explanations", included: true },
      { text: "Basic negotiation assistant", included: true },
      { text: "Save review history", included: true },
      { text: "Export reports", included: false },
      { text: "AI Legal Strategy", included: false },
      { text: "Team collaboration", included: false },
    ],
  },
  {
    name: "Pro",
    key: "pro",
    price: 49.99,
    period: "per month",
    tagline: "For professionals who need deeper AI insight.",
    cta: "Go Pro",
    featured: false,
    popular: false,
    features: [
      { text: "50 contract reviews per month", included: true },
      { text: "PDF & document uploads", included: true },
      { text: "AI Legal Strategy", included: true },
      { text: "Advanced negotiation", included: true },
      { text: "Clause rewriting", included: true },
      { text: "Export to PDF", included: true },
      { text: "Save review history", included: true },
      { text: "Team collaboration", included: false },
    ],
  },
  {
    name: "Business",
    key: "business",
    price: 99,
    period: "per month",
    tagline: "The best value for growing teams and agencies.",
    cta: "Go Business",
    featured: false,
    popular: true,
    features: [
      { text: "100 contract reviews per month", included: true },
      { text: "Faster AI processing", included: true },
      { text: "AI Legal Strategy", included: true },
      { text: "Team collaboration", included: true },
      { text: "Multi-document analysis", included: true },
      { text: "Better exports (PDF + DOCX)", included: true },
      { text: "Priority processing", included: true },
      { text: "Priority support", included: true },
    ],
  },
  {
    name: "Agency",
    key: "agency",
    price: 149,
    period: "per month",
    tagline: "For agencies managing many client contracts.",
    cta: "Get Agency",
    featured: false,
    popular: false,
    features: [
      { text: "300 contract reviews per month", included: true },
      { text: "Advanced AI Legal Strategy", included: true },
      { text: "Advanced team collaboration", included: true },
      { text: "Larger document uploads", included: true },
      { text: "Stronger AI insights", included: true },
      { text: "All export formats", included: true },
      { text: "Priority processing", included: true },
      { text: "Dedicated account support", included: true },
    ],
  },
  {
    name: "Enterprise",
    key: "enterprise",
    price: 199,
    period: "per month",
    tagline: "For enterprises with unlimited needs.",
    cta: "Get Enterprise",
    featured: false,
    popular: false,
    features: [
      { text: "500 contract reviews per month", included: true },
      { text: "Fastest AI processing", included: true },
      { text: "Full AI Legal Strategy system", included: true },
      { text: "Best-in-class negotiation AI", included: true },
      { text: "Full collaboration & admin tools", included: true },
      { text: "Premium exports", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Premium support & SLA", included: true },
    ],
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export default function Pricing() {
  const { isGuest, openAuthModal, user, refreshSubscription, userPlan } = useAuth();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

  const handlePlanCta = async (planKey: string) => {
    if (planKey === "free") {
      if (isGuest) { openAuthModal(); return; }
      window.location.href = `${window.location.origin}${base}/dashboard`;
      return;
    }

    if (isGuest) { openAuthModal(); return; }

    if (userPlan === planKey) {
      toast({ title: "Already on this plan", description: `You're already on the ${planKey} plan.` });
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
        description: "Paystack is not yet set up. Please add VITE_PAYSTACK_PUBLIC_KEY to your environment.",
        variant: "destructive",
      });
      return;
    }

    setLoadingPlan(planKey);
    try {
      await initiatePaystackPayment({
        email: user.email,
        amountCents: PLAN_PRICES_CENTS[planKey] ?? 0,
        currency: "USD",
        metadata: { userId: user.id, planKey },
        onSuccess: async (reference) => {
          toast({ title: "Payment received!", description: "Verifying your upgrade..." });
          try {
            const res = await fetch(`${window.location.origin}${base}/api/subscription/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user.id, reference, planKey }),
            });
            if (res.ok) {
              await refreshSubscription();
              toast({ title: "Plan upgraded!", description: `You're now on the ${planKey.charAt(0).toUpperCase() + planKey.slice(1)} plan.` });
            } else {
              toast({
                title: "Verification failed",
                description: "Payment received but verification failed. Contact support with your reference: " + reference,
                variant: "destructive",
              });
            }
          } catch {
            toast({ title: "Network error", description: "Could not verify payment. Contact support.", variant: "destructive" });
          }
          setLoadingPlan(null);
        },
        onClose: () => setLoadingPlan(null),
      });
    } catch (err) {
      toast({
        title: "Payment error",
        description: err instanceof Error ? err.message : "Could not launch payment. Please try again.",
        variant: "destructive",
      });
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-emerald-400">
          <ShieldCheck className="h-5 w-5" />
          IndiePact
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-20">
        <motion.div {...fadeUp} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            <Zap className="h-3 w-3" /> Simple, Transparent Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Protect every contract.
            <br />
            <span className="text-emerald-400">Pay only for what you need.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Start free. Upgrade when you're ready. Cancel any time. No surprises.
          </p>
        </motion.div>

        {/* Top row: Free, Starter, Pro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          {PLANS.slice(0, 3).map((plan, i) => {
            const isCurrentPlan = !isGuest && userPlan === plan.key;
            const isLoading = loadingPlan === plan.key;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="relative flex flex-col rounded-2xl border p-6 transition-all border-slate-800 bg-[#0a0a0a] hover:border-slate-700"
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                    Current Plan
                  </div>
                )}

                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-bold text-white">{plan.name}</h2>
                    {plan.key === "pro" && <Brain className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="text-3xl font-bold text-white tracking-tight">
                      {plan.price === 0 ? "Free" : `$${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-slate-500 text-sm mb-1">/mo</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs leading-snug">{plan.tagline}</p>
                </div>

                <button
                  onClick={() => void handlePlanCta(plan.key)}
                  disabled={isLoading || isCurrentPlan}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold mb-5 transition-all flex items-center justify-center gap-2 ${
                    isCurrentPlan
                      ? "bg-slate-800 text-slate-500 cursor-default"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                >
                  {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isCurrentPlan ? "Current Plan" : plan.cta}
                </button>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm">
                      {f.included ? (
                        <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-slate-700 mt-0.5 shrink-0" />
                      )}
                      <span className={f.included ? "text-slate-300" : "text-slate-600"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom row: Business (most popular), Agency, Enterprise */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {PLANS.slice(3).map((plan, i) => {
            const isCurrentPlan = !isGuest && userPlan === plan.key;
            const isLoading = loadingPlan === plan.key;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                  plan.popular
                    ? "border-amber-500/40 bg-gradient-to-b from-amber-950/20 to-[#080808] shadow-[0_0_40px_rgba(212,175,55,0.08)]"
                    : "border-slate-800 bg-[#0a0a0a] hover:border-slate-700"
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                    Current Plan
                  </div>
                )}
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                    Most Popular
                  </div>
                )}

                <div className="mb-5">
                  <h2 className={`text-base font-bold mb-1 ${plan.popular ? "text-amber-400" : "text-white"}`}>{plan.name}</h2>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="text-3xl font-bold text-white tracking-tight">${plan.price}</span>
                    <span className="text-slate-500 text-sm mb-1">/mo</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-snug">{plan.tagline}</p>
                </div>

                <button
                  onClick={() => void handlePlanCta(plan.key)}
                  disabled={isLoading || isCurrentPlan}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold mb-5 transition-all flex items-center justify-center gap-2 ${
                    isCurrentPlan
                      ? "bg-slate-800 text-slate-500 cursor-default"
                      : plan.popular
                      ? "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_16px_rgba(212,175,55,0.3)]"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                >
                  {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isCurrentPlan ? "Current Plan" : plan.cta}
                </button>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm">
                      {f.included ? (
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.popular ? "text-amber-400" : "text-emerald-400"}`} />
                      ) : (
                        <X className="h-4 w-4 text-slate-700 mt-0.5 shrink-0" />
                      )}
                      <span className={f.included ? "text-slate-300" : "text-slate-600"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <motion.div {...fadeUp} className="text-center">
          <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl border border-slate-800 bg-[#0a0a0a]">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="font-semibold text-white mb-1">7-day money-back guarantee</p>
              <p className="text-slate-400 text-sm">Not satisfied? We'll refund you completely, no questions asked.</p>
            </div>
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-slate-800/50 px-6 py-6 text-center">
        <p className="text-xs text-slate-600">
          © 2025 IndiePact · <Link href="/" className="hover:text-slate-400">Home</Link>
        </p>
      </footer>
    </div>
  );
}
