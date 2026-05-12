import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck, ArrowRight, Upload, Zap, MessageSquare,
  FileSearch, AlertTriangle, CheckCircle2, DollarSign,
  FileText, Lock, Star, ChevronRight, ScanSearch, FileDown,
} from "lucide-react";

function useCountUp(target: number, duration = 2000) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - t0) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(Math.floor(eased * target));
          if (p < 1) requestAnimationFrame(tick);
          else setVal(target);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return { ref, val };
}

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55 },
};

const FEATURES = [
  {
    icon: <FileSearch className="h-6 w-6" />,
    title: "Contract Review",
    desc: "Upload any contract and we read the whole thing for you. Every clause, every page.",
    example: "A freelancer checks if a client can legally withhold payment.",
  },
  {
    icon: <AlertTriangle className="h-6 w-6" />,
    title: "Risk Detection",
    desc: "We find the terms that could cost you money, ownership of your work, or your freedom to work with others.",
    example: "An agency discovers a non-compete buried on page 8.",
  },
  {
    icon: <MessageSquare className="h-6 w-6" />,
    title: "Plain English Explanations",
    desc: "Every clause explained like a knowledgeable friend — no legal jargon, no confusing language.",
    example: "\"Indemnification\" explained as: you could be blamed for problems that weren't your fault.",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Negotiation Help",
    desc: "We write better contract language for you so you can push back confidently, professionally, and quickly.",
    example: "A creator rewrites a payment clause from 90 days to 7 days.",
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: "Clause Rewriting",
    desc: "We fix unfair terms and give you language that's ready to copy and send back to the other party.",
    example: "A founder sends a revised IP clause that protects their future work.",
  },
  {
    icon: <DollarSign className="h-6 w-6" />,
    title: "Payment Protection",
    desc: "We catch the traps that lead to slow payments, withheld fees, or unpaid work — before you sign.",
    example: "A developer avoids a \"sole discretion\" clause that could delay payment indefinitely.",
  },
];

const STATS = [
  { label: "Protected in freelance deals", value: 30, prefix: "$", suffix: "M+", color: "text-emerald-400" },
  { label: "Contract reviews completed", value: 12000, prefix: "", suffix: "+", color: "text-white" },
  { label: "Average review time", value: 3, prefix: "< ", suffix: " min", color: "text-white" },
  { label: "Countries using IndiePact", value: 40, prefix: "", suffix: "+", color: "text-white" },
];

const STEPS = [
  {
    num: "01",
    icon: <Upload className="h-7 w-7 text-emerald-400" />,
    title: "Upload or paste your contract",
    desc: "PDF, Word doc, or just paste the text directly. We handle any format.",
  },
  {
    num: "02",
    icon: <ScanSearch className="h-7 w-7 text-emerald-400" />,
    title: "We explain the risks in plain English",
    desc: "IndiePact reads every clause and flags anything that could put your money, rights, or time at risk.",
  },
  {
    num: "03",
    icon: <MessageSquare className="h-7 w-7 text-emerald-400" />,
    title: "Get help before you sign",
    desc: "Receive ready-to-send counter-clauses, negotiation scripts, and clear next steps.",
  },
];

const TESTIMONIALS = [
  {
    quote: "I almost signed away all my future design work. IndiePact caught a clause that would have made every project I create belong to the client — forever. Saved me years of headache.",
    name: "Maya R.",
    role: "Freelance Designer",
    rating: 5,
  },
  {
    quote: "As a startup founder reviewing investor agreements, IndiePact gave me clarity I would have paid $500/hr to a lawyer for. I understood every clause and negotiated two of them successfully.",
    name: "James T.",
    role: "Startup Founder",
    rating: 5,
  },
  {
    quote: "My client slipped in a 90-day payment clause buried in the fine print. IndiePact flagged it, rewrote it to 7 days, and I got paid immediately after delivery.",
    name: "Sofia V.",
    role: "Content Creator",
    rating: 5,
  },
];

