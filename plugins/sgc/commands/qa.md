---
name: qa
description: "Real-browser end-to-end QA via the browse module. Required gate for L2+ ship. Writes review report to reviews/{task}/qa/."
---

# /sgc:qa

Drive a real Chromium browser through user flows. Like `/review`, qa.browser is AMNESIAC (no `read:solutions`).

## Invocation

```bash
if command -v sgc >/dev/null 2>&1; then SGC=sgc
elif test -f src/sgc.ts; then SGC="bun src/sgc.ts"
else
  printf '%s\n' \
    "ERROR: sgc CLI not found." "" \
    "Install via npm (recommended):" \
    "  npm install -g @sdsrs/sgc       # requires bun >=1.3 runtime" "" \
    "Or clone from source:" \
    "  git clone https://github.com/sdsrss/sgc && cd sgc" \
    "  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install" "" \
    "See https://github.com/sdsrss/sgc#install" >&2
  exit 1
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
