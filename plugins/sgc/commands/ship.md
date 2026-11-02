---
name: ship
description: "8-gate ship: verify reviews + QA + feature-list, write immutable ship.md, optionally `gh pr create`, then auto-janitor → compound."
---

# /sgc:ship

The terminal step. Gates fail closed.

## Gate sequence

1. Active task exists (current-task.md present)
2. L3 refuses `--auto` (Invariant §4)
3. Feature-list all `done`
4. L1+ has intent.md
5. L1+ has ≥1 code review
6. No `verdict=fail` review without populated `override` (≥40 chars, human signed; Invariant §5)
7. L2+ has qa evidence in `reviews/{task}/qa/`
8. L3 requires interactive 'yes' at stdin
9. `--pr` fail-fast on missing upstream (F-4) — gate 7.5 between qa and L3 confirm

## Invocation

```bash
if   command -v sgc.mjs >/dev/null 2>&1;         then sgc() { sgc.mjs "$@"; }
elif [ -f "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" ]; then sgc() { node "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" "$@"; }
elif command -v sgc >/dev/null 2>&1;             then :
elif [ -f src/sgc.ts ];                          then sgc() { bun src/sgc.ts "$@"; }
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

sgc ship                                          # local ship.md only
sgc ship --auto                                   # refused at L3
sgc ship --pr                                     # also `gh pr create`
sgc ship --pr --pr-title "..." --pr-body "..."
sgc ship --janitor-skip-reason "<≥40 chars>"      # opt-out + logged
sgc ship --force-compound                         # bypass janitor decision_rules
```

## What you should do

1. If `--pr` is requested, verify `gh auth status` and `git rev-parse @{upstream}` first — abort early if either fails (avoid writing immutable ship.md before push works).
2. For L3, prompt user explicitly: ship.md is IMMUTABLE; confirm before stdin gate.
3. After ship succeeds, surface the janitor decision (compound / skip / update_existing) per Invariant §6.
