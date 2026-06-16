import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// ─── Shared config ────────────────────────────────────────────────────────────
// Packages that cannot be bundled (native addons, dynamic file loaders, etc.)
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
  // Output: dist/index.mjs
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
    plugins: [
      // pino relies on workers to handle logging; the plugin bundles them
      // alongside the output so they are resolvable at runtime.
      esbuildPluginPino({ transports: ["pino-pretty"] }),
    ],
    banner: ESM_BANNER,
  });

  // ── Build 2: Vercel serverless handler ──────────────────────────────────
  // Entry:  api/index.ts  (exports Express app — no listen() call)
  // Output: api/index.js  (single self-contained ESM bundle)
  // Used by: Vercel @vercel/node — the function file referenced in vercel.json.
  //
  // WHY a separate pre-built bundle instead of letting @vercel/node compile
  // api/index.ts directly?
  //
  // @vercel/node transpiles TypeScript files individually (transpile-only mode)
  // and relies on Node.js ESM resolution at runtime.  This causes two classes
  // of failures that our own esbuild avoids:
  //
  //   1. ERR_UNSUPPORTED_DIR_IMPORT — bare directory imports that Node.js ESM
  //      refuses to resolve automatically.
  //   2. CJS/ESM interop failures — packages like multer (CJS-only) loaded via
  //      createRequire() don't survive @vercel/node's transpilation cleanly.
  //
  // By pre-bundling here we get a single, fully-resolved, self-contained JS
  // file that Vercel simply executes — no TypeScript compilation needed.
  //
  // multer and pino are externalised so they are loaded from Vercel's
  // node_modules at runtime:
  //   • multer  — the route uses createRequire() to load it; bundling it AND
  //               calling createRequire() for it would create two instances.
  //   • pino    — relies on worker threads (thread-stream).  Without the pino
  //               esbuild plugin the workers won't be co-located; externalising
  //               lets pino load its own workers from node_modules correctly.
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "api/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: path.resolve(artifactDir, "api/index.js"),
    allowOverwrite: true,
    logLevel: "info",
    external: [
      ...BASE_EXTERNALS,
      // Externalise multer — loaded at runtime via createRequire() in
      // src/routes/process-document.ts; bundling it would create two instances.
      "multer",
      // Externalise pino family — worker threads need to be loaded from the
      // same node_modules tree; bundling breaks the thread-stream path lookup.
      "pino",
      "pino-http",
      "pino-pretty",
      "thread-stream",
    ],
    sourcemap: false,
    banner: ESM_BANNER,
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
