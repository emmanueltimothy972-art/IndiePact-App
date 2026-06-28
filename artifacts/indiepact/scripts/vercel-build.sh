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

# Write sitemap.xml directly to the Vercel output directory.
# This is the definitive backstop — it runs after all file copies and
# ensures the file exists regardless of Vite plugin hook ordering.
# robots.txt is reliable because it lives in public/; sitemap.xml now
# takes the same path (public/ → dist/public/ → here) AND is written
# explicitly here so there is no single point of failure.
echo "  Writing sitemap.xml..."
SITEMAP_LASTMOD=$(date +%Y-%m-%d)
cat > "$OUTPUT_DIR/static/sitemap.xml" << SITEMAPEOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://indiepact.pro/</loc>
    <lastmod>${SITEMAP_LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://indiepact.pro/pricing</loc>
    <lastmod>${SITEMAP_LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
SITEMAPEOF

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
