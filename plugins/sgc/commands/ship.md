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

$SGC ship                                          # local ship.md only
$SGC ship --auto                                   # refused at L3
$SGC ship --pr                                     # also `gh pr create`
$SGC ship --pr --pr-title "..." --pr-body "..."
$SGC ship --janitor-skip-reason "<≥40 chars>"      # opt-out + logged
$SGC ship --force-compound                         # bypass janitor decision_rules
```

## What you should do

1. If `--pr` is requested, verify `gh auth status` and `git rev-parse @{upstream}` first — abort early if either fails (avoid writing immutable ship.md before push works).
2. For L3, prompt user explicitly: ship.md is IMMUTABLE; confirm before stdin gate.
3. After ship succeeds, surface the janitor decision (compound / skip / update_existing) per Invariant §6.

## SSH push gotcha

On this machine, GitHub SSH banner fails in fresh shells. Same-call workaround:
```bash
eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519_github && git push -u origin "$(git branch --show-current)"
```
