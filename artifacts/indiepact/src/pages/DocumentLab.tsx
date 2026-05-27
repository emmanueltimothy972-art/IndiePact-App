import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { Link, useLocation } from "wouter";
import { PLAN_DISPLAY_NAMES, isPaidPlan } from "@/lib/constants";
import { useScanContext } from "@/contexts/ScanContext";
import { SavedScan } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";
import {
  FileText, Zap, UploadCloud, LogIn, AlertTriangle, X,
  CheckCircle2, DollarSign, MessageSquare, Shield, TrendingUp,
  Loader2, FileCheck, Info,
} from "lucide-react";

const PENDING_TEXT_KEY = "indiepact_pending_contract_text";
const PENDING_NAME_KEY = "indiepact_pending_contract_name";

const WHAT_WE_CHECK = [
  { icon: <DollarSign className="h-4 w-4" />, label: "Payment terms & delays" },
  { icon: <Shield className="h-4 w-4" />, label: "IP & ownership clauses" },
  { icon: <AlertTriangle className="h-4 w-4" />, label: "Unfair liability terms" },
  { icon: <MessageSquare className="h-4 w-4" />, label: "Scope creep risks" },
  { icon: <CheckCircle2 className="h-4 w-4" />, label: "Termination & cancellation" },
  { icon: <FileText className="h-4 w-4" />, label: "Non-compete restrictions" },
];

type UploadStage = null | "uploading" | "extracting" | "ready" | "error";

const UPLOAD_STAGE_MESSAGES: Record<string, string> = {
  uploading: "Uploading contract…",
  extracting: "Extracting contract text…",
  ready: "Contract ready for review",
  error: "",
};

