#!/usr/bin/env bash
# Acceptance: plugin payload runs on node-only (no bun, no npm-global).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"

docker run --rm -v "$REPO":/repo:ro node:20-slim bash -c '
  set -euo pipefail
  command -v bun && { echo "FAIL: bun present, not a clean env" >&2; exit 1; } || true
  # Simulate /plugin install: copy payload to a CLAUDE_PLUGIN_ROOT.
  mkdir -p /plug && cp -r /repo/plugins/sgc/* /plug/
  export CLAUDE_PLUGIN_ROOT=/plug
  cd /tmp && mkdir proj && cd proj
  echo "--- sgc --help ---";   node "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" --help   | head -5
  echo "--- sgc doctor ---";   node "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" doctor   | tail -5
  echo "--- sgc plan (L0) ---";node "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" plan "fix a typo in README" --motivation "trivial copy fix, no logic, restores intended wording" || true
  echo "CLEAN-CONTAINER OK"
'
