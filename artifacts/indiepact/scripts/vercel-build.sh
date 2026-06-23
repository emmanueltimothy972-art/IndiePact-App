#!/usr/bin/env bash
set -euo pipefail

# Vercel Build Output API v3
# Produces .vercel/output/ directly — static SPA only.
# /api/* is proxied to the separate API server project via config.json routes.
#
# .vercel/output/
#   config.json    ← routes (proxy /api/*, SPA fallback, security headers)
#   static/        ← Vite build output

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INDIEPACT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$INDIEPACT_DIR/.vercel/output"

echo "──────────────────────────────────────────"
echo "Step 0: TypeScript typecheck (entire workspace)"
echo "──────────────────────────────────────────"
cd "$(dirname "$(dirname "$SCRIPT_DIR")")"
pnpm run typecheck

echo ""
echo "──────────────────────────────────────────"
echo "Step 1: Build frontend (Vite)"
echo "  dir: $INDIEPACT_DIR"
echo "──────────────────────────────────────────"
cd "$INDIEPACT_DIR"
pnpm run build

echo ""
echo "──────────────────────────────────────────"
echo "Step 2: Assemble .vercel/output structure"
echo "──────────────────────────────────────────"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/static"

echo "  Copying static files from dist/public..."
cp -r "$INDIEPACT_DIR/dist/public/." "$OUTPUT_DIR/static/"

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
      "dest": "https://indie-pact-app-api-server.vercel.app/api$1"
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
echo "  Config       : $OUTPUT_DIR/config.json"
echo "──────────────────────────────────────────"
echo "Done."