export default function DocumentLab() {
  const [contractName, setContractName] = useState("");
  const [contractText, setContractText] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotes, setUploadNotes] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const pendingResult = useRef<ScanResult | null>(null);
  const traceComplete = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [, navigate] = useLocation();
  const { userId, isGuest, isLoading, openAuthModal, userPlan, scansUsed, scansLimit, refreshSubscription } = useAuth();
  const [contractRestored, setContractRestored] = useState(false);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current || isLoading || isGuest) return;
    restoredRef.current = true;
    try {
      const savedText = sessionStorage.getItem(PENDING_TEXT_KEY);
      if (!savedText) return;
      const savedName = sessionStorage.getItem(PENDING_NAME_KEY) ?? "";
      setContractText(savedText);
      if (savedName) setContractName(savedName);
      setContractRestored(true);
      sessionStorage.removeItem(PENDING_TEXT_KEY);
      sessionStorage.removeItem(PENDING_NAME_KEY);
    } catch {}
  }, [isLoading, isGuest]);

  useEffect(() => {
    if (!scanResult) return;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scanResult]);

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
    if (isGuest) {
      try {
        if (contractText.trim().length >= 10) {
          sessionStorage.setItem(PENDING_TEXT_KEY, contractText);
          sessionStorage.setItem(PENDING_NAME_KEY, contractName);
        }
      } catch {}
      openAuthModal("/scan", "review your contract");
      return;
    }
    setContractRestored(false);
    if (isAtLimit) return;
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
          // ── Deduplication hit ─────────────────────────────────────────────
          // The server recognised this contract text and returned a previously
          // stored result.  No quota was consumed and no OpenAI call was made.
          // Skip ForensicTrace, skip saveScan, skip refreshSubscription —
          // just navigate the user straight to their existing scan.
          type WithDedupMeta = ScanResult & {
            _cached?: boolean;
            _cachedScanId?: string;
            _cachedContractName?: string;
          };
          const meta = result as WithDedupMeta;

          if (meta._cached) {
            setShowTrace(false);
            pendingResult.current = null;
            traceComplete.current = false;

            toast({
              title: "Already analyzed",
              description: "This contract was already analyzed. Reopening previous results.",
            });

            if (meta._cachedScanId) {
              navigate(`/scan/${meta._cachedScanId}`);
            } else {
              // Fallback: no ID returned — show inline without saving
              pendingResult.current = result;
              setActiveScan(meta._cachedContractName ?? finalName, result, contractText);
              tryReveal();
            }
            return;
          }

          // ── New scan ──────────────────────────────────────────────────────
          pendingResult.current = result;
          setActiveScan(finalName, result, contractText);
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
                if (saved && (saved as SavedScan).id) updateCacheId(tempId, (saved as SavedScan).id);
                void refreshSubscription();
              },
            }
          );
          tryReveal();
        },
        onError: (err: unknown) => {
          setShowTrace(false);
          pendingResult.current = null;
          traceComplete.current = false;
          const status = (err as { status?: number })?.status;
          const data = (err as { data?: { retryAfter?: number; message?: string } })?.data;
          if (status === 429) {
            const wait = data?.retryAfter ?? 60;
            toast({
              title: "Slow down a little",
              description: `You've submitted several contracts in quick succession. Please wait ${wait} seconds before reviewing another.`,
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "Review Failed",
            description: "Something went wrong. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  // ── Server-side document processing ────────────────────────────────────────

  const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".txt", ".rtf"]);
  const SUPPORTED_MIMES = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/rtf",
    "application/rtf",
    "application/x-rtf",
    "text/richtext",
  ]);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;

    // Client-side format validation — gives instant feedback without a round-trip
    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()!.toLowerCase()
      : "";
    if (!SUPPORTED_MIMES.has(file.type) && !SUPPORTED_EXTENSIONS.has(ext)) {
      setUploadStage("error");
      setUploadError(
        `"${file.name}" is not a supported format. Please upload a PDF, Word document (.docx), plain text (.txt), or RTF file.`
      );
      return;
    }

    setUploadedFileName(file.name);
    setUploadError(null);
    setUploadNotes([]);
    setUploadStage("uploading");

    try {
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

      // Retrieve session token for the Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;

      const formData = new FormData();
      formData.append("file", file);

      // Brief pause so the "Uploading…" stage is visible on fast connections
      await new Promise((r) => setTimeout(r, 400));
      setUploadStage("extracting");

      const response = await fetch(`${base}/api/process-document`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = (await response.json()) as {
        extractedText?: string;
        charCount?: number;
        wordCount?: number;
        format?: string;
        processingNotes?: string[];
        fileName?: string;
        error?: string;
        requiresOcr?: boolean;
      };

      if (!response.ok) {
        setUploadStage("error");
        setUploadError(
          data.error ??
            "We couldn't process this document. Please try again or paste the contract text directly."
        );
        return;
      }

      if (!data.extractedText) {
        setUploadStage("error");
        setUploadError("We couldn't extract text from this file. Please paste the contract text directly.");
        return;
      }

      setContractText(data.extractedText);
      if (!contractName) setContractName(file.name.replace(/\.[^.]+$/, ""));
      setUploadNotes(data.processingNotes ?? []);
      setUploadStage("ready");
    } catch {
      setUploadStage("error");
      setUploadError(
        "Something went wrong while processing this file. Please check your connection and try again, or paste the contract text directly."
      );
    }
  }, [contractName]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      await processFile(file);
    },
    [processFile]
  );

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (isGuest) { openAuthModal("/scan", "upload PDF contracts"); return; }
      if (!isPaidPlan(userPlan)) { setShowProModal(true); return; }
      const file = e.dataTransfer.files?.[0];
      if (file) await processFile(file);
    },
    [isGuest, userPlan, openAuthModal, processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleUploadClick = () => {
    if (isGuest) { openAuthModal("/scan", "upload PDF contracts"); return; }
    if (!isPaidPlan(userPlan)) { setShowProModal(true); return; }
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    setScanResult(null);
    setContractText("");
    setContractName("");
    setUploadedFileName(null);
    setUploadStage(null);
    setUploadError(null);
    setUploadNotes([]);
    setShowTrace(false);
    pendingResult.current = null;
    traceComplete.current = false;
  };

  const isUploadActive = uploadStage === "uploading" || uploadStage === "extracting";

  return (
    <PageTransition className="space-y-6 max-w-4xl mx-auto">
      {scanResult ? (
        <div ref={resultsRef} className="space-y-6">
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
                  <Link
                    href="/pricing"
                    className="bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-8 py-3 rounded-xl text-sm flex items-center gap-2 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Buy One Scan — $9.99
                  </Link>
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

              {/* Input form */}
              {!isAtLimit && (
                <div className="space-y-5">
                  {/* Restored-contract banner */}
                  {contractRestored && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <p className="text-sm text-emerald-300/90 font-medium">
                          Your contract is waiting — ready to review.
                        </p>
                      </div>
                      <button
                        onClick={() => setContractRestored(false)}
                        className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
                        aria-label="Dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  )}

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

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,application/rtf,text/rtf"
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

                      {/* ── Paste tab ────────────────────────────────────────── */}
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

                      {/* ── Upload tab ───────────────────────────────────────── */}
                      <TabsContent value="upload">
                        {isPaidPlan(userPlan) && !isGuest ? (
                          <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={isUploadActive ? undefined : handleUploadClick}
                            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center min-h-[380px] transition-all duration-200 ${
                              isUploadActive
                                ? "cursor-default border-emerald-800/60 bg-[#080d0a]"
                                : dragOver
                                ? "cursor-copy border-emerald-600/70 bg-emerald-950/20"
                                : uploadStage === "ready"
                                ? "cursor-pointer border-emerald-800/50 bg-[#0a0f0b] hover:border-emerald-700/60"
                                : uploadStage === "error"
                                ? "cursor-pointer border-slate-700 bg-[#0c0c0c] hover:border-slate-600"
                                : "cursor-pointer border-emerald-900/50 bg-[#0c0c0c] hover:border-emerald-700/60 hover:bg-[#0d110e] group"
                            }`}
                          >
                            <AnimatePresence mode="wait">

                              {/* ── Active processing ── */}
                              {isUploadActive && (
                                <motion.div
                                  key="processing"
                                  initial={{ opacity: 0, scale: 0.96 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.96 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex flex-col items-center gap-5"
                                >
                                  <div className="relative">
                                    <div className="h-14 w-14 rounded-full bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center">
                                      <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                                    </div>
                                    <div className="absolute inset-0 rounded-full border border-emerald-700/20 animate-ping opacity-20" />
                                  </div>
                                  <div>
                                    <p className="text-slate-200 font-semibold text-base mb-1">
                                      {UPLOAD_STAGE_MESSAGES[uploadStage ?? "uploading"]}
                                    </p>
                                    <p className="text-slate-600 text-xs">
                                      {uploadStage === "uploading"
                                        ? "Sending to secure processing pipeline…"
                                        : "Parsing document structure and clause layout…"}
                                    </p>
                                  </div>
                                  {/* Stage strip */}
                                  <div className="flex items-center gap-3 mt-1">
                                    {["uploading", "extracting"].map((stage) => (
                                      <div key={stage} className="flex items-center gap-1.5">
                                        <div className={`h-1.5 w-1.5 rounded-full ${
                                          uploadStage === stage ? "bg-emerald-400" : "bg-slate-700"
                                        }`} />
                                        <span className={`text-[10px] font-mono ${
                                          uploadStage === stage ? "text-emerald-400" : "text-slate-700"
                                        }`}>
                                          {stage === "uploading" ? "Upload" : "Extract"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}

                              {/* ── Ready state ── */}
                              {uploadStage === "ready" && (
                                <motion.div
                                  key="ready"
                                  initial={{ opacity: 0, scale: 0.96 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="flex flex-col items-center gap-4"
                                >
                                  <div className="h-14 w-14 rounded-full bg-emerald-950/40 border border-emerald-700/50 flex items-center justify-center">
                                    <FileCheck className="h-6 w-6 text-emerald-400" />
                                  </div>
                                  <div>
                                    <p className="text-emerald-300 font-semibold text-base mb-1">
                                      {uploadedFileName}
                                    </p>
                                    <p className="text-slate-500 text-sm mb-1">
                                      Contract text extracted — scroll down and click <strong className="text-slate-400">Review This Contract</strong>.
                                    </p>
                                  </div>
                                  {uploadNotes.length > 0 && (
                                    <div className="flex flex-col gap-1 w-full max-w-xs">
                                      {uploadNotes.map((note, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                          <Info className="h-3 w-3 mt-0.5 shrink-0 text-slate-700" />
                                          <span>{note}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}
                                    className="rounded-xl bg-slate-800/60 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-xs mt-1"
                                  >
                                    Replace File
                                  </Button>
                                </motion.div>
                              )}

                              {/* ── Error state ── */}
                              {uploadStage === "error" && (
                                <motion.div
                                  key="error"
                                  initial={{ opacity: 0, scale: 0.96 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex flex-col items-center gap-4 max-w-sm"
                                >
                                  <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 text-slate-400" />
                                  </div>
                                  <div>
                                    <p className="text-slate-300 font-semibold text-sm mb-2 text-center">
                                      Unable to process document
                                    </p>
                                    <p className="text-slate-500 text-xs leading-relaxed text-center">
                                      {uploadError}
                                    </p>
                                  </div>
                                  <div className="flex gap-2 flex-wrap justify-center">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setUploadStage(null);
                                        setUploadError(null);
                                        handleUploadClick();
                                      }}
                                      className="rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs"
                                    >
                                      Try Another File
                                    </Button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setUploadStage(null);
                                        setUploadError(null);
                                      }}
                                      className="text-xs text-slate-600 hover:text-slate-400 transition-colors px-3"
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                </motion.div>
                              )}

                              {/* ── Idle state ── */}
                              {!uploadStage && (
                                <motion.div
                                  key="idle"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex flex-col items-center"
                                >
                                  <motion.div
                                    animate={dragOver ? { scale: 1.1, y: -4 } : { y: [0, -4, 0] }}
                                    transition={dragOver
                                      ? { duration: 0.15 }
                                      : { duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    className="h-16 w-16 rounded-2xl bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-center mb-5 group-hover:border-emerald-700/70"
                                  >
                                    <UploadCloud className={`h-8 w-8 ${dragOver ? "text-emerald-300" : "text-emerald-400"}`} />
                                  </motion.div>
                                  <h3 className="text-lg font-semibold text-slate-200 mb-2">
                                    {dragOver ? "Drop to process" : "Drag & drop your contract"}
                                  </h3>
                                  <p className="text-slate-500 text-sm mb-1.5 max-w-xs leading-relaxed">
                                    PDF, Word (.docx), plain text (.txt), or RTF — any size.
                                  </p>
                                  <p className="text-slate-600 text-xs mb-6 max-w-xs leading-relaxed">
                                    IndiePact automatically extracts text, handles multi-page documents,
                                    and intelligently prioritizes critical clauses for analysis.
                                  </p>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}
                                    className="rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200"
                                  >
                                    <UploadCloud className="h-3.5 w-3.5 mr-2" />
                                    Choose File
                                  </Button>
                                </motion.div>
                              )}

                            </AnimatePresence>
                          </div>
                        ) : (
                          /* Locked upload zone — not on paid plan */
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
                              PDF, Word (.docx), plain text, or image files.
                            </p>
                            <p className="text-slate-600 text-xs mb-6">
                              Available on the Starter plan and above.
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
                                "Unlock File Upload — Starter+"
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
                      disabled={isAnalyzing || isUploadActive || (!isGuest && !contractText.trim())}
                      className="px-8 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition-all rounded-xl"
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
              <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-lg text-xs font-bold border border-slate-700">
                Starter+
              </span>
              File upload requires the Starter plan
            </DialogTitle>
            <DialogDescription className="text-base pt-2 leading-relaxed">
              Upgrade to Starter ($19/mo) or above to upload PDF, Word, and image files. IndiePact extracts the text automatically — no copying and pasting needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setShowProModal(false)}>Maybe Later</Button>
            <Link href="/pricing">
              <Button
                onClick={() => setShowProModal(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl"
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
