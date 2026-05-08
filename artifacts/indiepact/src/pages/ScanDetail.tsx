import { PageTransition } from "@/components/PageTransition";
import { useGetScan, getGetScanQueryKey } from "@workspace/api-client-react";
import { ScanResultView } from "@/components/ScanResultView";
import { useParams, Link } from "wouter";
import { ArrowLeft, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

export default function ScanDetail() {
  const params = useParams();
  const scanId = params.scanId as string;
  const { userId } = useAuth();

  const { data: scan, isLoading, error } = useGetScan(
    scanId,
    { userId },
    { query: { enabled: !!scanId, queryKey: getGetScanQueryKey(scanId, { userId }) } }
  );

  if (isLoading) {
    return (
      <PageTransition className="space-y-8 max-w-5xl mx-auto">
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
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

  if (error || !scan) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Scan not found</h2>
        <Link href="/history" className="text-primary hover:underline flex items-center justify-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Vault
        </Link>
      </div>
    );
  }

  return (
    <PageTransition className="space-y-6 max-w-5xl mx-auto pb-20">
      <Link href="/history" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Intelligence Vault
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="text-primary h-8 w-8" />
            {scan.contractName}
          </h1>
          <div className="flex items-center gap-4 mt-3 text-muted-foreground text-sm">
            <span className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md border border-border font-mono">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(scan.createdAt), "MMM d, yyyy h:mm a")}
            </span>
          </div>
        </div>
      </div>

      <ScanResultView result={scan.result} />
    </PageTransition>
  );
}
