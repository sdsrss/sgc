---
name: work
description: "Track feature-list progress for the active sgc task. No LLM — just state I/O. Pair with TDD discipline (see skills/work/SKILL.md)."
---

# /sgc:work

Append features, mark them done, or list current state. The dispatcher does NOT infer features — you (the human) refine the list during execution.

## Invocation

```bash
if   command -v sgc.mjs >/dev/null 2>&1;         then sgc() { sgc.mjs "$@"; }
elif [ -f "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" ]; then sgc() { node "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" "$@"; }
elif command -v sgc >/dev/null 2>&1;             then :
elif [ -f src/sgc.ts ];                          then sgc() { bun src/sgc.ts "$@"; }
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

sgc work                          # list features, highlight active
sgc work --add "<feature title>"  # append a new feature
# --done REQUIRES --verify-command (close-gate). Operator responsibility —
# sgc records the string, it does NOT execute it.
sgc work --done <feature_id> --verify-command "<how verified>" [--evidence "<observed>"]
```

## What you should do

1. Read the user's intent: list / add / done.
2. Run the CLI verbatim; surface output.
3. To mark a feature done you MUST pass `--verify-command` — a bare `--done` is refused (parity with `sgc debug close`). Supply the command/check proving the feature works, and optionally `--evidence` naming what you observed.
4. If the user is implementing code, remind once that no production code lands without a failing test first (skill: `sp:test-driven-development` if available).

## Notes

- `/work` reads `.sgc/decisions/{task_id}/intent.md` (read-only) and writes only to `progress/feature-list.md`.
- Permission per Invariant §1: `/work` has `read:solutions` (allowed; it's the GENERATOR side, not evaluator).
