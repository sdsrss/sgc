---
name: debug
description: "GS-4 4-phase systematic-debugging walker (investigate → analyze → hypothesize → implement). `close` is an Iron Law #3 hard-gate requiring root-cause + fix-commit + verify-command."
---

# /sgc:debug

Structured root-cause debugging. Opens an investigation, walks the 4 phases, and refuses to close until you supply a root cause, the fix commit, and a verify command — no "looks fixed" closures.

## Invocation

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise reinstall it at the Scope shown there: claude plugin uninstall sgc@sgc --scope <scope>, then claude plugin install sgc@sgc --scope <scope>" >&2; exit 1; }

sgc.mjs debug start "<one-liner symptom>"   # open an investigation
sgc.mjs debug close --id <id> \
  --root-cause "<why it broke>" \
  --fix-commit <7-40 hex sha> \
  --verify-command "<how the fix was proven>"
sgc.mjs debug --runs                         # list investigations
sgc.mjs debug --status <id>                  # show one investigation
```

## What you should do

1. On `start`, capture the symptom verbatim — do NOT pre-judge the cause.
2. Work the 4 phases in order: investigate (reproduce + evidence) → analyze (pattern) → hypothesize → implement. No fix without a reproduced failure first.
3. On `close`, the Iron Law #3 gate is hard: `--root-cause`, `--fix-commit`, AND `--verify-command` are all required. sgc records the verify command — it does NOT execute it (operator responsibility).

## Notes

- Mirrors the `sgc work --done` verification close-gate — same "evidence before completion" principle.
- If a bug recurs (same signature 3×), it likely belongs in `solutions/` via `/sgc:compound`.
