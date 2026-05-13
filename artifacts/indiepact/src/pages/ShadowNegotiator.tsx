import { PageTransition } from "@/components/PageTransition";
import { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Swords, Search, Copy, CheckCircle2, Send, Loader2, ShieldCheck,
  AlertTriangle, ShieldAlert, AlertCircle, Scale, ChevronRight, RefreshCw,
  TrendingDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const DANGER_WORDS = [
  "indemnify", "indemnification", "perpetuity", "sole discretion", "unlimited",
  "irrevocable", "hold harmless", "all rights", "work for hire", "work-for-hire",
  "without notice", "without cause", "forfeit", "no compensation",
  "liable", "liability", "consequential damages", "at client's discretion",
  "as needed", "net 90", "net-90", "net 60", "net-120", "royalty-free",
  "exclusive property", "all intellectual property", "upon acceptance",
  "until satisfied", "unlimited revisions", "best efforts",
];

function HighlightDanger({ text }: { text: string }) {
  const escaped = DANGER_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <span>
      {parts.map((part, i) =>
        DANGER_WORDS.some((w) => w.toLowerCase() === part.toLowerCase()) ? (
          <mark
            key={i}
            className="bg-red-950/70 text-red-400 border-b border-red-700 not-italic font-semibold px-0.5 rounded-sm"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

type Risk = {
  title: string;
  severity: "Low" | "Medium" | "High";
  explanation: string;
  whyThisHurtsYou: string;
  category: string;
  fixes: {
    rewrittenClause: string;
    direct: string;
    diplomatic: string;
    legal: string;
  };
};

type ScanItem = {
  id: string;
  contractName: string;
  result: { risks: Risk[]; protectionScore: number };
};

type ChatMessage = { role: "user" | "ai"; content: string };

const QUALIFYING_QUESTIONS = [
  "Is this a Work-for-Hire agreement or a Service Agreement? Specify the exact agreement type.",
  "What is the specific jurisdiction (state/country) governing this contract?",
  "What is the total financial exposure of this deal — the full contract value?",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-400 transition-colors shrink-0 font-mono"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "High") return (
    <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-red-800/60 bg-red-950/40 text-red-400">
      <ShieldAlert className="h-3 w-3" /> STRUCTURAL VULNERABILITY
    </span>
  );
  if (severity === "Medium") return (
    <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-700/50 bg-amber-950/30 text-amber-400">
      <AlertTriangle className="h-3 w-3" /> UNREASONABLE RISK
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-800/50 bg-emerald-950/30 text-emerald-400">
      <AlertCircle className="h-3 w-3" /> STRATEGIC OBSERVATION
    </span>
  );
}

export default function ShadowNegotiator() {
  const { userId } = useAuth();
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string>("");
  const [selectedRisks, setSelectedRisks] = useState<Risk[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [qualifyingStep, setQualifyingStep] = useState(0);
  const [qualifyingAnswers, setQualifyingAnswers] = useState<string[]>([]);
  const [caseContext, setCaseContext] = useState<{ agreementType: string; jurisdiction: string; financialExposure: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTableLoading(true);
    fetch(`${base}/api/scans?userId=${userId}&limit=10`)
      .then((r) => r.json())
      .then((d) => {
        const items = d.scans || [];
        setScans(items);
        if (items.length > 0) {
          setSelectedScanId(items[0].id);
          setSelectedRisks(items[0].result?.risks || []);
        }
      })
      .catch(() => {})
      .finally(() => setTableLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedScanId) return;
    const scan = scans.find((s) => s.id === selectedScanId);
    if (scan) setSelectedRisks(scan.result?.risks || []);
  }, [selectedScanId, scans]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: "ai", content: QUALIFYING_QUESTIONS[0] }]);
      setQualifyingStep(1);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    if (qualifyingStep < QUALIFYING_QUESTIONS.length) {
      const newAnswers = [...qualifyingAnswers, userMsg];
      setQualifyingAnswers(newAnswers);
      const nextStep = qualifyingStep + 1;
      setQualifyingStep(nextStep);

      if (nextStep < QUALIFYING_QUESTIONS.length) {
        setTimeout(() => {
          setMessages((prev) => [...prev, { role: "ai", content: QUALIFYING_QUESTIONS[nextStep] }]);
          setIsLoading(false);
        }, 600);
        return;
      }

      const ctx = {
        agreementType: newAnswers[0] || "Not specified",
        jurisdiction: newAnswers[1] || "Not specified",
        financialExposure: newAnswers[2] || userMsg,
      };
      setCaseContext(ctx);

      setTimeout(() => {
        const openingBrief = `Case file logged. Agreement type: ${ctx.agreementType}. Jurisdiction: ${ctx.jurisdiction}. Financial exposure: ${ctx.financialExposure}.\n\nI've reviewed your intake. Now — walk me through the clause or situation you want me to dissect. Be precise. I'll tell you what it means, what it costs you, and exactly what to say.`;
        setMessages((prev) => [...prev, { role: "ai", content: openingBrief }]);
        setIsLoading(false);
      }, 800);
      return;
    }

    try {
      const history = newMessages
        .filter((m) => m.role !== "ai" || newMessages.indexOf(m) > 0)
        .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));

      const res = await fetch(`${base}/api/prosecutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history, caseContext }),
      });
      if (!res.ok) throw new Error("API failed");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "Connection interrupted. Stand by." }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, qualifyingStep, qualifyingAnswers, caseContext]);

  const resetProsecutor = () => {
    setMessages([{ role: "ai", content: QUALIFYING_QUESTIONS[0] }]);
    setQualifyingStep(1);
    setQualifyingAnswers([]);
    setCaseContext(null);
    setInput("");
  };

  return (
    <PageTransition className="space-y-0 max-w-7xl mx-auto">
      <div className="border-b border-border pb-5 mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Swords className="text-primary h-8 w-8" />
          War Room — Forensic Analysis Dashboard
        </h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          INDIEPACT / FORENSIC DISCOVERY / CONTRACT INTELLIGENCE SUITE
        </p>
      </div>

      <Tabs defaultValue="table">
        <TabsList className="border border-border bg-card rounded-lg mb-6 p-1 h-auto gap-1">
          <TabsTrigger
            value="table"
            className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-xs uppercase tracking-widest px-5 py-2"
          >
            <Search className="h-3.5 w-3.5 mr-2" />
            Forensic Discovery Table
          </TabsTrigger>
          <TabsTrigger
            value="prosecutor"
            className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono text-xs uppercase tracking-widest px-5 py-2"
          >
            <Scale className="h-3.5 w-3.5 mr-2" />
            The Prosecutor
          </TabsTrigger>
        </TabsList>

        {/* ── FORENSIC DISCOVERY TABLE ───────────────────────────────── */}
        <TabsContent value="table" className="mt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Case File:</span>
              {scans.length > 0 ? (
                <Select value={selectedScanId} onValueChange={setSelectedScanId}>
                  <SelectTrigger className="h-8 text-xs font-mono bg-card border-border w-[280px]">
                    <SelectValue placeholder="Select a scan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {scans.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
                        {s.contractName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground font-mono">No scans found — run a scan in Document Lab first</span>
              )}
            </div>
            {selectedRisks.length > 0 && (
              <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-1 rounded">
                {selectedRisks.length} FINDING{selectedRisks.length !== 1 ? "S" : ""} LOADED
              </span>
            )}
          </div>

          {/* Revenue Stress Test score — computed inline from selected risks */}
          {!tableLoading && selectedRisks.length > 0 && (() => {
            let score = 100;
            for (const r of selectedRisks) {
              if (r.category === "paymentDelay") score -= r.severity === "High" ? 30 : r.severity === "Medium" ? 18 : 8;
              if (r.category === "scopeCreep")   score -= r.severity === "High" ? 22 : r.severity === "Medium" ? 12 : 5;
              if (r.category === "liability")    score -= r.severity === "High" ? 25 : r.severity === "Medium" ? 14 : 0;
              if (r.category === "termination")  score -= r.severity === "High" ? 20 : r.severity === "Medium" ? 10 : 0;
            }
            score = Math.max(0, Math.min(100, score));
            const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
            const label = score >= 70 ? "LOW FRICTION" : score >= 40 ? "MODERATE RISK" : "HIGH EXPOSURE";
            const circumference = 2 * Math.PI * 28;
            const dashOffset = circumference - (circumference * score) / 100;
            const highCount = selectedRisks.filter(r => r.severity === "High").length;
            const medCount  = selectedRisks.filter(r => r.severity === "Medium").length;
            return (
              <div className="mb-5 flex items-center gap-5 px-5 py-3.5 rounded-xl border border-border bg-[#050505]">
                <TrendingDown className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Revenue Stress Test</span>
                <div className="flex items-center gap-2">
                  <svg className="-rotate-90 shrink-0" width="36" height="36" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
                    <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="6"
                      strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
                      style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
                    />
                  </svg>
                  <span className="text-base font-mono font-bold tabular-nums" style={{ color }}>{score}</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-widest"
                  style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}>
                  {label}
                </span>
                <div className="flex items-center gap-3 ml-auto text-[10px] font-mono text-muted-foreground">
                  {highCount > 0 && <span className="text-red-400">{highCount} HIGH</span>}
                  {medCount > 0 && <span className="text-amber-400">{medCount} MEDIUM</span>}
                  <span>{selectedRisks.length - highCount - medCount} LOW</span>
                </div>
              </div>
            );
          })()}

          {tableLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground font-mono text-sm animate-pulse">
              Retrieving case file...
            </div>
          ) : selectedRisks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border rounded-xl text-center gap-4">
              <ShieldCheck className="h-12 w-12 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">No findings loaded</p>
                <p className="text-xs text-muted-foreground mt-1">Run a forensic scan to populate this table</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-3 border-b border-border bg-[#050505]">
                <div className="px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-red-400 border-r border-border flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" /> Col A — Predatory Clause
                </div>
                <div className="px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-emerald-400 border-r border-border flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3" /> Col B — The Shield
                </div>
                <div className="px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-blue-400 flex items-center gap-2">
                  <Scale className="h-3 w-3" /> Col C — Rebuttal Strategy
                </div>
              </div>

              {selectedRisks.map((risk, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-3 border-b border-border/60 last:border-b-0 ${idx % 2 === 0 ? "bg-card/40" : "bg-card/20"}`}
                >
                  {/* Column A: Predatory Clause */}
                  <div className="px-5 py-5 border-r border-border/60 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <SeverityBadge severity={risk.severity} />
                    </div>
                    <p className="font-mono text-xs text-slate-300 leading-relaxed">
                      <HighlightDanger text={risk.explanation} />
                    </p>
                    <p className="font-mono text-[11px] text-red-400/80 leading-relaxed italic">
                      {risk.whyThisHurtsYou}
                    </p>
                    <span className="inline-block text-[10px] font-mono text-muted-foreground border border-border px-2 py-0.5 rounded">
                      {risk.category}
                    </span>
                  </div>

                  {/* Column B: The Shield */}
                  <div className="px-5 py-5 border-r border-border/60 space-y-3">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                      Protective Counter-Clause
                    </span>
                    <div className="p-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20">
                      <p className="font-mono text-xs text-emerald-300 leading-relaxed">
                        {risk.fixes.rewrittenClause}
                      </p>
                    </div>
                    <CopyButton text={risk.fixes.rewrittenClause} />
                  </div>

                  {/* Column C: Rebuttal Strategy */}
                  <div className="px-5 py-5 space-y-3">
                    <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">
                      Attorney's Voice — Direct Script
                    </span>
                    <div className="p-3 rounded-lg border border-blue-900/30 bg-blue-950/10">
                      <p className="text-xs text-blue-200 leading-relaxed italic">
                        "{risk.fixes.direct}"
                      </p>
                    </div>
                    <div className="mt-2">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Legal Citation</span>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {risk.fixes.legal}
                      </p>
                    </div>
                    <CopyButton text={`${risk.fixes.direct}\n\n${risk.fixes.legal}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── THE PROSECUTOR ────────────────────────────────────────── */}
        <TabsContent value="prosecutor" className="mt-0">
          <div className="h-[calc(100vh-18rem)] flex flex-col border border-border rounded-xl bg-card overflow-hidden relative">
            {/* Header bar */}
            <div className="px-5 py-3 border-b border-border bg-[#050505] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  THE PROSECUTOR — Active Investigation
                </span>
                {caseContext && (
                  <span className="font-mono text-[10px] border border-border px-2 py-0.5 rounded text-muted-foreground">
                    {caseContext.agreementType} · {caseContext.jurisdiction}
                  </span>
                )}
              </div>
              <button onClick={resetProsecutor} className="text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Qualifying progress bar */}
            {qualifyingStep < QUALIFYING_QUESTIONS.length && (
              <div className="px-5 py-2 border-b border-border bg-amber-950/20 shrink-0 flex items-center gap-3">
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">Case Intake</span>
                <div className="flex gap-1.5">
                  {QUALIFYING_QUESTIONS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 w-8 rounded-full transition-colors ${i < qualifyingStep ? "bg-emerald-500" : i === qualifyingStep ? "bg-amber-400 animate-pulse" : "bg-border"}`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {qualifyingStep}/{QUALIFYING_QUESTIONS.length} qualifying questions
                </span>
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" && (
                    <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-mono text-[10px] font-bold mr-3 mt-1 shrink-0">
                      AI
                    </div>
                  )}
                  <div className={`max-w-[78%] rounded-xl px-5 py-3.5 text-sm leading-relaxed shadow-sm font-mono ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground border border-border rounded-tl-sm"
                  }`}>
                    {msg.content.split("\n").map((line, j) => (
                      <span key={j}>{line}{j < msg.content.split("\n").length - 1 && <br />}</span>
                    ))}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-mono text-[10px] font-bold mr-3 mt-1 shrink-0">AI</div>
                  <div className="bg-muted border border-border rounded-xl rounded-tl-sm px-5 py-4 flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-background border-t border-border shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-3 relative">
                <Input
                  placeholder={qualifyingStep < QUALIFYING_QUESTIONS.length ? "Answer the intake question above..." : "State the clause or situation for investigation..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 bg-card border-border pr-12 h-12 font-mono text-sm"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="absolute right-1.5 h-9 w-9 rounded-md"
                  disabled={!input.trim() || isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
