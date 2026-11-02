---
name: status
description: "Read-only dashboard — active task, level, last activity. Zero LLM, zero writes."
---

# /sgc:status

Quick "where am I" snapshot.

## Invocation

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found — reinstall the sgc plugin in a terminal: claude plugin uninstall sgc@sgc, then claude plugin install sgc@sgc" >&2; exit 1; }

sgc.mjs status
```

## What you should do

1. Run the CLI verbatim.
2. If no `.sgc/` exists, suggest `/sgc:plan "<task>"` to bootstrap.
3. If active task is stale (last_activity > 24h ago), suggest reviewing `handoff.md` before resuming.

## Notes

- Permission row: `decisions:read:* / progress:read / solutions:read / reviews:read` — read-only across the board (`/status` has zero write capability).
