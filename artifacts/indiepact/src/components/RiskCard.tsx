import { useState } from "react";
import { Risk } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, AlertTriangle, ShieldAlert, AlertCircle } from "lucide-react";

export function RiskCard({ risk }: { risk: Risk }) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const handleCopy = (text: string, tab: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const getSeverityIcon = () => {
    switch (risk.severity) {
      case "High": return <ShieldAlert className="h-5 w-5 text-destructive" />;
      case "Medium": return <AlertTriangle className="h-5 w-5 text-chart-3" />;
      case "Low": return <AlertCircle className="h-5 w-5 text-chart-5" />;
      default: return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getSeverityColor = () => {
    switch (risk.severity) {
      case "High": return "border-destructive/50 bg-destructive/10 text-destructive";
      case "Medium": return "border-chart-3/50 bg-chart-3/10 text-chart-3";
      case "Low": return "border-chart-5/50 bg-chart-5/10 text-chart-5";
      default: return "border-muted bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-border bg-muted/20">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-start gap-3">
            <div className="mt-1 shrink-0">{getSeverityIcon()}</div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight leading-tight">{risk.title}</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${getSeverityColor()}`}>
                  {risk.severity} Risk
                </span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                  {risk.category}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4 mt-4 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-1">The Issue</h4>
            <p className="text-muted-foreground leading-relaxed">{risk.explanation}</p>
          </div>
          <div>
            <h4 className="font-medium text-destructive mb-1">Why This Hurts You</h4>
            <p className="text-muted-foreground leading-relaxed">{risk.whyThisHurtsYou}</p>
          </div>
        </div>
      </div>

      <div className="p-5 bg-card">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Actionable Rebuttals
        </h4>
        <Tabs defaultValue="rewritten" className="w-full">
          <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto space-x-6 overflow-x-auto flex-nowrap hide-scrollbar">
            <TabsTrigger value="rewritten" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 font-medium">Rewritten Clause</TabsTrigger>
            <TabsTrigger value="direct" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 font-medium">Direct</TabsTrigger>
            <TabsTrigger value="diplomatic" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 font-medium">Diplomatic</TabsTrigger>
            <TabsTrigger value="legal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 font-medium">Legal</TabsTrigger>
          </TabsList>
          
          <div className="mt-4 relative group">
            <TabsContent value="rewritten" className="m-0">
              <div className="p-4 bg-muted/30 rounded-lg border border-border font-mono text-sm leading-relaxed text-foreground">
                {risk.fixes.rewrittenClause}
              </div>
            </TabsContent>
            <TabsContent value="direct" className="m-0">
              <div className="p-4 bg-muted/30 rounded-lg border border-border font-sans text-sm leading-relaxed text-foreground italic">
                "{risk.fixes.direct}"
              </div>
            </TabsContent>
            <TabsContent value="diplomatic" className="m-0">
              <div className="p-4 bg-muted/30 rounded-lg border border-border font-sans text-sm leading-relaxed text-foreground italic">
                "{risk.fixes.diplomatic}"
              </div>
            </TabsContent>
            <TabsContent value="legal" className="m-0">
              <div className="p-4 bg-muted/30 rounded-lg border border-border font-sans text-sm leading-relaxed text-foreground italic">
                "{risk.fixes.legal}"
              </div>
            </TabsContent>

            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8"
              onClick={() => {
                const activeTab = document.querySelector('[role="tabpanel"]:not([hidden])')?.textContent || "";
                handleCopy(activeTab, 'current');
              }}
            >
              {copiedTab === 'current' ? <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" /> : <Copy className="h-4 w-4 mr-2" />}
              {copiedTab === 'current' ? "Copied" : "Copy"}
            </Button>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
