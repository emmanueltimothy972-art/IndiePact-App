import { PageTransition } from "@/components/PageTransition";
import { useGetScan, getGetScanQueryKey } from "@workspace/api-client-react";
import { ScanResultView } from "@/components/ScanResultView";
import { useParams, Link } from "wouter";
import { ArrowLeft, Calendar, FileText, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useScanContext } from "@/contexts/ScanContext";

export default function ScanDetail() {
  const params = useParams();
  const scanId = params.scanId as string;
  const { userId } = useAuth();
  const { getFromCache, cachedScans, activeScan } = useScanContext();

  const { data: scan, isLoading, error } = useGetScan(
    scanId,
    { userId },
    { query: { enabled: !!scanId, queryKey: getGetScanQueryKey(scanId, { userId }), retry: 1 } }
  );

  if (isLoading) {
    return (
      <PageTransition className="space-y-8 max-w-5xl mx-auto">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 md:col-span-2 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageTransition>
    );
  }

  // Resolved scan: prefer API result → cache by ID → active scan (name match) → any first cached
  const resolvedScan = scan
    ?? getFromCache(scanId)
    ?? (activeScan && cachedScans.find((s) => s.contractName === activeScan.contractName))
    ?? null;

  if (error && !resolvedScan) {
    return (
      <PageTransition className="max-w-5xl mx-auto">
        <Link
          href="/history"
          className="inline-flex items-center text-sm text-slate-500 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Reviews
        </Link>
        <div className="rounded-2xl border border-slate-800 bg-[#0a0a0a] p-16 text-center space-y-5">
          <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto">
            <WifiOff className="h-8 w-8 text-slate-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Review not found</h2>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              This review isn't in your history yet. It may still be saving — try again in a moment, or head back to view your completed reviews.
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <Link
              href="/history"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              My Reviews
            </Link>
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-colors"
            >
              Review a Contract
            </Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!resolvedScan) return null;

  const displayedAt = resolvedScan.createdAt
    ? format(new Date(resolvedScan.createdAt), "MMM d, yyyy h:mm a")
    : "Just now";

  const isCachedOnly = !scan && !!resolvedScan;

  return (
    <PageTransition className="space-y-6 max-w-5xl mx-auto pb-20">
      <Link
        href="/history"
        className="inline-flex items-center text-sm text-slate-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to My Reviews
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-white">
            <FileText className="text-emerald-500 h-8 w-8" />
            {resolvedScan.contractName}
          </h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="flex items-center gap-1.5 text-slate-500 text-sm bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg font-mono">
              <Calendar className="h-3.5 w-3.5" />
              {displayedAt}
            </span>
            {isCachedOnly && (
              <span className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900/50 px-2 py-0.5 rounded-md font-mono">
                cached locally
              </span>
            )}
          </div>
        </div>
      </div>

      <ScanResultView result={resolvedScan.result} />
    </PageTransition>
  );
}
