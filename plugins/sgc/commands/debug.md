---
name: debug
description: "GS-4 4-phase systematic-debugging walker (investigate → analyze → hypothesize → implement). `close` is an Iron Law #3 hard-gate requiring root-cause + fix-commit + verify-command."
---

# /sgc:debug

Structured root-cause debugging. Opens an investigation, walks the 4 phases, and refuses to close until you supply a root cause, the fix commit, and a verify command — no "looks fixed" closures.

## Invocation

```bash
if   [ -f "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" ]; then SGC="node $CLAUDE_PLUGIN_ROOT/bin/sgc.mjs"
elif command -v sgc >/dev/null 2>&1;          then SGC=sgc
elif test -f src/sgc.ts;                      then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

$SGC debug start "<one-liner symptom>"   # open an investigation
$SGC debug close --id <id> \
  --root-cause "<why it broke>" \
  --fix-commit <7-40 hex sha> \
  --verify-command "<how the fix was proven>"
$SGC debug --runs                         # list investigations
$SGC debug --status <id>                  # show one investigation
```

## What you should do

1. On `start`, capture the symptom verbatim — do NOT pre-judge the cause.
2. Work the 4 phases in order: investigate (reproduce + evidence) → analyze (pattern) → hypothesize → implement. No fix without a reproduced failure first.
3. On `close`, the Iron Law #3 gate is hard: `--root-cause`, `--fix-commit`, AND `--verify-command` are all required. sgc records the verify command — it does NOT execute it (operator responsibility).

## Notes

- Mirrors the `sgc work --done` verification close-gate — same "evidence before completion" principle.
- If a bug recurs (same signature 3×), it likely belongs in `solutions/` via `/sgc:compound`.
