import { useEffect, useRef, useState } from "react";

export type ApiHealthStatus = "unknown" | "online" | "offline" | "reconnected";

const POLL_INTERVAL_MS = 30_000;
const RECONNECTED_DISPLAY_MS = 4_000;

function buildHealthUrl(): string {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  return `${base}/api/healthz`;
}

export function useApiHealth() {
  const [status, setStatus] = useState<ApiHealthStatus>("unknown");
  const wasOfflineRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function check() {
    try {
      const res = await fetch(buildHealthUrl(), {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });

      if (res.ok) {
        if (wasOfflineRef.current) {
          wasOfflineRef.current = false;
          setStatus("reconnected");
          if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
          reconnectedTimerRef.current = setTimeout(() => {
            setStatus("online");
          }, RECONNECTED_DISPLAY_MS);
        } else {
          setStatus("online");
        }
      } else {
        wasOfflineRef.current = true;
        setStatus("offline");
      }
    } catch {
      wasOfflineRef.current = true;
      setStatus("offline");
    }
  }

  useEffect(() => {
    check();
    timerRef.current = setInterval(check, POLL_INTERVAL_MS);

    function handleFocus() { check(); }
    window.addEventListener("focus", handleFocus);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return { status };
}
