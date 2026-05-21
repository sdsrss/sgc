---
name: work
description: "Track feature-list progress for the active sgc task. No LLM — just state I/O. Pair with TDD discipline (see skills/work/SKILL.md)."
---

# /sgc:work

Append features, mark them done, or list current state. The dispatcher does NOT infer features — you (the human) refine the list during execution.

## Invocation

```bash
if command -v sgc >/dev/null 2>&1; then SGC=sgc
elif test -f src/sgc.ts; then SGC="bun src/sgc.ts"
else
  printf '%s\n' \
    "ERROR: sgc CLI not found." "" \
    "Install via npm (recommended):" \
    "  npm install -g @sdsrss/sgc       # requires bun >=1.3 runtime" "" \
    "Or clone from source:" \
    "  git clone https://github.com/sdsrss/sgc && cd sgc" \
    "  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install" "" \
    "See https://github.com/sdsrss/sgc#install" >&2
  exit 1
fi

$SGC work                          # list features, highlight active
$SGC work --add "<feature title>"  # append a new feature
$SGC work --done <feature_id>      # mark done, advance active pointer
```

## What you should do

1. Read the user's intent: list / add / done.
2. Run the CLI verbatim; surface output.
3. If the user is implementing code, remind once that no production code lands without a failing test first (skill: `sp:test-driven-development` if available).

## Notes

- `/work` reads `.sgc/decisions/{task_id}/intent.md` (read-only) and writes only to `progress/feature-list.md`.
- Permission per Invariant §1: `/work` has `read:solutions` (allowed; it's the GENERATOR side, not evaluator).
