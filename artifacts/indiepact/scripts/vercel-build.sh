#!/usr/bin/env bash
set -euo pipefail

# Vercel Build Output API v3
# Produces .vercel/output/ directly — bypasses all functions-block pre-validation,
# gitignore filtering, and post-build file-detection issues.
#
# .vercel/output/
#   config.json                          ← routes, headers
#   static/                              ← Vite build output
#   functions/api/index.func/            ← Express handler
#     .vc-config.json
#     index.mjs  (6.2 MB, fully bundled)
#     pino-worker.mjs
#     pino-file.mjs
#     pino-pretty.mjs
#     thread-stream-worker.mjs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INDIEPACT_DIR="$(dirname "$SCRIPT_DIR")"
API_SERVER_DIR="$(dirname "$INDIEPACT_DIR")/api-server"
OUTPUT_DIR="$INDIEPACT_DIR/.vercel/output"
FUNC_DIR="$OUTPUT_DIR/functions/api/index.func"

echo "──────────────────────────────────────────"
echo "Step 0: TypeScript typecheck (entire workspace)"
echo "──────────────────────────────────────────"
cd "$(dirname "$(dirname "$SCRIPT_DIR")")"
pnpm run typecheck

echo ""
echo "──────────────────────────────────────────"
echo "Step 1: Build API server bundle"
echo "  dir: $API_SERVER_DIR"
echo "──────────────────────────────────────────"
cd "$API_SERVER_DIR"
node build.mjs

echo ""
echo "──────────────────────────────────────────"
echo "Step 2: Build frontend (Vite)"
echo "  dir: $INDIEPACT_DIR"
echo "──────────────────────────────────────────"
cd "$INDIEPACT_DIR"
pnpm run build

echo ""
echo "──────────────────────────────────────────"
echo "Step 3: Assemble .vercel/output structure"
echo "──────────────────────────────────────────"
rm -rf "$OUTPUT_DIR"
mkdir -p "$FUNC_DIR"
mkdir -p "$OUTPUT_DIR/static"

echo "  Copying static files from dist/public..."
cp -r "$INDIEPACT_DIR/dist/public/." "$OUTPUT_DIR/static/"

echo "  Copying function files from api-server/api/..."
cp "$API_SERVER_DIR/api/index.mjs" "$FUNC_DIR/"
for worker in pino-worker.mjs pino-file.mjs pino-pretty.mjs thread-stream-worker.mjs; do
  src="$API_SERVER_DIR/api/$worker"
  if [ -f "$src" ]; then
    cp "$src" "$FUNC_DIR/"
    echo "  Copied $worker"
  fi
done

echo "  Writing .vc-config.json..."
cat > "$FUNC_DIR/.vc-config.json" <<'VCCONFIG'
{
  "runtime": "nodejs20.x",
  "handler": "index.mjs",
  "launcherType": "Nodejs",
  "shouldAddHelpers": false,
  "maxDuration": 60
}
VCCONFIG

echo "  Writing config.json..."
cat > "$OUTPUT_DIR/config.json" <<'ROUTECONFIG'
{
  "version": 3,
  "routes": [
    {
      "src": "^/assets/(.*)$",
      "headers": { "cache-control": "public, max-age=31536000, immutable" },
      "continue": true
    },
    {
      "src": "^/(.*)$",
      "headers": {
        "x-content-type-options": "nosniff",
        "x-frame-options": "SAMEORIGIN",
        "x-xss-protection": "1; mode=block",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=(), microphone=(), geolocation=()"
      },
      "continue": true
    },
    {
      "src": "^/api(/.*)?$",
      "dest": "/api/index"
    },
    {
      "handle": "filesystem"
    },
    {
      "src": "^/(.*)$",
      "dest": "/index.html"
    }
  ]
}
ROUTECONFIG

echo ""
echo "──────────────────────────────────────────"
echo "Build Output Summary"
echo "──────────────────────────────────────────"
echo "  Static files : $(find "$OUTPUT_DIR/static" -type f | wc -l | tr -d ' ')"
echo "  Function dir : $FUNC_DIR"
echo "  Function files:"
ls -lh "$FUNC_DIR"
echo "──────────────────────────────────────────"
echo "Done."
