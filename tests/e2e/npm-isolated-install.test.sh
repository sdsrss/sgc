#!/usr/bin/env bash
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"
# Packs the COMMITTED bundle, the file npm users get. No rebuild here: it used
# whatever bun was on PATH and silently replaced the bundle in the working tree
# (v1.38.5 committed a local-bun build that way). That the committed bundle
# equals a CI-bun rebuild is test.yml's "Bundle parity" step's job.
TARBALL="$(npm pack 2>/dev/null | tail -1)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK" "$REPO/$TARBALL"' EXIT
cd "$WORK"
npm init -y >/dev/null 2>&1
npm install --no-save "$REPO/$TARBALL" >/dev/null 2>&1
BIN="$WORK/node_modules/.bin/sgc"
[ -x "$BIN" ] || { echo "FAIL: $BIN not executable" >&2; exit 1; }
echo "--- version ---"; node "$BIN" --version 2>/dev/null || node "$BIN" --help | head -1
echo "--- doctor ---";  node "$BIN" doctor | tail -3
echo "NPM-ISOLATED OK"
