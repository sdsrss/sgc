---
name: work
description: "Track feature-list progress for the active sgc task. No LLM — just state I/O. Pair with TDD discipline (see skills/work/SKILL.md)."
---

# /sgc:work

Append features, mark them done, or list current state. The dispatcher does NOT infer features — you (the human) refine the list during execution.

## Invocation

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise reinstall it at the Scope shown there: claude plugin uninstall sgc@sgc --scope <scope>, then claude plugin install sgc@sgc --scope <scope>" >&2; exit 1; }

sgc.mjs work                          # list features, highlight active
sgc.mjs work --add "<feature title>"  # append a new feature
# --done REQUIRES --verify-command (close-gate). Operator responsibility —
# sgc records the string, it does NOT execute it.
sgc.mjs work --done <feature_id> --verify-command "<how verified>" [--evidence "<observed>"]
```

## What you should do

1. Read the user's intent: list / add / done.
2. Run the CLI verbatim; surface output.
3. To mark a feature done you MUST pass `--verify-command` — a bare `--done` is refused (parity with `sgc debug close`). Supply the command/check proving the feature works, and optionally `--evidence` naming what you observed.
4. If the user is implementing code, remind once that no production code lands without a failing test first (skill: `superpowers:test-driven-development`, if the superpowers plugin is installed).

## Notes

- `/work` reads `.sgc/decisions/{task_id}/intent.md` (read-only) and writes only to `progress/feature-list.md`.
- Permission per Invariant §1: `/work` has `read:solutions` (allowed; it's the GENERATOR side, not evaluator).
