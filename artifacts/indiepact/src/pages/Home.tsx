import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert, ArrowRight, Upload, ScanSearch, Swords, FileDown,
  CheckCircle2, XCircle, TrendingUp, Lock, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, duration = 2000, prefix = "", suffix = "") {
  const [display, setDisplay] = useState(`${prefix}0${suffix}`);
  const hasStarted = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(eased * target);
            setDisplay(`${prefix}${current.toLocaleString()}${suffix}`);
            if (progress < 1) requestAnimationFrame(tick);
            else setDisplay(`${prefix}${target.toLocaleString()}${suffix}`);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, prefix, suffix]);

  return { ref, display };
}

const COMPARISON_ROWS = [
  {
    category: "Knowledge Base",
    generic: "General training data — not legal-specific",
    indiepact: "Specialized forensic contract database",
  },
  {
    category: "Risk Coverage",
    generic: "Surface-level clause flags only",
    indiepact: "50+ risk categories analyzed per document",
  },
  {
    category: "Jurisdictional Analysis",
    generic: "None — generic advice only",
    indiepact: "Tailored jurisdictional risk assessment",
  },
  {
    category: "Legal Citations",
    generic: "No structured legal references",
    indiepact: "Clause-level citations and precedent",
  },
  {
    category: "Negotiation Rebuttals",
    generic: "Vague suggestions at best",
    indiepact: "Structured war-room rebuttal strategies",
  },
  {
    category: "Output Format",
    generic: "Unstructured chat response",
    indiepact: "Forensic Audit Report — downloadable",
  },
];

const SPOTLIGHT_CLAUSES = [
  {
    tag: "Payment Trap",
    severity: "high" as const,
    clause: `"Payment shall be issued within ninety (90) days of Client's written acceptance of all deliverables, at Client's sole discretion."`,
    detection: "Net-90 + 'sole discretion' = indefinite payment hold. Client controls both the acceptance trigger and the timeline.",
    rebuttal: `"Payment of the remaining balance shall be due within seven (7) calendar days of delivery. Acceptance is deemed granted if no written objection is received within 5 business days."`,
  },
  {
    tag: "IP Grab",
    severity: "high" as const,
    clause: `"All work product, deliverables, concepts, and materials produced by Contractor shall be considered work-for-hire and shall vest exclusively in the Company in perpetuity, irrevocably, without restriction."`,
    detection: "Triple lock: work-for-hire + perpetuity + irrevocable. This clause retroactively claims your process, your tools, and your methodology.",
    rebuttal: `"Upon receipt of full payment, Contractor grants Client a non-exclusive, perpetual license to use final deliverables. All preliminary work, tools, and methodologies remain Contractor's property."`,
  },
  {
    tag: "Scope Creep Trigger",
    severity: "medium" as const,
    clause: `"Contractor shall perform such additional services as may be reasonably required by Client from time to time, without additional compensation, to ensure project success."`,
    detection: "'As may be reasonably required' with 'without additional compensation' is an unlimited scope expansion clause with zero price protection.",
    rebuttal: `"Scope is limited to deliverables in Schedule A. Any additional services shall be subject to a written Change Order executed by both parties before commencement."`,
  },
];

const STEPS = [
  {
    num: "01",
    icon: <Upload className="h-7 w-7 text-emerald-400" />,
    title: "Upload",
    desc: "Drop your PDF, image, or paste message screenshots directly into the Document Lab.",
  },
  {
    num: "02",
    icon: <ScanSearch className="h-7 w-7 text-emerald-400" />,
    title: "Forensic Scan",
    desc: "Our AI engine dissects 50+ risk categories — payment traps, IP grabs, liability landmines, scope creep clauses.",
  },
  {
    num: "03",
    icon: <Swords className="h-7 w-7 text-emerald-400" />,
    title: "War Room",
    desc: "Receive clause-by-clause rebuttals, negotiation language, and capital-protection strategies.",
  },
  {
    num: "04",
    icon: <FileDown className="h-7 w-7 text-emerald-400" />,
    title: "Execute",
    desc: "Download your Forensic Audit Report and walk into every negotiation backed by hard evidence.",
  },
];

