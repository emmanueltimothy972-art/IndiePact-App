import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT is required for the dev server but not for `vite build` (static output).
// Use a safe fallback so Vercel and other CI build environments don't throw.
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

// BASE_PATH controls the Vite base URL. Defaults to "/" for standard deploys
// (Vercel, Netlify). The Replit artifact runner sets BASE_PATH explicitly.
const basePath = process.env.BASE_PATH ?? "/";

// Replit-only dev plugins — loaded lazily so they are never bundled into
// production builds or imported on Vercel / CI environments.
const isReplitDev =
  process.env.NODE_ENV !== "production" &&
  process.env.REPL_ID !== undefined;

export default defineConfig({
  base: basePath,
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL ?? ""),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ""),
    "import.meta.env.VITE_SITE_URL": JSON.stringify(process.env.VITE_SITE_URL ?? ""),
    "import.meta.env.VITE_PAYSTACK_PUBLIC_KEY": JSON.stringify(process.env.PAYSTACK_PUBLIC_KEY ?? ""),
  },
  plugins: [
    react(),
    tailwindcss(),
    // Replit dev-only plugins — all three are guarded by the same condition so
    // none of them are imported or invoked in Vercel / production builds.
    ...(isReplitDev
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // @assets intentionally omitted — attached_assets is a Replit-specific
      // directory that does not exist in production builds. No source file
      // imports from @assets; the alias is removed to prevent accidental use.
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-router": ["wouter"],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    // In Replit dev the frontend and API run as separate workflows on different
    // ports. The browser calls ${basePath}/api/* but Vite knows nothing about
    // /api routes, so they 404 — which triggers the offline banner.
    // This proxy forwards those requests to the local API server so the health
    // check and any API calls work correctly during development.
    // In production (Vercel) the vercel.json rewrite rule handles this instead.
    ...(isReplitDev && process.env.API_SERVER_PORT
      ? {
          proxy: {
            [`${basePath}api`]: {
              target: `http://localhost:${process.env.API_SERVER_PORT}`,
              changeOrigin: true,
              rewrite: (p: string) =>
                "/api" + p.slice(`${basePath}api`.length),
            },
          },
        }
      : {}),
    fs: {
      strict: false,
      allow: [path.resolve(import.meta.dirname, "../..")],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
