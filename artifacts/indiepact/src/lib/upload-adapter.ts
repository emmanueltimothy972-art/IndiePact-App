// ─── Upload Adapter ────────────────────────────────────────────────────────────
//
// Dual-mode document upload abstraction for IndiePact.
//
// MODE SELECTION (automatic, transparent to user):
//
//   "blob" mode  (Vercel production, BLOB_READ_WRITE_TOKEN configured)
//     1. Calls GET /api/upload-config to confirm blob mode (cached per session)
//     2. Uploads file DIRECTLY to Vercel Blob CDN from the browser
//        ↳ Bypasses Vercel serverless 4.5 MB body limit entirely
//        ↳ Large enterprise contracts (50 MB+) upload reliably
//     3. Sends only the blob URL (tiny JSON payload) to /api/process-document
//     4. API downloads from blob URL, runs 5-layer pipeline, deletes blob
//
//   "direct" mode  (Replit dev, no BLOB_READ_WRITE_TOKEN)
//     1. Falls back to multipart/form-data POST to /api/process-document
//        ↳ Works fine in Replit where Express is a real long-running server
//        ↳ Identical to the previous upload behaviour
//
// RESILIENCE:
//   If blob upload fails for any reason (token error, network, etc.) the adapter
//   automatically falls back to direct multipart upload so users are never blocked.
//
// OBSERVABILITY:
//   Upload mode, duration, and fallback events are logged to the server (never
//   exposed to the frontend UI).

export interface ProcessDocumentResponse {
  extractedText?: string;
  charCount?: number;
  wordCount?: number;
  format?: string;
  processingNotes?: string[];
  fileName?: string;
  error?: string;
  requiresOcr?: boolean;
  extractionConfidence?: number;
  fallbackUsed?: boolean;
}

export interface UploadResult {
  ok: boolean;
  status: number;
  data: ProcessDocumentResponse;
  mode: "blob" | "direct";
  durationMs: number;
}

// ─── Upload config cache (per session) ───────────────────────────────────────
// One network request per page session. The mode never changes mid-session.

type UploadMode = "blob" | "direct";

let cachedMode: UploadMode | null = null;
let configPromise: Promise<UploadMode> | null = null;

async function getUploadMode(baseUrl: string): Promise<UploadMode> {
  if (cachedMode) return cachedMode;

  // Deduplicate concurrent callers (e.g., two files dropped simultaneously)
  if (!configPromise) {
    configPromise = (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/upload-config`, {
          // No auth header needed — this is a lightweight config check
          // (requireAuth on the server handles it via session cookie or token)
        });
        if (!res.ok) return "direct";
        const data = (await res.json()) as { mode?: string };
        return data.mode === "blob" ? "blob" : "direct";
      } catch {
        return "direct";
      }
    })();
    configPromise.then((mode) => {
      cachedMode = mode;
      configPromise = null;
    });
  }

  return configPromise;
}

// ─── Clear cache (call on logout) ────────────────────────────────────────────

export function resetUploadModeCache(): void {
  cachedMode = null;
  configPromise = null;
}

// ─── Core upload function ─────────────────────────────────────────────────────

/**
 * Upload a document and return the extracted text from the processing pipeline.
 *
 * @param file        The File to upload (PDF, DOCX, TXT, RTF)
 * @param authToken   Bearer token from Supabase session (null for guests)
 * @param baseUrl     API base URL (from import.meta.env.BASE_URL, trailing slash stripped)
 * @param onStage     Callback to update UI stage ("uploading" | "extracting")
 */
export async function uploadDocument(
  file: File,
  authToken: string | null,
  baseUrl: string,
  onStage: (stage: "uploading" | "extracting") => void,
): Promise<UploadResult> {
  const startMs = Date.now();
  const authHeaders: Record<string, string> = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  // Determine upload mode
  const mode = await getUploadMode(baseUrl);

  // ── BLOB MODE (Vercel production) ─────────────────────────────────────────
  if (mode === "blob") {
    try {
      const { upload } = await import("@vercel/blob/client");

      onStage("uploading");

      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: `${baseUrl}/api/upload-token`,
        // Pass auth token as client payload so the server can log userId
        clientPayload: JSON.stringify({ authToken }),
        // Report upload progress so we can switch to "extracting" at 100%
        onUploadProgress({ percentage }) {
          if (percentage >= 100) onStage("extracting");
        },
      });

      // Brief pause if onUploadProgress didn't fire (small files)
      onStage("extracting");

      const response = await fetch(`${baseUrl}/api/process-document`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blobUrl: blob.url,
          filename: file.name,
        }),
      });

      const data = (await response.json()) as ProcessDocumentResponse;
      return {
        ok: response.ok,
        status: response.status,
        data,
        mode: "blob",
        durationMs: Date.now() - startMs,
      };
    } catch (blobErr) {
      // Blob path failed — fall through to direct multipart fallback
      console.warn("[upload-adapter] Blob upload failed, falling back to direct:", blobErr);
      // Reset mode cache so next upload re-checks (in case of token expiry)
      cachedMode = null;
    }
  }

  // ── DIRECT MODE (Replit dev, or blob fallback) ────────────────────────────
  onStage("uploading");

  // Brief delay so the "Uploading…" stage is visible on fast connections
  await new Promise((r) => setTimeout(r, 400));
  onStage("extracting");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${baseUrl}/api/process-document`, {
    method: "POST",
    headers: authHeaders,
    body: formData,
  });

  const data = (await response.json()) as ProcessDocumentResponse;
  return {
    ok: response.ok,
    status: response.status,
    data,
    mode: "direct",
    durationMs: Date.now() - startMs,
  };
}
