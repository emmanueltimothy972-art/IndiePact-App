import { ScanResult } from "@workspace/api-client-react";
import { RiskCard } from "./RiskCard";
import { DollarSign, ShieldCheck, Target, ArrowRight, Trophy } from "lucide-react";
import { Progress } from "./ui/progress";

const DEFAULT_STEPS = [
  "Request a 48-hour review period before signing.",
  "Identify your top 2 priority clauses to push back on first.",
  "Propose amendments in writing via email to create a paper trail.",
];

export function ScanResultView({ result }: { result: ScanResult }) {
  const extended = result as ScanResult & { pathToVictory?: string[] };
  const steps: string[] = extended.pathToVictory?.length ? extended.pathToVictory : DEFAULT_STEPS;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 border border-border bg-card rounded-xl p-6 shadow-sm flex flex-col justify-center">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">Executive Summary</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {result.moneyImpactSummary}
              </p>
            </div>
          </div>
        </div>

        <div className="border border-border bg-card rounded-xl p-6 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4 relative z-10">Protection Score</h3>
          <div className="relative z-10 w-32 h-32 flex items-center justify-center mb-4">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
              <circle 
                cx="64" 
                cy="64" 
                r="56" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="8" 
                strokeDasharray="351.86"
                strokeDashoffset={351.86 - (351.86 * result.protectionScore) / 100}
                className={result.protectionScore > 75 ? "text-chart-1" : result.protectionScore > 50 ? "text-chart-3" : "text-destructive"} 
                strokeLinecap="round"
              />
            </svg>
            <div className="text-4xl font-bold font-mono tracking-tighter">
              {result.protectionScore}
            </div>
          </div>
        </div>
      </div>

      <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 opacity-10 text-destructive">
          <DollarSign className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-destructive font-semibold flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5" />
              Revenue at Risk
            </h3>
            <p className="text-muted-foreground">The estimated financial exposure if these clauses are exercised against you.</p>
          </div>
          <div className="text-4xl md:text-5xl font-bold font-mono text-destructive tracking-tight">
            ${result.revenueAtRiskMin.toLocaleString()} - ${result.revenueAtRiskMax.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-2xl font-bold tracking-tight">Strategic Observations</h2>
          <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm font-medium">
            {result.risks.length} Issues Found
          </span>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          {result.risks.map((risk, idx) => (
            <RiskCard key={idx} risk={risk} />
          ))}
        </div>
      </div>

      <div className="border border-primary/30 bg-primary/5 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2 text-primary">
          <Trophy className="h-6 w-6 text-primary" />
          Path to Victory
        </h2>
        <ol className="list-decimal pl-6 space-y-3 text-muted-foreground text-lg">
          {steps.map((step, idx) => (
            <li key={idx} className="pl-2">{step}</li>
          ))}
        </ol>
      </div>

      <div className="border border-border bg-card rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-primary" />
          Recommended Next Step
        </h2>
        <p className="text-muted-foreground text-lg">
          {result.nextStep}
        </p>
      </div>
    </div>
  );
}
