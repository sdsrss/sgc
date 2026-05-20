---
name: status
description: "Read-only dashboard — active task, level, last activity. Zero LLM, zero writes."
---

# /sgc:status

Quick "where am I" snapshot.

## Pre-flight

```bash
test -f src/sgc.ts || { echo "sgc CLI not in cwd — clone https://github.com/sdsrss/sgc or run from a project that vendors it"; exit 1; }
```

## Invocation

```bash
bun src/sgc.ts status
```

## What you should do

1. Run the CLI verbatim.
2. If no `.sgc/` exists, suggest `/sgc:plan "<task>"` to bootstrap.
3. If active task is stale (last_activity > 24h ago), suggest reviewing `handoff.md` before resuming.

## Notes

- Permission row: `decisions:read:* / progress:read / solutions:read / reviews:read` — read-only across the board (`/status` has zero write capability).
