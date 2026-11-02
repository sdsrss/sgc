---
name: debug
description: "GS-4 4-phase systematic-debugging walker (investigate → analyze → hypothesize → implement). `close` is an Iron Law #3 hard-gate requiring root-cause + fix-commit + verify-command."
---

# /sgc:debug

Structured root-cause debugging. Opens an investigation, walks the 4 phases, and refuses to close until you supply a root cause, the fix commit, and a verify command — no "looks fixed" closures.

## Invocation

```bash
if   command -v sgc.mjs >/dev/null 2>&1;         then sgc() { sgc.mjs "$@"; }
elif [ -f "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" ]; then sgc() { node "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" "$@"; }
elif command -v sgc >/dev/null 2>&1;             then :
elif [ -f src/sgc.ts ];                          then sgc() { bun src/sgc.ts "$@"; }
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

sgc debug start "<one-liner symptom>"   # open an investigation
sgc debug close --id <id> \
  --root-cause "<why it broke>" \
  --fix-commit <7-40 hex sha> \
  --verify-command "<how the fix was proven>"
sgc debug --runs                         # list investigations
sgc debug --status <id>                  # show one investigation
```

## What you should do

1. On `start`, capture the symptom verbatim — do NOT pre-judge the cause.
2. Work the 4 phases in order: investigate (reproduce + evidence) → analyze (pattern) → hypothesize → implement. No fix without a reproduced failure first.
3. On `close`, the Iron Law #3 gate is hard: `--root-cause`, `--fix-commit`, AND `--verify-command` are all required. sgc records the verify command — it does NOT execute it (operator responsibility).

## Notes

- Mirrors the `sgc work --done` verification close-gate — same "evidence before completion" principle.
- If a bug recurs (same signature 3×), it likely belongs in `solutions/` via `/sgc:compound`.
