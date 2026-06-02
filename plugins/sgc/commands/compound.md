---
name: compound
description: "4-agent compound cluster (context → related → solution → prevention) + dedup → write solutions/{cat}/{slug}.md. Usually janitor-triggered, not direct."
---

# /sgc:compound

Knowledge extraction. Almost always invoked by `janitor.compound` post-ship — direct invocation is for forcing a compound on a task the janitor would skip.

## Invocation

```bash
if   [ -f "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" ]; then SGC="node $CLAUDE_PLUGIN_ROOT/bin/sgc.mjs"
elif command -v sgc >/dev/null 2>&1;          then SGC=sgc
elif test -f src/sgc.ts;                      then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

$SGC compound              # use intent + reviews of active task
$SGC compound --force      # bypass dedup ≥0.85 threshold
$SGC compound --slug <s>   # override filename slug
```

## What you should do

1. Confirm the user understands that direct `/sgc:compound` writes to `solutions/` even if the janitor would have skipped — that's irreversible knowledge accumulation.
2. Run the CLI; surface the dedup verdict (skip / update_existing / compound).
3. If `--force` is requested AND dedup ≥0.85 was the rejecting reason, re-confirm the user wants a near-duplicate entry.

## Invariants enforced

- §3 NO write without `compound.related` first attaching a dedup stamp; the dispatcher enforces this at the `write:solutions` capability boundary.
- §10 atomic — any sub-agent failure aborts the whole cluster (no partial solutions/ writes).
