import { DEMO_USER_ID } from "@/lib/constants";
import { useState } from "react";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAnalyzeContract, useSaveScan } from "@workspace/api-client-react";
import { ScanResultView } from "@/components/ScanResultView";
import { Loader2, FileText, Zap, ShieldAlert } from "lucide-react";
import { ScanResult } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function DocumentLab() {
  const [contractName, setContractName] = useState("");
  const [contractText, setContractText] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  
  const { mutate: analyzeContract, isPending: isAnalyzing } = useAnalyzeContract();
  const { mutate: saveScan } = useSaveScan();
  const { toast } = useToast();

  const handleAnalyze = () => {
    if (!contractText || contractText.length < 50) {
      toast({
        title: "Insufficient text",
        description: "Please paste at least 50 characters of contract text.",
        variant: "destructive"
      });
      return;
    }

    const finalName = contractName.trim() || "Untitled Contract";

    analyzeContract(
      { data: { contractText, userId: DEMO_USER_ID, contractName: finalName } },
      {
        onSuccess: (result) => {
          setScanResult(result);
          // Auto-save
          saveScan({
            data: {
              userId: DEMO_USER_ID,
              contractName: finalName,
              contractText,
              result
            }
          });
          toast({
            title: "Analysis Complete",
            description: `Found ${result.risks.length} risks in the contract.`,
          });
        },
        onError: () => {
          toast({
            title: "Analysis Failed",
            description: "There was an error analyzing the contract. Please try again.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <PageTransition className="space-y-6 max-w-5xl mx-auto">
      {!scanResult && (
        <div className="mb-8 border-b border-border pb-6">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="text-primary h-8 w-8" />
            Document Lab
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Paste your contract text below. Our engine will scan for scope creep, liability traps, and hidden IP transfers.
          </p>
        </div>
      )}

      {scanResult ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{contractName || "Untitled Contract"}</h1>
              <p className="text-muted-foreground">Analysis Complete</p>
            </div>
            <Button variant="outline" onClick={() => { setScanResult(null); setContractText(""); setContractName(""); }}>
              New Scan
            </Button>
          </div>
          <ScanResultView result={scanResult} />
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="space-y-2">
            <Label htmlFor="contractName" className="text-sm font-medium">Contract Name</Label>
            <Input 
              id="contractName" 
              placeholder="e.g. Acme Corp MSA, Project Phoenix SOW..." 
              value={contractName}
              onChange={(e) => setContractName(e.target.value)}
              className="max-w-md bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractText" className="text-sm font-medium">Contract Text</Label>
            <Textarea 
              id="contractText"
              placeholder="Paste the full text of the contract here..."
              className="min-h-[400px] font-mono text-sm bg-card resize-y"
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button 
              size="lg" 
              onClick={handleAnalyze} 
              disabled={isAnalyzing || !contractText.trim()}
              className="px-8 shadow-[0_0_15px_rgba(0,200,255,0.2)] hover:shadow-[0_0_25px_rgba(0,200,255,0.4)] transition-all font-bold tracking-wide"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Running Forensic Analysis...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  Analyze Contract
                </>
              )}
            </Button>
          </div>

          {isAnalyzing && (
            <div className="mt-8 border border-primary/20 bg-primary/5 rounded-xl p-8 text-center animate-pulse">
              <ShieldAlert className="h-12 w-12 text-primary mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-bold mb-2">Analyzing fine print</h3>
              <p className="text-muted-foreground">Extracting clauses, comparing against benchmarks, and quantifying financial risk...</p>
            </div>
          )}
        </div>
      )}
    </PageTransition>
  );
}
