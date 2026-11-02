---
name: qa
description: "End-to-end QA gate for L2+ ship. Playwright real-browser smoke is opt-in (--browse / SGC_QA_REAL=1); stub by default (returns concern, never rubber-stamps). Writes review report to reviews/{task}/qa/."
---

# /sgc:qa

Run the L2+ QA gate. Real-browser mode (a Playwright Chromium smoke: `goto` + console/page errors + screenshot → verdict) is **opt-in** via `--browse` / `SGC_QA_REAL=1`; by default `qa.browser` returns a non-rubber-stamping stub (`concern`). Like `/review`, qa.browser is AMNESIAC (no `read:solutions`).

## Invocation

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise reinstall it at the Scope shown there: claude plugin uninstall sgc@sgc --scope <scope>, then claude plugin install sgc@sgc --scope <scope>" >&2; exit 1; }

sgc.mjs qa                                                    # default: stub (concern)
sgc.mjs qa http://localhost:3000 --browse                     # real Playwright smoke
sgc.mjs qa http://localhost:3000 --flows /dashboard,/settings --browse   # smoke extra paths
```

## What you should do

1. Verify the target is reachable (`curl -sf <url> > /dev/null`) before launching browser; surface "target not reachable" if not.
2. Parse comma-separated flow names from user prose.
3. Run the CLI; output evidence_refs to surfaces (screenshots / DOM dumps).
4. If verdict=fail, surface the failed_flows list with step + observed mismatch.

## Notes

- Real-browser mode needs a browser: `npx playwright install chromium`, or set `SGC_QA_BROWSER=chrome` to use system Chrome.
- Playwright is an optional dependency of the npm package. The plugin does not ship it: `--browse` loads it from the project under test (`npm i -D playwright`) or from a global npm install (`npm i -g @sdsrs/sgc`), and reports `concern` (browser unavailable) when neither has it. qa reports are append-only, one per task, so set Playwright and the browser up before the task's first `--browse` run.
