import { useState, useRef, useCallback } from "react";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAnalyzeContract, useSaveScan } from "@workspace/api-client-react";
import { ScanResultView } from "@/components/ScanResultView";
import { ForensicTrace } from "@/components/ForensicTrace";
import { FileText, Zap, UploadCloud, LogIn } from "lucide-react";
import { ScanResult } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function DocumentLab() {
  const [contractName, setContractName] = useState("");
  const [contractText, setContractText] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const pendingResult = useRef<ScanResult | null>(null);
  const traceComplete = useRef(false);

  const { userId, isGuest, openAuthModal } = useAuth();
  const { mutate: analyzeContract, isPending: isAnalyzing } = useAnalyzeContract();
  const { mutate: saveScan } = useSaveScan();
  const { toast } = useToast();

  const tryReveal = useCallback(() => {
    if (traceComplete.current && pendingResult.current) {
      setScanResult(pendingResult.current);
      pendingResult.current = null;
      traceComplete.current = false;
      setShowTrace(false);
    }
  }, []);

  const handleTraceComplete = useCallback(() => {
    traceComplete.current = true;
    tryReveal();
  }, [tryReveal]);

  const handleAnalyze = () => {
    if (isGuest) {
      openAuthModal();
      return;
    }

    if (!contractText || contractText.length < 50) {
      toast({
        title: "Insufficient text",
        description: "Please paste at least 50 characters of contract text.",
        variant: "destructive",
      });
      return;
    }

    const finalName = contractName.trim() || "Untitled Contract";
    pendingResult.current = null;
    traceComplete.current = false;
    setShowTrace(true);

    analyzeContract(
      { data: { contractText, userId, contractName: finalName } },
      {
        onSuccess: (result) => {
          pendingResult.current = result;
          saveScan({
            data: { userId, contractName: finalName, contractText, result },
          });
          tryReveal();
        },
        onError: () => {
          setShowTrace(false);
          pendingResult.current = null;
          traceComplete.current = false;
          toast({
            title: "Analysis Failed",
            description: "There was an error analyzing the contract. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleUploadClick = () => {
    if (isGuest) {
      openAuthModal();
      return;
    }
    setShowProModal(true);
  };

  const handleReset = () => {
    setScanResult(null);
    setContractText("");
    setContractName("");
    setShowTrace(false);
    pendingResult.current = null;
    traceComplete.current = false;
  };

  return (
    <PageTransition className="space-y-6 max-w-5xl mx-auto">
      {scanResult ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{contractName || "Untitled Contract"}</h1>
              <p className="text-muted-foreground">Analysis Complete</p>
            </div>
            <Button variant="outline" onClick={handleReset}>
              New Scan
            </Button>
          </div>
          <ScanResultView result={scanResult} />
        </div>
      ) : (
        <div className="space-y-8">
          {!showTrace && (
            <div className="border-b border-border pb-6">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <FileText className="text-primary h-8 w-8" />
                Document Lab
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Drop your contract below. We'll extract every clause that puts your money, IP, or time at risk.
              </p>
            </div>
          )}

          {!showTrace && (
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
                    <TabsTrigger value="upload" onClick={handleUploadClick}>
                      Upload File
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="paste">
                    <Textarea
                      id="contractText"
                      placeholder="Paste the full text of the contract here..."
                      className="min-h-[420px] font-mono text-sm bg-card resize-y"
                      value={contractText}
                      onChange={(e) => setContractText(e.target.value)}
                    />
                  </TabsContent>

                  <TabsContent value="upload">
                    <div
                      className="border-2 border-dashed border-border rounded-xl p-16 flex flex-col items-center justify-center text-center cursor-pointer bg-card hover:bg-muted/30 transition-colors min-h-[420px]"
                      onClick={handleUploadClick}
                    >
                      <div className="h-20 w-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                        <UploadCloud className="h-10 w-10 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Drag & drop your contract</h3>
                      <p className="text-muted-foreground text-sm mb-6 max-w-xs">
                        PDF, PNG, or JPG up to 10MB. Our OCR engine extracts clause text with legal-grade accuracy.
                      </p>
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}
                      >
                        {isGuest ? (
                          <><LogIn className="h-4 w-4 mr-2" /> Sign In to Upload</>
                        ) : (
                          "Select File — Pro Feature"
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="flex items-center justify-end gap-4">
                {isGuest && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Sign in to run forensic analysis and save results.
                  </p>
                )}
                <Button
                  size="lg"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || (!isGuest && !contractText.trim())}
                  className="px-10 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all font-bold tracking-wide"
                >
                  {isGuest ? (
                    <><LogIn className="mr-2 h-5 w-5" />Sign In to Scan</>
                  ) : (
                    <><Zap className="mr-2 h-5 w-5" />Run Forensic Analysis</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {showTrace && (
            <ForensicTrace onComplete={handleTraceComplete} />
          )}
        </div>
      )}

      {/* Pro feature modal — only shown to logged-in non-pro users */}
      <Dialog open={showProModal} onOpenChange={setShowProModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded text-xs font-bold border border-[#D4AF37]/30">
                PRO
              </span>
              Pro Intelligence Required
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Upgrade to Pro to access forensic-level OCR scanning — extract contract text from PDFs and images with legal-grade accuracy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setShowProModal(false)}>Maybe Later</Button>
            <Button
              onClick={() => setShowProModal(false)}
              className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-[#0B0E14] font-bold"
            >
              Upgrade to Pro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
