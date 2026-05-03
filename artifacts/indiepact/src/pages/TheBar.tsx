import { PageTransition } from "@/components/PageTransition";
import { DEMO_USER_ID } from "@/lib/constants";
import { useListScans, getListScansQueryKey } from "@workspace/api-client-react";
import { Scale, ArrowRight, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TheBar() {
  const { data, isLoading } = useListScans(
    { userId: DEMO_USER_ID, limit: 1, offset: 0 },
    { query: { queryKey: getListScansQueryKey({ userId: DEMO_USER_ID, limit: 1, offset: 0 }) } }
  );

  const recentScan = data?.scans?.[0];
  const risks = recentScan?.result?.risks || [];

  return (
    <PageTransition className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Scale className="text-primary h-8 w-8" />
            The Bar
            <span className="bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-1 rounded text-xs font-bold border border-[#D4AF37]/30 ml-2 uppercase">Pro</span>
          </h1>
          <p className="text-muted-foreground mt-2">Clause-by-clause risk intelligence for legal professionals.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-primary h-8 w-8" />
        </div>
      ) : (
        <div className="space-y-12">
          {/* Risk Scoring Matrix */}
          <div>
            <h2 className="text-xl font-bold mb-4">Risk Scoring Matrix</h2>
            <div className="border border-border rounded-xl bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4">Clause Excerpt</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Severity</th>
                      <th className="px-6 py-4">Score</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risks.length > 0 ? risks.map((risk, idx) => (
                      <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-6 py-4 font-mono text-xs max-w-xs truncate" title={risk.explanation}>
                          {risk.explanation || risk.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{risk.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${
                            risk.severity === "High" ? "bg-destructive/10 text-destructive border-destructive/20" :
                            risk.severity === "Medium" ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20" :
                            "bg-primary/10 text-primary border-primary/20"
                          }`}>
                            {risk.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono">{risk.severity === "High" ? 25 : risk.severity === "Medium" ? 55 : 80}/100</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs">
                            <ShieldAlert className="w-3 h-3 mr-1" /> Swap & Shield
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                          No recent scan data found. Run a scan in the Document Lab first.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Comparison Engine */}
          <div>
            <h2 className="text-xl font-bold mb-4">Comparison Engine</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              <div className="border border-destructive/30 rounded-xl bg-card flex flex-col h-full">
                <div className="px-4 py-3 border-b border-destructive/20 bg-destructive/10">
                  <h3 className="font-semibold text-destructive flex items-center gap-2">
                    Client's Version
                  </h3>
                </div>
                <div className="p-6 font-mono text-sm leading-relaxed text-muted-foreground flex-1">
                  {risks[0]?.explanation || "No risky clause found to compare."}
                </div>
              </div>

              <div className="hidden md:flex items-center justify-center -mx-4 z-10 absolute left-1/2 -translate-x-1/2 mt-32">
                <div className="bg-background rounded-full p-2 border border-border shadow-sm">
                  <ArrowRight className="text-muted-foreground w-5 h-5" />
                </div>
              </div>

              <div className="border border-primary/30 rounded-xl bg-card flex flex-col h-full">
                <div className="px-4 py-3 border-b border-primary/20 bg-primary/10">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    Protected Version
                  </h3>
                </div>
                <div className="p-6 font-mono text-sm leading-relaxed text-foreground flex-1">
                  {risks[0]?.fixes.rewrittenClause || "No replacement found. Run a scan first."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}