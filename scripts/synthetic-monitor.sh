#!/usr/bin/env bash
# BVS synthetic monitor — agent/cron friendly. Exit 1 if any critical check fails twice in a row state file.
set -euo pipefail
BASE="${BVS_MONITOR_BASE:-https://bvsradio.com}"
STATE_DIR="${BVS_MONITOR_STATE:-/home/admin/.openclaw/workspace/bvsradio/ops/qa}"
mkdir -p "$STATE_DIR"
STAMP=$(date -Is)
FAIL=0
report=""

check() {
  local name="$1" url="$2" expect="${3:-200}"
  local code ttfb
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url" || echo 000)
  ttfb=$(curl -sS -o /dev/null -w '%{time_starttransfer}' --max-time 25 "$url" 2>/dev/null || echo 9)
  if [[ "$code" != "$expect" ]]; then
    FAIL=$((FAIL + 1))
    report+="FAIL $name http=$code expect=$expect ttfb=${ttfb}s url=$url\n"
  else
    report+="OK   $name http=$code ttfb=${ttfb}s\n"
  fi
}

check home "$BASE/"
check radio "$BASE/radio"
check catalogue "$BASE/catalogue"
check faq "$BASE/faq"
check checkout "$BASE/checkout"
check checkout_cfg "$BASE/api/checkout/config"
check manifest "$BASE/manifest.webmanifest"
check sw "$BASE/sw.js"

# Sample local music path from public if known via m3u first entry basename — fall back skip
MP3=$(curl -sS --max-time 15 "$BASE/music/playlist.m3u" 2>/dev/null | head -1 | xargs -r basename 2>/dev/null || true)
if [[ -n "${MP3:-}" && "$MP3" != *' '* ]]; then
  code=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-1023' --max-time 25 "$BASE/music/$MP3" || echo 000)
  if [[ "$code" != "206" && "$code" != "200" ]]; then
    FAIL=$((FAIL + 1))
    report+="FAIL audio_range http=$code file=$MP3\n"
  else
    report+="OK   audio_range http=$code file=$MP3\n"
  fi
else
  report+="SKIP audio_range (no simple playlist entry)\n"
fi

echo -e "$STAMP\n$report" | tee "$STATE_DIR/last-synthetic.txt"
echo "$FAIL" > "$STATE_DIR/last-synthetic-failcount.txt"

if [[ "$FAIL" -gt 0 ]]; then
  echo "SYNTHETIC_FAIL count=$FAIL"
  exit 1
fi
echo "SYNTHETIC_OK"
exit 0
