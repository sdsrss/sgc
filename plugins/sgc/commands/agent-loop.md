---
name: agent-loop
description: "File-poll helper — list / show / submit pending agent spawns. For external actors (you, in this Claude Code session) to fulfill spawns when no LLM key + no claude CLI are available."
---

# /sgc:agent-loop

The escape hatch when the dispatcher fell back to `file-poll` mode (no `ANTHROPIC_API_KEY`, no `OPENROUTER_API_KEY`, no `claude` CLI). You read the prompt, formulate the YAML response, submit it.

## Invocation

```bash
bun src/sgc.ts agent-loop --list                     # all spawns with [x]/[ ] markers
bun src/sgc.ts agent-loop --show <spawn_id>          # print the prompt for one spawn
bun src/sgc.ts agent-loop --submit <spawn_id>        # read YAML from stdin
bun src/sgc.ts agent-loop --submit <spawn_id> --from /path/to/result.yaml
```

## What you should do

1. `--list` first to see pending spawns.
2. `--show <id>` to read the prompt; produce a YAML response that exactly matches the agent's declared `outputs` (any deviation → §9 OutputShapeMismatch).
3. `--submit <id>` with the YAML; the blocked `sgc <cmd>` call in the other terminal will unblock immediately.

## When to skip this

If `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` is set, the dispatcher uses real LLM modes and this command becomes unnecessary. Check with `bun src/sgc.ts status` — if file-poll spawns are accumulating, an LLM key is the better fix than typing prompts by hand.
