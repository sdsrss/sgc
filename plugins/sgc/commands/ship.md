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
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise reinstall it at the Scope shown there: claude plugin uninstall sgc@sgc --scope <scope>, then claude plugin install sgc@sgc --scope <scope>" >&2; exit 1; }

sgc.mjs ship                                          # local ship.md only
sgc.mjs ship --auto                                   # refused at L3
sgc.mjs ship --pr                                     # also `gh pr create`
sgc.mjs ship --pr --pr-title "..." --pr-body "..."
sgc.mjs ship --janitor-skip-reason "<≥40 chars>"      # opt-out + logged
sgc.mjs ship --force-compound                         # bypass janitor decision_rules
```

## What you should do

1. If `--pr` is requested, verify `gh auth status` and `git rev-parse @{upstream}` first — abort early if either fails (avoid writing immutable ship.md before push works).
2. For L3, prompt user explicitly: ship.md is IMMUTABLE; confirm before stdin gate.
3. After ship succeeds, surface the janitor decision (compound / skip / update_existing) per Invariant §6.
