---
name: qa
description: "Real-browser end-to-end QA via the browse module. Required gate for L2+ ship. Writes review report to reviews/{task}/qa/."
---

# /sgc:qa

Drive a real Chromium browser through user flows. Like `/review`, qa.browser is AMNESIAC (no `read:solutions`).

## Pre-flight

```bash
test -f src/sgc.ts || { echo "sgc CLI not in cwd — clone https://github.com/sdsrss/sgc or run from a project that vendors it"; exit 1; }
```

## Invocation

```bash
bun src/sgc.ts qa                                                    # use defaults / stub
bun src/sgc.ts qa http://localhost:3000                              # target URL
bun src/sgc.ts qa http://localhost:3000 --flows login,dashboard,logout
```

## What you should do

1. Verify the target is reachable (`curl -sf <url> > /dev/null`) before launching browser; surface "target not reachable" if not.
2. Parse comma-separated flow names from user prose.
3. Run the CLI; output evidence_refs to surfaces (screenshots / DOM dumps).
4. If verdict=fail, surface the failed_flows list with step + observed mismatch.

## Notes

- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` on first install — bring your own Chromium.
- `plugins/sgc/browse/dist/browse` is the compiled binary; `bun run build:browse` rebuilds.
