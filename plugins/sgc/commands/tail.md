---
name: tail
description: "Tail .sgc/progress/events.ndjson — structured event stream. Filter by task/agent/event_type/since; --follow for tail -f behavior."
---

# /sgc:tail

Operator-facing read surface over the Invariant §13 event audit log.

## Invocation

```bash
if   command -v sgc.mjs >/dev/null 2>&1;         then sgc() { sgc.mjs "$@"; }
elif [ -f "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" ]; then sgc() { node "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" "$@"; }
elif command -v sgc >/dev/null 2>&1;             then :
elif [ -f src/sgc.ts ];                          then sgc() { bun src/sgc.ts "$@"; }
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

sgc tail                                   # all events, human-readable
sgc tail --json                            # raw NDJSON
sgc tail --task <task_id>
sgc tail --agent 'planner.*'               # glob match
sgc tail --event-type 'llm.'               # substring
sgc tail --since 2026-05-19T07:00:00Z
sgc tail --follow                          # tail -f
sgc tail --limit 20                        # last N matching (initial drain)
```

## What you should do

1. Detect user's diagnostic intent — failure investigation → suggest `--event-type 'llm.' --agent <agent>` ; latency hunt → suggest `--event-type 'spawn.end' --json | jq '.payload.elapsed_ms'`.
2. For `--follow`, warn that the command does not auto-terminate; suggest Ctrl-C.
3. Default to non-JSON unless user asks for machine parsing.

## Event schema (v1)

`{schema_version, ts, task_id, spawn_id, agent, event_type, level, payload}`

Tier 1 (all modes): `spawn.start` + `spawn.end` (outcome: success|timeout|error).
Tier 2 (LLM modes): `llm.request` + `llm.response` (outcome: success|timeout|error|schema_violation).
