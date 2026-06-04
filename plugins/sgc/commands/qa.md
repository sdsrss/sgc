---
name: qa
description: "End-to-end QA gate for L2+ ship. Stub by default (returns concern, never rubber-stamps); real-browser runner deferred — use gs:/browse for real-browser QA. Writes review report to reviews/{task}/qa/."
---

# /sgc:qa

Run the L2+ QA gate. Real-browser mode (driving a Chromium browser through user flows via the vendored `browse` binary) is **deferred** — by default `qa.browser` returns a non-rubber-stamping stub (`concern`); for real-browser QA use `gs:/browse`. Like `/review`, qa.browser is AMNESIAC (no `read:solutions`).

## Invocation

```bash
if   [ -f "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" ]; then SGC="node $CLAUDE_PLUGIN_ROOT/bin/sgc.mjs"
elif command -v sgc >/dev/null 2>&1;          then SGC=sgc
elif test -f src/sgc.ts;                      then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

$SGC qa                                                    # use defaults / stub
$SGC qa http://localhost:3000                              # target URL
$SGC qa http://localhost:3000 --flows login,dashboard,logout
```

## What you should do

1. Verify the target is reachable (`curl -sf <url> > /dev/null`) before launching browser; surface "target not reachable" if not.
2. Parse comma-separated flow names from user prose.
3. Run the CLI; output evidence_refs to surfaces (screenshots / DOM dumps).
4. If verdict=fail, surface the failed_flows list with step + observed mismatch.

## Notes

- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` on first install — bring your own Chromium.
- `plugins/sgc/browse/dist/browse` is the compiled binary; `bun run build:browse` rebuilds.
