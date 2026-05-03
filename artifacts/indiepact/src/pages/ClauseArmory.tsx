import { PageTransition } from "@/components/PageTransition";
import { useState } from "react";
import { Shield, Copy, CheckCircle2, Search, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const BULLETPROOF_CLAUSES = [
  { category: "Payment", title: "Net-14 with Late Fee", clause: "Payment is due within 14 days of invoice date. Unpaid balances accrue interest at 1.5% per month (18% annually).", replaces: "Net-30 or Net-60 terms" },
  { category: "Scope", title: "Revision Cap", clause: "This agreement includes up to 3 revision rounds. Additional revisions are billed at $[RATE]/hour.", replaces: "Unlimited revisions" },
  { category: "IP", title: "Conditional IP Transfer", clause: "All intellectual property transfers to Client upon receipt of full payment. Prior to full payment, Contractor retains all rights.", replaces: "Immediate work-for-hire" },
  { category: "Termination", title: "Kill Fee Protection", clause: "If Client terminates this agreement without cause, Client shall pay 50% of the remaining contract value as a kill fee within 7 days.", replaces: "No-cause termination without compensation" },
  { category: "Liability", title: "Liability Cap", clause: "Contractor's total liability shall not exceed the total fees paid under this agreement in the 3 months preceding the claim.", replaces: "Unlimited liability" },
  { category: "Scope", title: "Change Order Requirement", clause: "Any work outside the defined scope requires a signed Change Order before work begins. Verbal approvals are not binding.", replaces: "Vague scope language" },
  { category: "Payment", title: "Deposit Requirement", clause: "Work commences upon receipt of a 50% non-refundable deposit. The remaining balance is due upon delivery.", replaces: "Payment only upon completion" },
  { category: "IP", title: "Tool & Pre-existing IP Carveout", clause: "Contractor retains ownership of all pre-existing tools, frameworks, and methodologies used in delivering services.", replaces: "Blanket work-for-hire clauses" },
];

export default function ClauseArmory() {
  const [search, setSearch] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const filteredClauses = BULLETPROOF_CLAUSES.filter(
    (c) => 
      c.title.toLowerCase().includes(search.toLowerCase()) || 
      c.category.toLowerCase().includes(search.toLowerCase()) || 
      c.clause.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSwap = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Clause ready to deploy",
      description: "Clause copied to clipboard and ready for insertion.",
    });
  };

  return (
    <PageTransition className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="text-primary h-8 w-8" />
            Clause Armory
          </h1>
          <p className="text-muted-foreground mt-2">Battle-tested protective language, ready to deploy.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search clauses or categories..." 
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredClauses.map((item, idx) => (
          <div key={idx} className="border border-border rounded-xl bg-card flex flex-col overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-start gap-4">
              <div>
                <span className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-medium border border-border mb-2 inline-block">
                  {item.category}
                </span>
                <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handleCopy(item.clause, idx)}
              >
                {copiedIndex === idx ? <CheckCircle2 className="h-3 w-3 mr-1.5 text-primary" /> : <Copy className="h-3 w-3 mr-1.5" />}
                {copiedIndex === idx ? "Copied" : "Copy Clause"}
              </Button>
            </div>
            <div className="p-5 bg-muted/20 flex-1 flex flex-col">
              <div className="font-mono text-sm leading-relaxed text-foreground p-4 bg-background border border-border rounded-lg mb-4 flex-1">
                {item.clause}
              </div>
              <div className="flex items-center justify-between mt-auto pt-2">
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold">Replaces:</span> {item.replaces}
                </div>
                <Button size="sm" onClick={() => handleSwap(item.clause)} className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground ml-4">
                  <ShieldAlert className="w-3 h-3 mr-1.5" /> Swap & Shield
                </Button>
              </div>
            </div>
          </div>
        ))}
        {filteredClauses.length === 0 && (
          <div className="col-span-1 lg:col-span-2 py-12 text-center text-muted-foreground">
            No clauses found matching "{search}".
          </div>
        )}
      </div>
    </PageTransition>
  );
}