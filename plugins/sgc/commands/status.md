---
name: status
description: "Read-only dashboard — active task, level, last activity. Zero LLM, zero writes."
---

# /sgc:status

Quick "where am I" snapshot.

## Invocation

```bash
if   command -v sgc.mjs >/dev/null 2>&1;         then sgc() { sgc.mjs "$@"; }
elif [ -f "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" ]; then sgc() { node "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" "$@"; }
elif command -v sgc >/dev/null 2>&1;             then :
elif [ -f src/sgc.ts ];                          then sgc() { bun src/sgc.ts "$@"; }
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

sgc status
```

## What you should do

1. Run the CLI verbatim.
2. If no `.sgc/` exists, suggest `/sgc:plan "<task>"` to bootstrap.
3. If active task is stale (last_activity > 24h ago), suggest reviewing `handoff.md` before resuming.

## Notes

- Permission row: `decisions:read:* / progress:read / solutions:read / reviews:read` — read-only across the board (`/status` has zero write capability).
