import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ScanResult } from "@workspace/api-client-react";
import { Link } from "wouter";
import { PLAN_DISPLAY_NAMES, isPaidPlan } from "@/lib/constants";
import { useScanContext } from "@/contexts/ScanContext";
import { SavedScan } from "@workspace/api-client-react";
import {
  FileText, Zap, UploadCloud, LogIn, AlertTriangle,
  CheckCircle2, DollarSign, MessageSquare, Shield, TrendingUp,
} from "lucide-react";

const WHAT_WE_CHECK = [
  { icon: <DollarSign className="h-4 w-4" />, label: "Payment terms & delays" },
  { icon: <Shield className="h-4 w-4" />, label: "IP & ownership clauses" },
  { icon: <AlertTriangle className="h-4 w-4" />, label: "Unfair liability terms" },
  { icon: <MessageSquare className="h-4 w-4" />, label: "Scope creep risks" },
  { icon: <CheckCircle2 className="h-4 w-4" />, label: "Termination & cancellation" },
  { icon: <FileText className="h-4 w-4" />, label: "Non-compete restrictions" },
];

export default function DocumentLab() {
  const [contractName, setContractName] = useState("");
  const [contractText, setContractText] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const pendingResult = useRef<ScanResult | null>(null);
  const traceComplete = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { userId, isGuest, openAuthModal, userPlan, scansUsed, scansLimit, refreshSubscription } = useAuth();
  const { setActiveScan, addToCache, updateCacheId } = useScanContext();
  const { mutate: analyzeContract, isPending: isAnalyzing } = useAnalyzeContract();
  const { mutate: saveScan } = useSaveScan();
  const { toast } = useToast();

  const reviewsRemaining = Math.max(0, scansLimit - scansUsed);
  const isAtLimit = !isGuest && reviewsRemaining === 0;
  const planLabel = PLAN_DISPLAY_NAMES[userPlan] ?? "Free";

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
    if (isGuest) { openAuthModal(); return; }
    if (isAtLimit) return; // button is disabled, but guard anyway
    if (!contractText || contractText.length < 50) {
      toast({
        title: "Not enough text",
        description: "Please paste at least a few lines of the contract so we can review it.",
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

          // Commit to global store immediately so other pages see it
          setActiveScan(finalName, result);

          // Optimistically add to local cache with a temp ID
          const tempId = `temp_${Date.now()}`;
          const nowIso = new Date().toISOString();
          const optimisticScan: SavedScan = {
            id: tempId,
            userId,
            contractName: finalName,
            contractText,
            result,
            createdAt: nowIso,
            protectionScore: result.protectionScore,
            revenueAtRiskMin: result.revenueAtRiskMin ?? 0,
            revenueAtRiskMax: result.revenueAtRiskMax ?? 0,
            riskCount: result.risks?.length ?? 0,
          };
          addToCache(optimisticScan);

          saveScan(
            { data: { userId, contractName: finalName, contractText, result } },
            {
              onSuccess: (saved) => {
                // Swap temp ID for real DB ID when save succeeds
                if (saved && (saved as SavedScan).id) updateCacheId(tempId, (saved as SavedScan).id);
                void refreshSubscription();
              },
            }
          );
          tryReveal();
        },
        onError: () => {
          setShowTrace(false);
          pendingResult.current = null;
          traceComplete.current = false;
          toast({
            title: "Review Failed",
            description: "Something went wrong. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text && text.length > 10) {
        setContractText(text);
        if (!contractName) setContractName(file.name.replace(/\.[^.]+$/, ""));
        toast({ title: "File loaded", description: `${file.name} ready for review.` });
      } else {
        toast({ title: "Could not read file", description: "Please paste the contract text directly or try a plain-text file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [contractName, toast]);

  const handleUploadClick = () => {
    if (isGuest) { openAuthModal(); return; }
    if (!isPaidPlan(userPlan)) { setShowProModal(true); return; }
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    setScanResult(null);
    setContractText("");
    setContractName("");
    setUploadedFileName(null);
    setShowTrace(false);
    pendingResult.current = null;
    traceComplete.current = false;
  };

  return (
    <PageTransition className="space-y-6 max-w-4xl mx-auto">
      {scanResult ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{contractName || "Untitled Contract"}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Review complete</p>
            </div>
            <Button variant="outline" onClick={handleReset} size="sm">
              Review Another
            </Button>
          </div>
          <ScanResultView result={scanResult} />
        </div>
      ) : (
        <div className="space-y-8">
          {!showTrace && (
            <>
              {/* Usage indicator */}
              {!isGuest && (
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${
                  isAtLimit
                    ? "border-amber-500/30 bg-amber-950/10"
                    : "border-slate-800 bg-[#0a0a0a]"
                }`}>
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`h-3.5 w-3.5 ${isAtLimit ? "text-amber-400" : "text-slate-500"}`} />
                    <span className={isAtLimit ? "text-amber-400" : "text-slate-500"}>
                      {isAtLimit
                        ? "You've used all your reviews this month"
                        : `${reviewsRemaining} review${reviewsRemaining === 1 ? "" : "s"} remaining this month`}
                    </span>
                    <span className="text-slate-700">·</span>
                    <span className="text-slate-600">{planLabel} plan</span>
                  </div>
                  {isAtLimit && (
                    <Link href="/pricing" className="text-amber-400 hover:text-amber-300 font-semibold text-xs transition-colors">
                      Upgrade →
                    </Link>
                  )}
                </div>
              )}

              {/* At-limit upgrade prompt */}
              {isAtLimit && (
                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-950/20 to-[#080808] p-8 flex flex-col items-center text-center gap-5">
                  <div className="h-14 w-14 rounded-2xl bg-amber-950/40 border border-amber-900/50 flex items-center justify-center">
                    <Zap className="h-7 w-7 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg mb-1">Monthly limit reached</p>
                    <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                      You've used all {scansLimit} review{scansLimit === 1 ? "" : "s"} on the {planLabel} plan this month.
                      You can upgrade to a monthly plan — or buy a single forensic review right now for $9.99.
                    </p>
                  </div>

                  {/* $9.99 Pay-Per-Scan — primary option */}
                  <Link
                    href="/pricing"
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-3 rounded-xl text-sm flex items-center gap-2 transition-colors shadow-[0_0_16px_rgba(16,185,129,0.25)]"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Buy One Scan — $9.99
                  </Link>

                  {/* Compare monthly plans — secondary */}
                  <Link
                    href="/pricing"
                    className="text-amber-400 hover:text-amber-300 font-semibold text-xs transition-colors flex items-center gap-1"
                  >
                    <Zap className="h-3.5 w-3.5" /> Compare monthly plans →
                  </Link>

                  <p className="text-xs text-slate-600">Monthly limit resets 30 days from {new Date().toLocaleDateString()}</p>
                </div>
              )}

              {/* Page intro */}
              {!isAtLimit && (
                <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-6">
                  <div className="flex flex-col md:flex-row md:items-start gap-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="h-9 w-9 rounded-xl bg-emerald-950/60 border border-emerald-900/50 flex items-center justify-center">
                          <FileText className="h-4.5 w-4.5 text-emerald-400" />
                        </div>
                        <div>
                          <h1 className="text-xl font-bold tracking-tight">Review a Contract</h1>
                          <p className="text-xs text-slate-500">Paste or upload any contract for an instant AI review</p>
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm leading-relaxed mt-3">
                        IndiePact reads every clause and explains what it means in plain English — no legal jargon.
                        You'll see the risks, the problem clauses, and exactly what to do about them.
                      </p>
                      <p className="text-xs text-slate-600 mt-2 italic">
                        Example: A freelancer checks if a client can legally withhold payment or own their future work.
                      </p>
                    </div>

                    <div className="shrink-0">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">We check for</p>
                      <div className="grid grid-cols-2 gap-2">
                        {WHAT_WE_CHECK.map((item) => (
                          <div key={item.label} className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="text-emerald-600">{item.icon}</span>
                            {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Input form — only shown when not at limit */}
              {!isAtLimit && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="contractName" className="text-sm font-medium text-slate-300">
                      Contract name <span className="text-slate-600 font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="contractName"
                      placeholder="e.g. Acme Corp Freelance Agreement, NDA with Client..."
                      value={contractName}
                      onChange={(e) => setContractName(e.target.value)}
                      className="max-w-lg bg-[#0c0c0c] border-slate-700 text-slate-200 placeholder:text-slate-600 focus-visible:border-emerald-800 focus-visible:ring-emerald-900/30 rounded-xl h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-300">Your contract</Label>
                    {/* Hidden file input for paid upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.pdf,.doc,.docx,.rtf"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    <Tabs defaultValue="paste" className="w-full">
                      <TabsList className="mb-3 bg-[#0c0c0c] border border-slate-800 rounded-xl p-1 h-auto">
                        <TabsTrigger value="paste" className="rounded-lg text-sm data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                          Paste Text
                        </TabsTrigger>
                        <TabsTrigger value="upload" className="rounded-lg text-sm data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                          Upload File
                          {isPaidPlan(userPlan) && !isGuest && (
                            <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              UNLOCKED
                            </span>
                          )}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="paste">
                        <Textarea
                          id="contractText"
                          placeholder="Paste your contract here or type it in. IndiePact will explain everything in plain English — what it means, what the risks are, and what you should do about it."
                          className="min-h-[380px] text-sm bg-[#0c0c0c] border-slate-700 text-slate-200 placeholder:text-slate-600 focus-visible:border-emerald-800 focus-visible:ring-emerald-900/30 rounded-xl resize-y leading-relaxed p-4"
                          value={contractText}
                          onChange={(e) => setContractText(e.target.value)}
                        />
                        {contractText.length > 0 && (
                          <p className="text-xs text-slate-600 mt-1.5 text-right">
                            {contractText.length.toLocaleString()} characters
                          </p>
                        )}
                      </TabsContent>

                      <TabsContent value="upload">
                        {isPaidPlan(userPlan) && !isGuest ? (
                          <div
                            onClick={handleUploadClick}
                            className="border-2 border-dashed border-emerald-900/50 rounded-2xl p-16 flex flex-col items-center justify-center text-center cursor-pointer bg-[#0c0c0c] hover:border-emerald-700/60 hover:bg-[#0d110e] transition-all min-h-[380px] group"
                          >
                            <motion.div
                              animate={{ y: [0, -4, 0] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="h-16 w-16 rounded-2xl bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-center mb-5 group-hover:border-emerald-700/70"
                            >
                              <UploadCloud className="h-8 w-8 text-emerald-400" />
                            </motion.div>
                            {uploadedFileName ? (
                              <>
                                <h3 className="text-lg font-semibold text-emerald-300 mb-2">
                                  {uploadedFileName}
                                </h3>
                                <p className="text-slate-500 text-sm mb-6">File loaded — scroll down and click Review This Contract.</p>
                              </>
                            ) : (
                              <>
                                <h3 className="text-lg font-semibold text-slate-200 mb-2">
                                  Drag & drop your contract
                                </h3>
                                <p className="text-slate-500 text-sm mb-2 max-w-xs leading-relaxed">
                                  PDF, Word (.docx), plain text, or RTF up to 10MB.
                                </p>
                                <p className="text-slate-600 text-xs mb-6">
                                  Our AI reads any format and extracts the text automatically.
                                </p>
                              </>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}
                              className="rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200"
                            >
                              <UploadCloud className="h-3.5 w-3.5 mr-2" />
                              {uploadedFileName ? "Replace File" : "Choose File"}
                            </Button>
                          </div>
                        ) : (
                          <div
                            onClick={handleUploadClick}
                            className="border-2 border-dashed border-slate-700 rounded-2xl p-16 flex flex-col items-center justify-center text-center cursor-pointer bg-[#0c0c0c] hover:border-slate-600 transition-all min-h-[380px] group"
                          >
                            <motion.div
                              animate={{ y: [0, -4, 0] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="h-16 w-16 rounded-2xl bg-emerald-950/40 border border-emerald-900/40 flex items-center justify-center mb-5 group-hover:border-emerald-800/60"
                            >
                              <UploadCloud className="h-8 w-8 text-emerald-400/70" />
                            </motion.div>
                            <h3 className="text-lg font-semibold text-slate-200 mb-2">
                              Drag & drop your contract
                            </h3>
                            <p className="text-slate-500 text-sm mb-2 max-w-xs leading-relaxed">
                              PDF, Word (.docx), or image files up to 10MB.
                            </p>
                            <p className="text-slate-600 text-xs mb-6">
                              Our AI reads any format and extracts the text automatically.
                            </p>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}
                              className="rounded-xl"
                            >
                              {isGuest ? (
                                <><LogIn className="h-3.5 w-3.5 mr-2" /> Sign In to Upload</>
                              ) : (
                                "Choose File — Paid Feature"
                              )}
                            </Button>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-xs text-slate-600 leading-snug max-w-xs">
                      {isGuest
                        ? "Sign in to review contracts and save your results."
                        : contractText.trim().length < 50 && contractText.trim().length > 0
                        ? "Paste more of the contract for a complete review."
                        : "Your contract is private and never shared or sold."}
                    </div>

                    <Button
                      size="lg"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || (!isGuest && !contractText.trim())}
                      className="px-8 bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-[0_0_16px_rgba(16,185,129,0.2)] hover:shadow-[0_0_24px_rgba(16,185,129,0.4)] transition-all rounded-xl"
                    >
                      {isGuest ? (
                        <><LogIn className="mr-2 h-4 w-4" />Sign In to Review</>
                      ) : (
                        <><Zap className="mr-2 h-4 w-4" />Review This Contract</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {showTrace && (
            <ForensicTrace onComplete={handleTraceComplete} />
          )}
        </div>
      )}

      {/* Paid feature modal (file upload) */}
      <Dialog open={showProModal} onOpenChange={setShowProModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-lg text-xs font-bold border border-amber-500/20">
                PAID
              </span>
              File upload is a paid feature
            </DialogTitle>
            <DialogDescription className="text-base pt-2 leading-relaxed">
              Upgrade to any paid plan to upload PDF, Word, and image files. Our AI extracts the text automatically — 
              no copying and pasting needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setShowProModal(false)}>Maybe Later</Button>
            <Link href="/pricing">
              <Button
                onClick={() => setShowProModal(false)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl"
              >
                See Plans & Upgrade
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
