import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ScanResult, SavedScan } from "@workspace/api-client-react";

const CACHE_KEY = "indiepact_scan_cache";
const CACHE_MAX = 30;

function readCache(): SavedScan[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedScan[];
  } catch { return []; }
}

function writeCache(scans: SavedScan[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(scans.slice(0, CACHE_MAX)));
  } catch {}
}

export interface ActiveScan {
  contractName: string;
  contractText: string;
  result: ScanResult;
}

interface ScanContextType {
  activeScan: ActiveScan | null;
  setActiveScan: (contractName: string, result: ScanResult, contractText?: string) => void;
  clearActiveScan: () => void;
  cachedScans: SavedScan[];
  addToCache: (scan: SavedScan) => void;
  updateCacheId: (tempId: string, realId: string) => void;
  getFromCache: (scanId: string) => SavedScan | undefined;
}

const ScanContext = createContext<ScanContextType | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [activeScan, setActiveScanState] = useState<ActiveScan | null>(null);
  const [cachedScans, setCachedScans] = useState<SavedScan[]>(() => readCache());

  const setActiveScan = useCallback((contractName: string, result: ScanResult, contractText = "") => {
    setActiveScanState({ contractName, contractText, result });
  }, []);

  const clearActiveScan = useCallback(() => {
    setActiveScanState(null);
  }, []);

  const addToCache = useCallback((scan: SavedScan) => {
    setCachedScans((prev) => {
      const filtered = prev.filter((s) => s.id !== scan.id);
      const updated = [scan, ...filtered];
      writeCache(updated);
      return updated;
    });
  }, []);

  const updateCacheId = useCallback((tempId: string, realId: string) => {
    setCachedScans((prev) => {
      const updated = prev.map((s) => s.id === tempId ? { ...s, id: realId } : s);
      writeCache(updated);
      return updated;
    });
  }, []);

  const getFromCache = useCallback((scanId: string): SavedScan | undefined => {
    return cachedScans.find((s) => s.id === scanId);
  }, [cachedScans]);

  return (
    <ScanContext.Provider value={{
      activeScan, setActiveScan, clearActiveScan,
      cachedScans, addToCache, updateCacheId, getFromCache,
    }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScanContext(): ScanContextType {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScanContext must be used within ScanProvider");
  return ctx;
}