function SpotlightSection() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % SPOTLIGHT_CLAUSES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const item = SPOTLIGHT_CLAUSES[active];

  return (
    <section className="px-6 pb-28 max-w-5xl mx-auto w-full">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Clause Spotlight — Live Examples
        </h2>
        <p className="text-slate-400 mt-3 text-base">
          Real contract language IndiePact flags and neutralizes — clause by clause.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        {/* Tab selector */}
        <div className="flex border-b border-slate-800 bg-[#0a0a0a]">
          {SPOTLIGHT_CLAUSES.map((c, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`flex-1 py-3 px-4 font-mono text-xs uppercase tracking-widest transition-colors ${
                i === active
                  ? "text-emerald-400 border-b-2 border-emerald-500 bg-emerald-950/20"
                  : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {c.tag}
            </button>
          ))}
        </div>

        {/* Clause display */}
        <div className="grid grid-cols-1 md:grid-cols-3 bg-[#080808]">
          {/* The Trap */}
          <div className="p-6 border-r border-slate-800/60 space-y-3">
            <div className="flex items-center gap-2 font-mono text-[10px] text-red-400 uppercase tracking-widest">
              <AlertTriangle className="h-3 w-3" /> Predatory Clause
            </div>
            <p className="font-mono text-xs text-slate-300 leading-relaxed">
              {item.clause}
            </p>
          </div>

          {/* IndiePact Detection */}
          <div className="p-6 border-r border-slate-800/60 space-y-3">
            <div className="flex items-center gap-2 font-mono text-[10px] text-amber-400 uppercase tracking-widest">
              <ScanSearch className="h-3 w-3" /> What This Actually Means
            </div>
            <p className="font-mono text-xs text-amber-200/80 leading-relaxed">
              {item.detection}
            </p>
          </div>

          {/* The Fix */}
          <div className="p-6 space-y-3 bg-emerald-950/10">
            <div className="flex items-center gap-2 font-mono text-[10px] text-emerald-400 uppercase tracking-widest">
              <ShieldCheck className="h-3 w-3" /> IndiePact Counter-Clause
            </div>
            <p className="font-mono text-xs text-emerald-300 leading-relaxed">
              {item.rebuttal}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex bg-[#050505] h-0.5">
          {SPOTLIGHT_CLAUSES.map((_, i) => (
            <div key={i} className={`flex-1 transition-colors duration-500 ${i === active ? "bg-emerald-500" : "bg-slate-800"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const accuracy = useCountUp(997, 1800, "", "");
  const capital = useCountUp(60000, 2200, "$", "+");

  return (
    <PageTransition className="min-h-screen bg-[#050505] text-slate-100 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-emerald-400">
          <ShieldAlert className="h-6 w-6" />
          <span>IndiePact AI</span>
        </div>
        <Link href="/scan">
          <Button
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-[0_0_12px_rgba(16,185,129,0.35)] hover:shadow-[0_0_20px_rgba(16,185,129,0.55)] transition-all"
          >
            Run Audit
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      </header>

      <main className="flex-1 flex flex-col">
        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center text-center pt-28 pb-24 px-6 overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute inset-0 -z-10 [background:radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(16,185,129,0.07)_0%,transparent_70%)]" />

          <div className="inline-flex items-center gap-2 border border-emerald-800/60 bg-emerald-950/30 text-emerald-400 text-xs font-mono font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-8">
            <Lock className="h-3 w-3" /> Forensic Contract Intelligence
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.08] max-w-4xl">
            Forensic Contract Audit&nbsp;&amp;
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">
              Revenue Protection.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mt-7">
            The contract scanning engine for independent professionals. We surface financial and legal risk before the client can exploit it — clause by clause, dollar by dollar.
          </p>

          {/* Trust bar */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 mt-9 text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Enterprise-Grade Security</span>
            <span className="text-slate-700 hidden sm:block">|</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Forensic Analysis</span>
            <span className="text-slate-700 hidden sm:block">|</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Built for Independent Professionals</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 mt-11">
            <Link href="/scan">
              <Button
                size="lg"
                className="h-14 px-10 text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_24px_rgba(16,185,129,0.45)] hover:shadow-[0_0_36px_rgba(16,185,129,0.65)] transition-all"
              >
                Start Forensic Audit
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Live metrics */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10 mt-20 pt-10 border-t border-slate-800/60 w-full max-w-lg">
            <div className="flex flex-col items-center gap-1" ref={accuracy.ref}>
              <span className="text-3xl font-mono font-bold text-white tabular-nums">
                {accuracy.display.replace(/(\d+)/, (m) => {
                  const n = parseInt(m);
                  return (n / 10).toFixed(1);
                })}%
              </span>
              <span className="text-xs text-slate-500 uppercase tracking-widest font-mono">Accuracy Rate</span>
            </div>
            <div className="hidden sm:block h-10 w-px bg-slate-800" />
            <div className="flex flex-col items-center gap-1" ref={capital.ref}>
              <span className="text-3xl font-mono font-bold text-emerald-400 tabular-nums">
                {capital.display}
              </span>
              <span className="text-xs text-slate-500 uppercase tracking-widest font-mono">Total Capital Protected</span>
            </div>
          </div>
        </section>

        {/* ── COMPETITIVE COMPARISON ───────────────────────────────── */}
        <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Why Professionals Choose <span className="text-emerald-400">IndiePact</span>
            </h2>
            <p className="text-slate-400 mt-3 text-base">Not all AI is built equal. Forensic work demands forensic tools.</p>
          </div>

          <div className="rounded-xl border border-slate-800 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)]">
            {/* Table header */}
            <div className="grid grid-cols-3 font-mono text-xs uppercase tracking-widest border-b border-slate-800">
              <div className="px-5 py-4 text-slate-500 font-semibold bg-[#0a0a0a]">Category</div>
              <div className="px-5 py-4 text-slate-400 font-semibold bg-[#0d0d0d] border-l border-slate-800 flex items-center gap-2">
                <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                Standard AI Chatbots
              </div>
              <div className="px-5 py-4 text-emerald-400 font-semibold bg-[#071510] border-l border-slate-800 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                IndiePact AI
              </div>
            </div>

            {COMPARISON_ROWS.map((row, i) => (
              <div
                key={row.category}
                className={`grid grid-cols-3 border-b border-slate-800/60 last:border-b-0 ${i % 2 === 0 ? "bg-[#080808]" : "bg-[#060606]"}`}
              >
                <div className="px-5 py-4 font-mono text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  {row.category}
                </div>
                <div className="px-5 py-4 text-sm text-slate-500 border-l border-slate-800/60 font-mono">
                  {row.generic}
                </div>
                <div className="px-5 py-4 text-sm text-emerald-300 border-l border-slate-800/60 font-mono font-medium">
                  {row.indiepact}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
        <section className="px-6 pb-28 max-w-5xl mx-auto w-full">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">How It Works</h2>
            <p className="text-slate-400 mt-3 text-base">Four deliberate steps from document to protection.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="relative flex flex-col gap-5 p-6 rounded-xl border border-slate-800 bg-[#0c0c0c] hover:border-emerald-900 hover:bg-[#0d120f] transition-colors group"
              >
                <div className="absolute top-4 right-5 font-mono text-4xl font-bold text-slate-800 group-hover:text-emerald-950 select-none transition-colors">
                  {step.num}
                </div>
                <div className="h-12 w-12 rounded-lg border border-emerald-900/50 bg-emerald-950/40 flex items-center justify-center">
                  {step.icon}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white mb-2 tracking-tight">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-14">
            <Link href="/scan">
              <Button
                size="lg"
                className="h-14 px-12 text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_24px_rgba(16,185,129,0.4)] hover:shadow-[0_0_36px_rgba(16,185,129,0.6)] transition-all"
              >
                Begin Your Audit
                <TrendingUp className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* ── RISK CATEGORY SPOTLIGHT ──────────────────────────────── */}
        <SpotlightSection />
      </main>

      <footer className="border-t border-slate-800/50 px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-400 font-mono tracking-tight">
          <ShieldAlert className="h-4 w-4" />
          IndiePact AI
        </div>
        <p className="text-xs text-slate-600 font-mono">
          Forensic contract intelligence for independent professionals.
        </p>
      </footer>
    </PageTransition>
  );
}
