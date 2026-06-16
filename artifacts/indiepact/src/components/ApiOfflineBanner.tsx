import { useState, useEffect } from "react";
import { WifiOff, CheckCircle2, X } from "lucide-react";
import { useApiHealth, type ApiHealthStatus } from "@/hooks/use-api-health";

export function ApiOfflineBanner() {
  const { status } = useApiHealth();
  const [dismissed, setDismissed] = useState(false);

  // Re-show the banner whenever we go offline again
  useEffect(() => {
    if (status === "offline") setDismissed(false);
  }, [status]);

  if (status === "unknown" || status === "online") return null;
  if (status === "offline" && dismissed) return null;

  const isReconnected = status === "reconnected";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        "fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium",
        "transition-all duration-300",
        isReconnected
          ? "bg-emerald-900/90 border-b border-emerald-700/60 text-emerald-200"
          : "bg-red-950/95 border-b border-red-800/60 text-red-200",
      ].join(" ")}
    >
      <span className="flex items-center gap-2">
        {isReconnected ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0 text-red-400" />
        )}
        {isReconnected
          ? "Connection restored — everything is back online."
          : "API is unreachable — your actions may not save. Retrying every 30 seconds."}
      </span>

      {!isReconnected && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 hover:bg-red-900/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