const FAQS = [
  {
    q: "Is IndiePact a lawyer?",
    a: "No. IndiePact is an AI tool that helps you understand and review contracts. It provides information and suggestions, not legal advice. For complex situations, we always recommend consulting a qualified attorney.",
  },
  {
    q: "What types of contracts can I review?",
    a: "Any contract — freelance agreements, employment contracts, NDAs, agency agreements, partnership deals, SaaS terms, creator agreements, and more. If it's a contract, we can review it.",
  },
  {
    q: "Is my contract data private?",
    a: "Completely. Your contracts are never shared, sold, or used to train AI models. All data is encrypted and stored securely.",
  },
  {
    q: "How accurate is the AI?",
    a: "Very accurate for identifying common contract risks and explaining legal terms. It's been trained on thousands of real commercial contracts. That said, important decisions should always involve a human professional.",
  },
  {
    q: "Can I cancel my plan anytime?",
    a: "Yes. You can cancel at any time from your account settings. No lock-in, no penalties, no questions asked.",
  },
  {
    q: "What if I don't agree with a flagged risk?",
    a: "You're always in control. IndiePact gives you information and suggestions — what you do with them is entirely up to you.",
  },
];

const SPOTLIGHT_CLAUSES = [
  {
    tag: "Payment Trap",
    clause: `"Payment shall be issued within ninety (90) days of Client's written acceptance of all deliverables, at Client's sole discretion."`,
    plain: "This means the client can delay paying you for 3 months — and they decide when your work is 'accepted.' There's no deadline on their side.",
    fix: `"Payment is due within 7 calendar days of delivery. Work is considered accepted unless written objection is received within 5 business days."`,
  },
  {
    tag: "IP Ownership Grab",
    clause: `"All work product, deliverables, concepts, and materials produced by Contractor shall vest exclusively in the Company in perpetuity, irrevocably, without restriction."`,
    plain: "This means everything you create — your process, tools, and ideas — permanently belong to the client. Even work you do using your own methods.",
    fix: `"Upon full payment, Contractor grants Client a license to use final deliverables. All tools, processes, and preliminary work remain Contractor's property."`,
  },
  {
    tag: "Unlimited Scope Creep",
    clause: `"Contractor shall perform such additional services as may be reasonably required by Client from time to time, without additional compensation."`,
    plain: "This allows the client to keep adding work to the project with no extra pay. There's no limit on how much they can ask for.",
    fix: `"Scope is limited to deliverables in Schedule A. Any additional work requires a signed Change Order with agreed pricing before starting."`,
  },
];

