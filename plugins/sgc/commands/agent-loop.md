---
name: agent-loop
description: "File-poll helper — list / show / submit pending agent spawns. For external actors (you, in this Claude Code session) to fulfill spawns when no LLM key + no claude CLI are available."
---

# /sgc:agent-loop

The escape hatch when the dispatcher fell back to `file-poll` mode (no `ANTHROPIC_API_KEY`, no `OPENROUTER_API_KEY`, no `claude` CLI). You read the prompt, formulate the YAML response, submit it.

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

$SGC agent-loop --list                     # all spawns with [x]/[ ] markers
$SGC agent-loop --show <spawn_id>          # print the prompt for one spawn
$SGC agent-loop --submit <spawn_id>        # read YAML from stdin
$SGC agent-loop --submit <spawn_id> --from /path/to/result.yaml
```

## What you should do

1. `--list` first to see pending spawns.
2. `--show <id>` to read the prompt; produce a YAML response that exactly matches the agent's declared `outputs` (any deviation → §9 OutputShapeMismatch).
3. `--submit <id>` with the YAML; the blocked `sgc <cmd>` call in the other terminal will unblock immediately.

## When to skip this

If `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` is set, the dispatcher uses real LLM modes and this command becomes unnecessary. Check with `bun src/sgc.ts status` — if file-poll spawns are accumulating, an LLM key is the better fix than typing prompts by hand.
