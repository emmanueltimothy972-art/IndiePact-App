import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Check, X, ArrowLeft, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const PLANS = [
  {
    name: "Free",
    price: 0,
    period: "forever",
    tagline: "See if IndiePact is right for you.",
    cta: "Start Free",
    featured: false,
    features: [
      { text: "2 contract reviews per month", included: true },
      { text: "Basic risk detection", included: true },
      { text: "Plain English explanations", included: true },
      { text: "Limited negotiation hints", included: true },
      { text: "Negotiation assistant", included: false },
      { text: "Export reports", included: false },
      { text: "Save review history", included: false },
      { text: "Priority processing", included: false },
    ],
  },
  {
    name: "Starter",
    price: 19,
    period: "per month",
    tagline: "For freelancers reviewing contracts regularly.",
    cta: "Most Popular",
    featured: false,
    features: [
      { text: "25 contract reviews per month", included: true },
      { text: "Full risk detection", included: true },
      { text: "Plain English explanations", included: true },
      { text: "Negotiation assistant", included: true },
      { text: "Clause rewrite suggestions", included: true },
      { text: "Save review history", included: true },
      { text: "Export reports", included: false },
      { text: "Priority processing", included: false },
    ],
  },
  {
    name: "Pro",
    price: 49,
    period: "per month",
    tagline: "For serious freelancers and small agencies.",
    cta: "Go Pro",
    featured: true,
    features: [
      { text: "100 contract reviews per month", included: true },
      { text: "Advanced AI analysis", included: true },
      { text: "Deep risk analysis", included: true },
      { text: "Full negotiation war room", included: true },
      { text: "Smart clause rewriting", included: true },
      { text: "Export to PDF", included: true },
      { text: "Team sharing", included: true },
      { text: "Priority processing", included: true },
    ],
  },
  {
    name: "Elite",
    price: 199,
    period: "per month",
    tagline: "Built for agencies and power users.",
    cta: "Contact Us",
    featured: false,
    features: [
      { text: "Unlimited contract reviews", included: true },
      { text: "Fastest AI processing", included: true },
      { text: "Multi-document analysis", included: true },
      { text: "Full negotiation war room", included: true },
      { text: "Advanced AI strategy engine", included: true },
      { text: "Agency & team tools", included: true },
      { text: "Export to PDF & DOCX", included: true },
      { text: "Premium support", included: true },
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
  const { isGuest, openAuthModal } = useAuth();

  const handleCta = () => {
    if (isGuest) openAuthModal();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100">
      {/* Header */}
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

      <main className="max-w-6xl mx-auto px-4 py-20">
        {/* Heading */}
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

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                plan.featured
                  ? "border-emerald-500/50 bg-gradient-to-b from-emerald-950/30 to-[#080808] shadow-[0_0_40px_rgba(16,185,129,0.12)]"
                  : "border-slate-800 bg-[#0a0a0a] hover:border-slate-700"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                  Best Value
                </div>
              )}

              <div className="mb-6">
                <h2 className={`text-base font-bold mb-1 ${plan.featured ? "text-emerald-400" : "text-white"}`}>
                  {plan.name}
                </h2>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-4xl font-bold text-white tracking-tight">
                    ${plan.price}
                  </span>
                  <span className="text-slate-500 text-sm mb-1">/{plan.price === 0 ? "free" : "mo"}</span>
                </div>
                <p className="text-slate-400 text-xs leading-snug">{plan.tagline}</p>
              </div>

              <button
                onClick={handleCta}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold mb-6 transition-all ${
                  plan.featured
                    ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.5)]"
                    : "bg-slate-800 hover:bg-slate-700 text-white"
                }`}
              >
                {plan.cta}
              </button>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm">
                    {f.included ? (
                      <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-slate-700 mt-0.5 shrink-0" />
                    )}
                    <span className={f.included ? "text-slate-300" : "text-slate-600"}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Guarantee */}
        <motion.div {...fadeUp} className="mt-16 text-center">
          <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl border border-slate-800 bg-[#0a0a0a]">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="font-semibold text-white mb-1">7-day money-back guarantee</p>
              <p className="text-slate-400 text-sm">Not satisfied? We'll refund you completely, no questions asked.</p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 px-6 py-6 text-center">
        <p className="text-xs text-slate-600">
          © 2025 IndiePact · <Link href="/" className="hover:text-slate-400">Home</Link>
        </p>
      </footer>
    </div>
  );
}
