#!/usr/bin/env bash
# After files are "Anyone with the link", download and rename into product slots.
set -euo pipefail
VENV="${VENV:-/tmp/bvs-gdown-venv}"
GDOWN="$VENV/bin/gdown"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)/bvsradio-products"
SITE="$(cd "$(dirname "$0")/../../.." && pwd)"
mkdir -p "$ROOT/albums" "$SITE/public/images/albums"

if [[ ! -x "$GDOWN" ]]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q gdown
fi

# Cover
"$GDOWN" "1pQcLM0C1NuHHnDqPnAufCqT9HSRoYceD" -O "$SITE/public/images/albums/lord-album.png"
convert "$SITE/public/images/albums/lord-album.png" -resize 1200x1200^ -gravity center -extent 1200x1200 \
  "$SITE/public/images/albums/lord-album.jpg"

# Albums (large — may take a while)
"$GDOWN" "1Gzvd2srx69LCoads0u8CsMxCBjOHqsj8" -O "$ROOT/albums/100.zip"
cp -n "$ROOT/albums/100.zip" "$ROOT/albums/lord-album.zip" 2>/dev/null || true
"$GDOWN" "1uvqfLgtNPmcwRHhpvvi6zLcpPA2uNRge" -O "$ROOT/albums/101.zip"
cp -n "$ROOT/albums/101.zip" "$ROOT/albums/album-16-bit.zip" 2>/dev/null || true

ls -lah "$ROOT/albums" "$SITE/public/images/albums"
echo "OK — products ready for paid download resolution"
