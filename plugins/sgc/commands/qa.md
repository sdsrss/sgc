---
name: qa
description: "End-to-end QA gate for L2+ ship. Playwright real-browser smoke is opt-in (--browse / SGC_QA_REAL=1); stub by default (returns concern, never rubber-stamps). Writes review report to reviews/{task}/qa/."
---

# /sgc:qa

Run the L2+ QA gate. Real-browser mode (a Playwright Chromium smoke: `goto` + console/page errors + screenshot → verdict) is **opt-in** via `--browse` / `SGC_QA_REAL=1`; by default `qa.browser` returns a non-rubber-stamping stub (`concern`). Like `/review`, qa.browser is AMNESIAC (no `read:solutions`).

## Invocation

```bash
if   [ -f "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" ]; then SGC="node $CLAUDE_PLUGIN_ROOT/bin/sgc.mjs"
elif command -v sgc >/dev/null 2>&1;          then SGC=sgc
elif test -f src/sgc.ts;                      then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

$SGC qa                                                    # default: stub (concern)
$SGC qa http://localhost:3000 --browse                     # real Playwright smoke
$SGC qa http://localhost:3000 --flows /dashboard,/settings --browse   # smoke extra paths
```

## What you should do

1. Verify the target is reachable (`curl -sf <url> > /dev/null`) before launching browser; surface "target not reachable" if not.
2. Parse comma-separated flow names from user prose.
3. Run the CLI; output evidence_refs to surfaces (screenshots / DOM dumps).
4. If verdict=fail, surface the failed_flows list with step + observed mismatch.

## Notes

- Real-browser mode needs a browser: `npx playwright install chromium`, or set `SGC_QA_BROWSER=chrome` to use system Chrome.
- Playwright is already a dependency; the real runner is `src/dispatcher/agents/playwright-runner.ts`.
