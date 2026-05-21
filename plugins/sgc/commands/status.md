---
name: status
description: "Read-only dashboard — active task, level, last activity. Zero LLM, zero writes."
---

# /sgc:status

Quick "where am I" snapshot.

## Invocation

```bash
if command -v sgc >/dev/null 2>&1; then SGC=sgc
elif test -f src/sgc.ts; then SGC="bun src/sgc.ts"
else
  printf '%s\n' \
    "ERROR: sgc CLI not found." "" \
    "Install via npm (recommended):" \
    "  npm install -g @sdsrss/sgc       # requires bun >=1.3 runtime" "" \
    "Or clone from source:" \
    "  git clone https://github.com/sdsrss/sgc && cd sgc" \
    "  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install" "" \
    "See https://github.com/sdsrss/sgc#install" >&2
  exit 1
fi

$SGC status
```

## What you should do

1. Run the CLI verbatim.
2. If no `.sgc/` exists, suggest `/sgc:plan "<task>"` to bootstrap.
3. If active task is stale (last_activity > 24h ago), suggest reviewing `handoff.md` before resuming.

## Notes

- Permission row: `decisions:read:* / progress:read / solutions:read / reviews:read` — read-only across the board (`/status` has zero write capability).
