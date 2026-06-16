import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// ─── Packages that can never be bundled ───────────────────────────────────────
// Native addons (.node), rarely-installed system libraries, and cloud-SDK
// behemoths that use dynamic file traversal.  Everything else is bundled so
// both the dev-server output and the Vercel handler are fully self-contained.
const BASE_EXTERNALS = [
  "*.node",
  "sharp",
  "better-sqlite3",
  "sqlite3",
  "canvas",
  "bcrypt",
  "argon2",
  "fsevents",
  "re2",
  "farmhash",
  "xxhash-addon",
  "bufferutil",
  "utf-8-validate",
  "ssh2",
  "cpu-features",
  "dtrace-provider",
  "isolated-vm",
  "lightningcss",
  "pg-native",
  "oracledb",
  "mongodb-client-encryption",
  "nodemailer",
  "handlebars",
  "knex",
  "typeorm",
  "protobufjs",
  "onnxruntime-node",
  "@tensorflow/*",
  "@prisma/client",
  "@mikro-orm/*",
  "@grpc/*",
  "@swc/*",
  "@aws-sdk/*",
  "@azure/*",
  "@opentelemetry/*",
  "@google-cloud/*",
  "@google/*",
  "googleapis",
  "firebase-admin",
  "@parcel/watcher",
  "@sentry/profiling-node",
  "@tree-sitter/*",
  "aws-sdk",
  "classic-level",
  "dd-trace",
  "ffi-napi",
  "grpc",
  "hiredis",
  "kerberos",
  "leveldown",
  "miniflare",
  "mysql2",
  "newrelic",
  "odbc",
  "piscina",
  "realm",
  "ref-napi",
  "rocksdb",
  "sass-embedded",
  "sequelize",
  "serialport",
  "snappy",
  "tinypool",
  "usb",
  "workerd",
  "wrangler",
  "zeromq",
  "zeromq-prebuilt",
  "playwright",
  "puppeteer",
  "puppeteer-core",
  "electron",
];

// ESM banner — gives bundled CJS-origin code access to require(), __dirname,
// and __filename which are absent in native ESM scope.
const ESM_BANNER = {
  js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
};

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  // ── Build 1: Replit dev server ───────────────────────────────────────────
  // Entry:  src/index.ts  (calls app.listen — starts the HTTP server)
  // Output: dist/index.mjs  +  dist/pino-worker.mjs  etc.
  // Used by: pnpm run start (local Replit environment)
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: BASE_EXTERNALS,
    sourcemap: "linked",
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
    banner: ESM_BANNER,
  });

  // ── Build 2: Vercel serverless handler ──────────────────────────────────
  // Entry:  api/index.ts  (exports Express app — no listen() call)
  // Output: api/index.mjs  +  api/pino-worker.mjs  etc.
  // Used by: Vercel — the function file referenced in vercel.json.
  //
  // DESIGN DECISIONS
  // ────────────────
  // • We pre-bundle instead of letting @vercel/node compile api/index.ts:
  //   @vercel/node's transpile-only mode leaves bare directory imports and
  //   createRequire() calls unresolved, crashing the Lambda on startup.
  //
  // • We use outdir (not outfile) and include esbuildPluginPino so pino's
  //   worker thread files (pino-worker.mjs, thread-stream-worker.mjs, …)
  //   are co-located with the handler.  Without them pino can fail to spawn
  //   its async transport worker and throw on the first log statement.
  //
  // • All application packages (multer, pino, pino-http, express, …) are
  //   bundled directly into api/index.mjs.  No package is externalized beyond
  //   BASE_EXTERNALS (native addons and cloud SDKs).  This makes the Lambda
  //   fully self-contained — Vercel's file tracer does not need to trace any
  //   application-level package, so "Cannot find module" is impossible.
  //
  // • api/index.mjs and the worker files are build artifacts; they are listed
  //   in .gitignore and recreated on every build (including Vercel's build).
  const apiDir = path.resolve(artifactDir, "api");
  await esbuild({
    entryPoints: [path.resolve(apiDir, "index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: apiDir,
    outExtension: { ".js": ".mjs" },
    allowOverwrite: true,
    logLevel: "info",
    external: BASE_EXTERNALS,
    sourcemap: false,
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
    banner: ESM_BANNER,
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
