---
name: tail
description: "Tail .sgc/progress/events.ndjson — structured event stream. Filter by task/agent/event_type/since; --follow for tail -f behavior."
---

# /sgc:tail

Operator-facing read surface over the Invariant §13 event audit log.

## Invocation

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise, for a Scope the list shows for sgc@sgc, run claude plugin uninstall sgc@sgc --scope <scope> && claude plugin install sgc@sgc --scope <scope>. The list can include other projects' installs; an uninstall that fails changes nothing, so then try the next Scope" >&2; exit 1; }

sgc.mjs tail                                   # all events, human-readable
sgc.mjs tail --json                            # raw NDJSON
sgc.mjs tail --task <task_id>
sgc.mjs tail --agent 'planner.*'               # glob match
sgc.mjs tail --event-type 'llm.'               # substring
sgc.mjs tail --since 2026-05-19T07:00:00Z
sgc.mjs tail --follow                          # tail -f
sgc.mjs tail --limit 20                        # last N matching (initial drain)
```

## What you should do

1. Detect user's diagnostic intent — failure investigation → suggest `--event-type 'llm.' --agent <agent>` ; latency hunt → suggest `--event-type 'spawn.end' --json | jq '.payload.elapsed_ms'`.
2. For `--follow`, warn that the command does not auto-terminate; suggest Ctrl-C.
3. Default to non-JSON unless user asks for machine parsing.

## Event schema (v1)

`{schema_version, ts, task_id, spawn_id, agent, event_type, level, payload}`

Tier 1 (all modes): `spawn.start` + `spawn.end` (outcome: success|timeout|error).
Tier 2 (LLM modes): `llm.request` + `llm.response` (outcome: success|timeout|error|schema_violation).
