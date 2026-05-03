import { DEMO_USER_ID } from "@/lib/constants";
import { useState } from "react";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAnalyzeContract, useSaveScan } from "@workspace/api-client-react";
import { ScanResultView } from "@/components/ScanResultView";
import { Loader2, FileText, Zap, ShieldAlert, UploadCloud } from "lucide-react";
import { ScanResult } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function DocumentLab() {
  const [contractName, setContractName] = useState("");
  const [contractText, setContractText] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  
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
            Submit your contract below. Our engine will scan for scope creep, liability traps, and hidden IP transfers.
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
            <Label className="text-sm font-medium">Contract Content</Label>
            <Tabs defaultValue="paste" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="paste">Paste Text</TabsTrigger>
                <TabsTrigger value="upload" onClick={() => setShowProModal(true)}>Upload File</TabsTrigger>
              </TabsList>
              
              <TabsContent value="paste">
                <Textarea 
                  id="contractText"
                  placeholder="Paste the full text of the contract here..."
                  className="min-h-[400px] font-mono text-sm bg-card resize-y"
                  value={contractText}
                  onChange={(e) => setContractText(e.target.value)}
                />
              </TabsContent>
              
              <TabsContent value="upload">
                <div 
                  className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer bg-card hover:bg-muted/50 transition-colors h-[400px]"
                  onClick={() => setShowProModal(true)}
                >
                  <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-1">Drag & drop your contract</h3>
                  <p className="text-sm text-muted-foreground mb-4">Supports .pdf, .png, .jpg up to 10MB</p>
                  <Button variant="secondary" onClick={() => setShowProModal(true)}>Select File</Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex justify-end">
            <Button 
              size="lg" 
              onClick={handleAnalyze} 
              disabled={isAnalyzing || !contractText.trim()}
              className="px-8 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all font-bold tracking-wide"
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

      <Dialog open={showProModal} onOpenChange={setShowProModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded text-xs font-bold border border-[#D4AF37]/30">PRO</span>
              Pro Intelligence Required
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Upgrade to Pro to access forensic-level OCR scanning — extract text from PDFs and images with legal-grade accuracy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setShowProModal(false)}>Maybe Later</Button>
            <Button onClick={() => setShowProModal(false)} className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-[#0B0E14]">
              Upgrade to Pro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}