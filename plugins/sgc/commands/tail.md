---
name: tail
description: "Tail .sgc/progress/events.ndjson — structured event stream. Filter by task/agent/event_type/since; --follow for tail -f behavior."
---

# /sgc:tail

Operator-facing read surface over the Invariant §13 event audit log.

## Pre-flight

```bash
test -f src/sgc.ts || { printf "%s\n" "ERROR: sgc CLI not in current directory." "" "Install once per project (plugin layer is markdown-only; CLI is a separate clone):" "  git clone https://github.com/sdsrss/sgc && cd sgc" "  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install" "" "Then re-run from the sgc/ directory." "See https://github.com/sdsrss/sgc#install for the canonical install reference." >&2; exit 1; }
```

## Invocation

```bash
bun src/sgc.ts tail                                   # all events, human-readable
bun src/sgc.ts tail --json                            # raw NDJSON
bun src/sgc.ts tail --task <task_id>
bun src/sgc.ts tail --agent 'planner.*'               # glob match
bun src/sgc.ts tail --event-type 'llm.'               # substring
bun src/sgc.ts tail --since 2026-05-19T07:00:00Z
bun src/sgc.ts tail --follow                          # tail -f
bun src/sgc.ts tail --limit 20                        # last N matching (initial drain)
```

## What you should do

1. Detect user's diagnostic intent — failure investigation → suggest `--event-type 'llm.' --agent <agent>` ; latency hunt → suggest `--event-type 'spawn.end' --json | jq '.payload.elapsed_ms'`.
2. For `--follow`, warn that the command does not auto-terminate; suggest Ctrl-C.
3. Default to non-JSON unless user asks for machine parsing.

## Event schema (v1)

`{schema_version, ts, task_id, spawn_id, agent, event_type, level, payload}`

Tier 1 (all modes): `spawn.start` + `spawn.end` (outcome: success|timeout|error).
Tier 2 (LLM modes): `llm.request` + `llm.response` (outcome: success|timeout|error|schema_violation).