function SpotlightSection({ onReview }: { onReview: () => void }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % SPOTLIGHT_CLAUSES.length), 5000);
    return () => clearInterval(t);
  }, []);
  const item = SPOTLIGHT_CLAUSES[active];

  return (
    <motion.section {...fadeUp} className="px-4 pb-28 max-w-5xl mx-auto w-full">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          See IndiePact in Action
        </h2>
        <p className="text-slate-400 mt-3 text-base max-w-xl mx-auto">
          Real contract language. Real problems. Real fixes — written in plain English.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <div className="flex border-b border-slate-800 bg-[#0a0a0a]">
          {SPOTLIGHT_CLAUSES.map((c, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`flex-1 py-3 px-3 text-xs font-semibold transition-colors ${
                i === active
                  ? "text-emerald-400 border-b-2 border-emerald-500 bg-emerald-950/20"
                  : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {c.tag}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 bg-[#080808]">
          <div className="p-6 border-b md:border-b-0 md:border-r border-slate-800/60 space-y-3">
            <div className="flex items-center gap-2 text-[10px] text-red-400 uppercase tracking-widest font-semibold">
              <AlertTriangle className="h-3 w-3" /> What's in the contract
            </div>
            <p className="text-xs text-slate-300 leading-relaxed italic">{item.clause}</p>
          </div>
          <div className="p-6 border-b md:border-b-0 md:border-r border-slate-800/60 space-y-3">
            <div className="flex items-center gap-2 text-[10px] text-amber-400 uppercase tracking-widest font-semibold">
              <ScanSearch className="h-3 w-3" /> What it actually means
            </div>
            <p className="text-xs text-amber-200/80 leading-relaxed">{item.plain}</p>
          </div>
          <div className="p-6 space-y-3 bg-emerald-950/10">
            <div className="flex items-center gap-2 text-[10px] text-emerald-400 uppercase tracking-widest font-semibold">
              <CheckCircle2 className="h-3 w-3" /> IndiePact's fix
            </div>
            <p className="text-xs text-emerald-300 leading-relaxed italic">{item.fix}</p>
          </div>
        </div>

        <div className="flex bg-[#050505] h-1">
          {SPOTLIGHT_CLAUSES.map((_, i) => (
            <div key={i} className={`flex-1 transition-colors duration-500 ${i === active ? "bg-emerald-500" : "bg-slate-800"}`} />
          ))}
        </div>
      </div>

      <div className="flex justify-center mt-10">
        <Button
          size="lg"
          onClick={onReview}
          className="h-13 px-10 bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-[0_0_24px_rgba(16,185,129,0.35)] hover:shadow-[0_0_36px_rgba(16,185,129,0.55)] transition-all"
        >
          Review My Contract Now
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </motion.section>
  );
}

export default function Home() {
  const { user, isGuest, openAuthModal } = useAuth();
  const userInitial = user?.email ? user.email[0].toUpperCase() : null;

  const stat0 = useCountUp(30, 1600);
  const stat1 = useCountUp(12000, 2000);
  const stat2 = useCountUp(3, 1200);
  const stat3 = useCountUp(40, 1800);
  const statRefs = [stat0.ref, stat1.ref, stat2.ref, stat3.ref];
  const statVals = [stat0.val, stat1.val, stat2.val, stat3.val];

  const handleReviewCta = () => {
    if (isGuest) {
      openAuthModal();
    } else {
      window.location.href = import.meta.env.BASE_URL + "scan";
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 flex flex-col">
      {/* ── HEADER ────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 bg-[#050505]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-emerald-400">
          <ShieldCheck className="h-5 w-5" />
          IndiePact
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        </nav>

        <div className="flex items-center gap-3">
          {isGuest ? (
            <>
              <button
                onClick={openAuthModal}
                className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block"
              >
                Sign In
              </button>
              <Button
                size="sm"
                onClick={handleReviewCta}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-9 px-4 shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all"
              >
                Get Started Free
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button size="sm" variant="outline" className="h-9 border-slate-700 text-slate-300 hover:bg-slate-800">
                  Go to Dashboard
                </Button>
              </Link>
              <div className="h-8 w-8 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-300 font-bold text-sm">
                {userInitial}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* ── 1. HERO ──────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center text-center pt-24 pb-20 px-4 overflow-hidden">
          <div className="absolute inset-0 -z-10 [background:radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(16,185,129,0.08)_0%,transparent_70%)]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:36px_36px]" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 uppercase tracking-widest"
          >
            <Lock className="h-3 w-3" />
            AI Contract Protection
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.07] max-w-4xl"
          >
            Review any contract
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400">
              in minutes.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mt-6"
          >
            IndiePact reads your contracts, spots the risks, and helps you negotiate better deals —
            all explained in plain English. No lawyers needed.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-3 mt-9"
          >
            <Button
              size="lg"
              onClick={handleReviewCta}
              className="h-13 px-10 text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_28px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] transition-all"
            >
              Review Your First Contract Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Link href="/pricing">
              <button className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                See pricing <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 mt-10 text-xs text-slate-500"
          >
            {["No credit card required", "Results in under 3 minutes", "Plain English — always"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {t}
              </span>
            ))}
          </motion.div>
        </section>

        {/* ── 2. WHAT IS INDIEPACT ────────────────────────────────── */}
        <motion.section {...fadeUp} className="px-4 pb-24 max-w-6xl mx-auto w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need to <span className="text-emerald-400">sign with confidence</span>
            </h2>
            <p className="text-slate-400 mt-3 text-base max-w-xl mx-auto">
              IndiePact does the heavy lifting — so you never sign something you don't understand.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="group p-6 rounded-2xl border border-slate-800 bg-[#0a0a0a] hover:border-emerald-900/60 hover:bg-[#0c110e] transition-all cursor-default"
              >
                <div className="h-11 w-11 rounded-xl bg-emerald-950/50 border border-emerald-900/40 flex items-center justify-center text-emerald-400 mb-4 group-hover:border-emerald-800/60 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-3">{f.desc}</p>
                <p className="text-xs text-slate-600 italic border-t border-slate-800/60 pt-3">
                  💡 {f.example}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 3. TRUST METRICS ────────────────────────────────────── */}
        <section className="px-4 pb-24 max-w-5xl mx-auto w-full">
          <motion.div {...fadeUp} className="rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0c0c0c] to-[#080808] p-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Trusted by freelancers, creators, and founders
              </h2>
              <p className="text-slate-500 mt-2 text-sm">Protecting independent professionals, one contract at a time.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {STATS.map((s, i) => (
                <div key={i} className="text-center" ref={statRefs[i]}>
                  <div className={`text-3xl md:text-4xl font-bold tracking-tight ${s.color} tabular-nums`}>
                    {s.prefix}{statVals[i].toLocaleString()}{s.suffix}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── 4. HOW IT WORKS ─────────────────────────────────────── */}
        <motion.section {...fadeUp} className="px-4 pb-24 max-w-5xl mx-auto w-full">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              How IndiePact works
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              Three simple steps from contract to confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
            <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-emerald-900/50 to-transparent" />
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="relative flex flex-col gap-4 p-7 rounded-2xl border border-slate-800 bg-[#0a0a0a] hover:border-emerald-900/50 transition-colors group"
              >
                <div className="absolute top-5 right-5 text-5xl font-bold text-slate-800/60 select-none">
                  {step.num}
                </div>
                <div className="h-12 w-12 rounded-xl border border-emerald-900/50 bg-emerald-950/40 flex items-center justify-center">
                  {step.icon}
                </div>
                <div>
                  <h3 className="font-bold text-white mb-2 leading-snug">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 5. CONTRACT UPLOAD CTA ───────────────────────────────── */}
        <motion.section {...fadeUp} className="px-4 pb-24 max-w-4xl mx-auto w-full">
          <div
            className="rounded-2xl border border-emerald-900/40 p-12 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(5,5,5,0.95) 60%)" }}
          >
            <div className="absolute inset-0 -z-10 [background:radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(16,185,129,0.05)_0%,transparent_70%)]" />
            <Upload className="h-12 w-12 text-emerald-400/60 mx-auto mb-5" />
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Have a contract to review?
            </h2>
            <p className="text-slate-400 text-base max-w-md mx-auto mb-8 leading-relaxed">
              Paste or upload it. IndiePact will read every word and tell you exactly what to watch out for —
              in plain English, in minutes.
            </p>
            <Button
              size="lg"
              onClick={handleReviewCta}
              className="h-13 px-10 bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-[0_0_24px_rgba(16,185,129,0.35)] transition-all"
            >
              Start Reviewing Now
              <FileDown className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </motion.section>

        {/* ── 6. AI SHOWCASE — CLAUSE SPOTLIGHT ───────────────────── */}
        <SpotlightSection onReview={handleReviewCta} />

        {/* ── 7. TESTIMONIALS ─────────────────────────────────────── */}
        <motion.section {...fadeUp} className="px-4 pb-28 max-w-5xl mx-auto w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Freelancers love IndiePact
            </h2>
            <p className="text-slate-400 mt-3 text-base">Real stories from independent professionals.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="flex flex-col gap-4 p-6 rounded-2xl border border-slate-800 bg-[#0a0a0a]"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">"{t.quote}"</p>
                <div>
                  <p className="font-semibold text-white text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 9. FAQ ─────────────────────────────────────────────── */}
        <motion.section {...fadeUp} className="px-4 pb-28 max-w-3xl mx-auto w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Common questions</h2>
            <p className="text-slate-400 mt-3 text-base">Everything you need to know before getting started.</p>
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-slate-800 rounded-xl bg-[#0a0a0a] px-5 overflow-hidden"
              >
                <AccordionTrigger className="text-sm font-semibold text-white hover:text-emerald-400 hover:no-underline py-4 text-left">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 text-sm leading-relaxed pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.section>

        {/* ── 10. FINAL CTA ─────────────────────────────────────── */}
        <motion.section {...fadeUp} className="px-4 pb-28 max-w-3xl mx-auto w-full text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Stop signing contracts you don't understand.
          </h2>
          <p className="text-slate-400 text-base mb-8 max-w-lg mx-auto leading-relaxed">
            Join thousands of freelancers, creators, and founders who use IndiePact to protect their work, money, and rights.
          </p>
          <Button
            size="lg"
            onClick={handleReviewCta}
            className="h-13 px-12 text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_28px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] transition-all"
          >
            Get Started — It's Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-xs text-slate-600 mt-4">No credit card needed · Cancel anytime</p>
        </motion.section>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/50 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 font-bold text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            IndiePact
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <Link href="/pricing" className="hover:text-slate-300 transition-colors">Pricing</Link>
            <Link href="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
            <Link href="/scan" className="hover:text-slate-300 transition-colors">Review a Contract</Link>
          </div>
          <p className="text-xs text-slate-700">
            © 2025 IndiePact · AI contract protection for independent professionals
          </p>
        </div>
      </footer>
    </div>
  );
}
