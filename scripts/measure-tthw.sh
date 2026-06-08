#!/usr/bin/env bash
# measure-tthw.sh — TTHW (time-to-hello-world) measurement.
#
# Wall-clock from "I have the package" to the first successful command, in an
# isolated clean install. The v1.29.1 audit
# (docs/COMPREHENSIVE-AUDIT-v1.29.1.md §4.4) flagged 高效化's TTHW as
# documented-but-unmeasured; this turns it into a real number.
#
# NOT a CI gate (clean-env install timing is environment-sensitive) — run it
# manually:  bash scripts/measure-tthw.sh
#
# The Playwright browser download is skipped: a browser is opt-in for real
# `sgc qa --browse`, not part of the first-command hello-world path.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

npm run build:cli >/dev/null 2>&1
TARBALL="$(npm pack 2>/dev/null | tail -1)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK" "$REPO/$TARBALL"' EXIT
cd "$WORK"
npm init -y >/dev/null 2>&1

# Phase 1 — install the published tarball into a fresh project.
t0=$(date +%s%3N)
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  npm install --no-save "$REPO/$TARBALL" >/dev/null 2>&1
t1=$(date +%s%3N)

# Phase 2 — first successful command.
BIN="$WORK/node_modules/.bin/sgc"
[ -x "$BIN" ] || { echo "FAIL: $BIN not executable" >&2; exit 1; }
node "$BIN" --help >/dev/null 2>&1
t2=$(date +%s%3N)

fmt() { printf '%d.%03ds' $(( $1 / 1000 )) $(( $1 % 1000 )); }
echo "=== TTHW (time-to-hello-world) ==="
echo "  install (tarball):  $(fmt $(( t1 - t0 )))"
echo "  first command:      $(fmt $(( t2 - t1 )))"
echo "  TTHW total:         $(fmt $(( t2 - t0 )))"
echo "  (Playwright browser download skipped — opt-in for real QA)"
