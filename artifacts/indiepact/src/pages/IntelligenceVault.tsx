import { DEMO_USER_ID } from "@/lib/constants";
import { PageTransition } from "@/components/PageTransition";
import { useListScans } from "@workspace/api-client-react";
import { getListScansQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ShieldAlert, ChevronRight, FileText, Calendar, DollarSign, AlertTriangle } from "lucide-react";

export default function IntelligenceVault() {
  const { data, isLoading } = useListScans(
    { userId: DEMO_USER_ID, limit: 50, offset: 0 },
    { query: { queryKey: getListScansQueryKey({ userId: DEMO_USER_ID, limit: 50, offset: 0 }) } }
  );

  return (
    <PageTransition className="space-y-6 max-w-5xl mx-auto">
      <div className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldAlert className="text-primary h-8 w-8" />
          Intelligence Vault
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Complete history of your forensic contract analyses. Review past risk assessments and track your negotiated improvements.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse border border-border"></div>
          ))}
        </div>
      ) : data?.scans.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl bg-card/50">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">The vault is empty</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            You haven't analyzed any contracts yet. Deploy the engine to secure your revenue.
          </p>
          <Link href="/scan" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            Scan First Contract
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.scans.map(scan => (
            <Link key={scan.id} href={`/scan/${scan.id}`}>
              <div className="group flex items-center p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer relative overflow-hidden">
                {/* Score indicator strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${getScoreColor(scan.protectionScore)}`}></div>
                
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">{scan.contractName}</h3>
                    <div className="flex items-center text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                      <Calendar className="h-3 w-3 mr-1" />
                      {format(new Date(scan.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Score:</span>
                      <span className={`font-mono font-bold ${getScoreTextColor(scan.protectionScore)}`}>
                        {scan.protectionScore}/100
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-chart-3" />
                      <span className="text-muted-foreground">Risks:</span>
                      <span className="font-mono font-bold">{scan.riskCount}</span>
                    </div>

                    {(scan.revenueAtRiskMax > 0) && (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-muted-foreground">At Risk:</span>
                        <span className="font-mono font-bold">
                          ${scan.revenueAtRiskMin.toLocaleString()} - ${scan.revenueAtRiskMax.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageTransition>
  );
}

function getScoreColor(score: number) {
  if (score >= 80) return "bg-chart-5";
  if (score >= 50) return "bg-chart-3";
  return "bg-destructive";
}

function getScoreTextColor(score: number) {
  if (score >= 80) return "text-chart-5";
  if (score >= 50) return "text-chart-3";
  return "text-destructive";
}
