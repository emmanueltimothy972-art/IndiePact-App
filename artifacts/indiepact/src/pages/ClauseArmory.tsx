import { PageTransition } from "@/components/PageTransition";
import { useState, useMemo } from "react";
import { Shield, Copy, CheckCircle2, Search, ShieldAlert, Swords, FileText, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useScanContext } from "@/contexts/ScanContext";

// ── Static protective clause library ─────────────────────────────────────────

const BULLETPROOF_CLAUSES = [
  { category: "Payment", title: "Net-14 with Late Fee", clause: "Payment is due within 14 days of invoice date. Unpaid balances accrue interest at 1.5% per month (18% annually).", replaces: "Net-30 or Net-60 terms" },
  { category: "Scope", title: "Revision Cap", clause: "This agreement includes up to 3 revision rounds. Additional revisions are billed at $[RATE]/hour.", replaces: "Unlimited revisions" },
  { category: "IP", title: "Conditional IP Transfer", clause: "All intellectual property transfers to Client upon receipt of full payment. Prior to full payment, Contractor retains all rights.", replaces: "Immediate work-for-hire" },
  { category: "Termination", title: "Kill Fee Protection", clause: "If Client terminates this agreement without cause, Client shall pay 50% of the remaining contract value as a kill fee within 7 days.", replaces: "No-cause termination without compensation" },
  { category: "Liability", title: "Liability Cap", clause: "Contractor's total liability shall not exceed the total fees paid under this agreement in the 3 months preceding the claim.", replaces: "Unlimited liability" },
  { category: "Scope", title: "Change Order Requirement", clause: "Any work outside the defined scope requires a signed Change Order before work begins. Verbal approvals are not binding.", replaces: "Vague scope language" },
  { category: "Payment", title: "Deposit Requirement", clause: "Work commences upon receipt of a 50% non-refundable deposit. The remaining balance is due upon delivery.", replaces: "Payment only upon completion" },
  { category: "IP", title: "Tool & Pre-existing IP Carveout", clause: "Contractor retains ownership of all pre-existing tools, frameworks, and methodologies used in delivering services.", replaces: "Blanket work-for-hire clauses" },
  { category: "Confidentiality", title: "Mutual NDA Scope", clause: "Both parties agree to keep all proprietary information confidential for 2 years following project completion. Exceptions apply only to publicly available information.", replaces: "One-sided or indefinite NDA" },
  { category: "Dispute", title: "Jurisdiction & Governing Law", clause: "Any disputes shall be resolved by binding arbitration in [Your City, State], under [Your State] law. Prevailing party is entitled to reasonable attorney fees.", replaces: "Client's jurisdiction or no clause" },
];

// ── Clause categorization via keyword matching ────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Payment:        ["payment", "invoice", "fee", "compensat", "reimburse", "deposit", "retainer", "net 30", "net 60", "net 90", "late", "overdue"],
  IP:             ["intellectual property", "copyright", "ownership", "work for hire", "proprietary", "license", "rights", "ip ", "i.p."],
  Termination:    ["terminat", "cancel", "end this agreement", "notice period", "kill fee", "expir"],
  Scope:          ["scope", "deliverable", "revision", "change order", "additional work", "out of scope"],
  Liability:      ["liabilit", "indemnif", "hold harmless", "warranty", "damages", "limitation"],
  Confidentiality:["confidential", "non-disclosure", "nda", "proprietary information", "trade secret"],
  Exclusivity:    ["exclusiv", "non-compete", "competitor", "sole", "only contractor"],
  Dispute:        ["dispute", "arbitration", "mediation", "jurisdiction", "governing law", "litigation"],
  Renewal:        ["renew", "auto-renew", "extension", "evergreen", "term"],
};

function categorizeClause(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return "General";
}

const RISK_COLORS: Record<string, string> = {
  High:   "text-red-400 bg-red-950/40 border-red-900/50",
  Medium: "text-amber-400 bg-amber-950/40 border-amber-900/50",
  Low:    "text-emerald-400 bg-emerald-950/40 border-emerald-900/50",
};

