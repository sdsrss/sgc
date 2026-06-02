---
name: loop
description: "CE-5 end-to-end orchestrator: plan → [pause work] → review → qa → [pause ship] → compound. Manual gates at work + ship; --resume continues a paused/failed run."
---

# /sgc:loop

The full sgc pipeline in one command. Chains `plan → [pause work] → review → qa → [pause ship] → compound`, pausing at the two human-owned gates (`work` = operator implements; `ship` = Invariant §4 L3 signature). L0 auto-skips review/qa/ship/compound.

## Invocation

```bash
if   [ -f "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" ]; then SGC="node $CLAUDE_PLUGIN_ROOT/bin/sgc.mjs"
elif command -v sgc >/dev/null 2>&1;          then SGC=sgc
elif test -f src/sgc.ts;                      then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

$SGC loop "<task — one sentence>" \
  --motivation "<≥20-word rationale, passed through to plan>" \
  [--level L0|L1|L2|L3] [--signed-by <human_id>]
$SGC loop --resume <run-id>            # continue a paused/failed run
$SGC loop --runs                       # list runs (running/paused/failed/complete)
$SGC loop --status <run-id>            # one run: frontmatter + per-step table
```

## What you should do

1. Parse the user's request into `<task>` + `<motivation>` (≥20 words). If motivation is missing, ask once before invoking (same rule as `/sgc:plan`).
2. Run the CLI; stream output. The loop will PAUSE at `work` — that is expected, not a failure.
3. When it pauses at `work`, implement the feature (TDD: `sp:test-driven-development` if available), then `--resume <run-id>`.
4. It pauses again at `ship` for the L3 human gate — surface the run-id and let the user confirm.

## Notes

- A fresh `loop` refuses if a prior run for the same task is `running` / `paused` / `failed` — use `--resume <run-id>` or delete the stale run.
- `--resume` retries a `failed` step (fail-fast: any step throw → run.failed_step + exit 1).
- Pass-through flags `--motivation` / `--level` / `--signed-by` reach the inner `plan`.
