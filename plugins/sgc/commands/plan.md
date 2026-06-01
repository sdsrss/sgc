---
name: plan
description: "Classify task L0-L3 and run the planner cluster (eng / ceo / adversarial) + researcher.history. Writes immutable decisions/{id}/intent.md."
---

# /sgc:plan

Classify a task and dispatch the appropriate planner cluster. Detailed semantics live in `plugins/sgc/skills/plan/SKILL.md`.

## Invocation

```bash
if command -v sgc >/dev/null 2>&1; then SGC=sgc
elif test -f src/sgc.ts; then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — npm i -g @sdsrs/sgc (needs bun≥1.3), or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

$SGC plan "<task — one sentence>" \
  --motivation "<≥20-word rationale; required for L1+>" \
  [--level L0|L1|L2|L3]      # upgrade-only override
  [--signed-by <human_id>]   # required for L3 (Invariant §4)
  [--auto]                   # REFUSED at L3
  [--force-new-task]         # override existing handoff
```

## What you should do

1. Parse the user's free-text request into `<task>` (the one-sentence ask) and `<motivation>` (the ≥20-word "why"). If motivation is missing/short, ask once before invoking.
2. Detect L3 keywords (migration, schema, prod, infra, auth-rewrite) — if present, prompt for `--signed-by` first.
3. Run the CLI; stream output verbatim.
4. After completion, surface the suggested next step (typically `sgc work` or, for L3, the interactive 'yes' gate).

## Invariants (do not bypass)

- §2 decisions are immutable after write — if intent is wrong, create a new task with `parent_decision`.
- §4 L3 + `--auto` is refused at the dispatcher level.
- §11 classifier must emit a concrete rationale; empty rationale aborts.