export default function ClauseArmory() {
  const [activeTab, setActiveTab] = useState<"contract" | "library">("contract");
  const [search, setSearch] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | string | null>(null);
  const { toast } = useToast();
  const { activeScan, cachedScans } = useScanContext();

  // Resolve scan to show: activeScan → latest cached scan
  const sourceScan = activeScan ?? (cachedScans.length > 0
    ? { contractName: cachedScans[0].contractName, result: cachedScans[0].result, contractText: "" }
    : null);

  // Build categorized clause list from the scan's risks + raw extracted clauses
  const contractClauses = useMemo(() => {
    if (!sourceScan) return [];

    const clauses: Array<{
      id: string;
      category: string;
      text: string;
      riskTitle?: string;
      riskSeverity?: string;
      explanation?: string;
      suggestion?: string;
    }> = [];

    // Primary: use flagged risks (most informative)
    const risks = sourceScan.result?.risks ?? [];
    for (const risk of risks) {
      clauses.push({
        id: `risk-${risk.title}`,
        category: categorizeClause(`${risk.title} ${risk.explanation} ${risk.category}`),
        text: risk.explanation ?? "",
        riskTitle: risk.title,
        riskSeverity: risk.severity,
        explanation: risk.whyThisHurtsYou,
        suggestion: risk.fixes?.rewrittenClause ?? risk.fixes?.direct,
      });
    }

    // Secondary: raw extracted clauses not already captured by risks
    const rawClauses = sourceScan.result?.rawExtractedClauses ?? [];
    for (let i = 0; i < rawClauses.length; i++) {
      const text = rawClauses[i];
      if (!text || text.length < 20) continue;
      const alreadyCovered = clauses.some((c) =>
        c.text.toLowerCase().includes(text.slice(0, 30).toLowerCase())
      );
      if (!alreadyCovered) {
        clauses.push({
          id: `raw-${i}`,
          category: categorizeClause(text),
          text,
        });
      }
    }

    return clauses;
  }, [sourceScan]);

  const filteredContract = useMemo(() =>
    contractClauses.filter((c) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.category.toLowerCase().includes(s) || c.text.toLowerCase().includes(s) || (c.riskTitle ?? "").toLowerCase().includes(s);
    }),
    [contractClauses, search]
  );

  const filteredLibrary = useMemo(() =>
    BULLETPROOF_CLAUSES.filter((c) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.title.toLowerCase().includes(s) || c.category.toLowerCase().includes(s) || c.clause.toLowerCase().includes(s);
    }),
    [search]
  );

  const handleCopy = (text: string, id: number | string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSwap = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Clause ready to deploy", description: "Copied to clipboard — paste it into your contract." });
  };

  const categoryColors: Record<string, string> = {
    Payment: "text-amber-400 border-amber-900/60 bg-amber-950/30",
    IP: "text-purple-400 border-purple-900/60 bg-purple-950/30",
    Termination: "text-red-400 border-red-900/60 bg-red-950/30",
    Scope: "text-blue-400 border-blue-900/60 bg-blue-950/30",
    Liability: "text-orange-400 border-orange-900/60 bg-orange-950/30",
    Confidentiality: "text-cyan-400 border-cyan-900/60 bg-cyan-950/30",
    Exclusivity: "text-rose-400 border-rose-900/60 bg-rose-950/30",
    Dispute: "text-indigo-400 border-indigo-900/60 bg-indigo-950/30",
    Renewal: "text-emerald-400 border-emerald-900/60 bg-emerald-950/30",
    General: "text-slate-400 border-slate-700 bg-slate-900/30",
  };

  return (
    <PageTransition className="space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-950/60 border border-emerald-900/50 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Clause Armory</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Your contract's clauses, decoded — plus battle-tested replacements ready to deploy.
              </p>
            </div>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
            <Input
              placeholder="Search clauses or categories..."
              className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-700"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("contract")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "contract"
              ? "bg-emerald-500 text-black shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <FileText className="h-4 w-4" />
          My Contract
          {contractClauses.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
              activeTab === "contract" ? "bg-black/20 text-black" : "bg-slate-800 text-slate-400"
            }`}>
              {contractClauses.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("library")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "library"
              ? "bg-emerald-500 text-black shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Swords className="h-4 w-4" />
          Clause Library
        </button>
      </div>

      {/* My Contract Tab */}
      {activeTab === "contract" && (
        <div>
          {!sourceScan ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0a0a0a] p-16 text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto">
                <FileText className="h-7 w-7 text-slate-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">No contract reviewed yet</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  Review a contract first and your clauses will appear here, decoded and categorized with negotiation suggestions.
                </p>
              </div>
              <a
                href="/scan"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors"
              >
                <Shield className="h-4 w-4" />
                Review a Contract
              </a>
            </div>
          ) : filteredContract.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              {search ? `No clauses matching "${search}"` : "No clauses extracted from this contract."}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-500 text-sm font-mono">
                Analyzing: <span className="text-slate-300">{sourceScan.contractName}</span>
                {" · "}{filteredContract.length} clause{filteredContract.length !== 1 ? "s" : ""} found
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredContract.map((clause) => {
                  const catColor = categoryColors[clause.category] ?? categoryColors.General;
                  const riskColor = clause.riskSeverity ? RISK_COLORS[clause.riskSeverity] : null;

                  return (
                    <div key={clause.id} className="border border-slate-800 rounded-xl bg-[#0a0a0a] flex flex-col overflow-hidden">
                      {/* Header row */}
                      <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-md border font-medium font-mono ${catColor}`}>
                            {clause.category}
                          </span>
                          {riskColor && (
                            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium font-mono ${riskColor}`}>
                              {clause.riskSeverity} Risk
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-slate-500 hover:text-white shrink-0"
                          onClick={() => handleCopy(clause.text, clause.id)}
                        >
                          {copiedIndex === clause.id
                            ? <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" />
                            : <Copy className="h-3 w-3 mr-1" />}
                          {copiedIndex === clause.id ? "Copied" : "Copy"}
                        </Button>
                      </div>

                      {/* Clause body */}
                      <div className="p-4 flex-1 flex flex-col gap-3">
                        {clause.riskTitle && (
                          <p className="text-sm font-semibold text-white">{clause.riskTitle}</p>
                        )}
                        <div className="font-mono text-xs leading-relaxed text-slate-300 p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                          {clause.text}
                        </div>

                        {clause.explanation && (
                          <div className="flex gap-2 text-xs text-red-400/90 bg-red-950/20 border border-red-900/30 rounded-lg p-3">
                            <AlertIcon />
                            <span className="leading-relaxed">{clause.explanation}</span>
                          </div>
                        )}

                        {clause.suggestion && (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium mb-1.5">
                              <ChevronRight className="h-3 w-3" />
                              Suggested replacement
                            </div>
                            <div className="font-mono text-xs leading-relaxed text-emerald-300 p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-lg">
                              {clause.suggestion}
                            </div>
                            <Button
                              size="sm"
                              className="mt-2 h-7 text-xs bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
                              onClick={() => handleSwap(clause.suggestion!)}
                            >
                              <ShieldAlert className="h-3 w-3 mr-1" />
                              Swap & Shield
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Library Tab */}
      {activeTab === "library" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredLibrary.map((item, idx) => (
            <div key={idx} className="border border-slate-800 rounded-xl bg-[#0a0a0a] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-800 flex justify-between items-start gap-4">
                <div>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium border font-mono mb-2 inline-block ${categoryColors[item.category] ?? categoryColors.General}`}>
                    {item.category}
                  </span>
                  <h3 className="text-base font-semibold text-white tracking-tight">{item.title}</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-slate-500 hover:text-white shrink-0"
                  onClick={() => handleCopy(item.clause, idx)}
                >
                  {copiedIndex === idx
                    ? <CheckCircle2 className="h-3 w-3 mr-1.5 text-emerald-400" />
                    : <Copy className="h-3 w-3 mr-1.5" />}
                  {copiedIndex === idx ? "Copied" : "Copy Clause"}
                </Button>
              </div>
              <div className="p-5 bg-slate-900/20 flex-1 flex flex-col">
                <div className="font-mono text-sm leading-relaxed text-slate-300 p-4 bg-[#0a0a0a] border border-slate-800 rounded-lg mb-4 flex-1">
                  {item.clause}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2">
                  <div className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-400">Replaces:</span> {item.replaces}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSwap(item.clause)}
                    className="h-8 text-xs bg-emerald-500 hover:bg-emerald-400 text-black font-semibold ml-4"
                  >
                    <ShieldAlert className="w-3 h-3 mr-1.5" /> Swap & Shield
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {filteredLibrary.length === 0 && (
            <div className="col-span-1 lg:col-span-2 py-16 text-center text-slate-500">
              No clauses found matching &ldquo;{search}&rdquo;.
            </div>
          )}
        </div>
      )}
    </PageTransition>
  );
}

function AlertIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm1-4H7V5h2v3z"/>
    </svg>
  );
}
