---
name: metrics
description: "Four-化 product self-scorecard: 规范化/智能化/自动化/高效化, computed from git-tracked artifacts. Read-only."
---

# /sgc:metrics

Reports sgc's four-化 scorecard — 规范化 (machine-enforced invariants), 智能化 (LLM-invokable subagents, a capacity proxy not a quality score), 自动化 (automated loop steps), 高效化 (install steps · runtime · bundle). Computed live from embedded contracts + compiled loop symbols; read-only, zero LLM, zero writes.

## Invocation

```bash
if   [ -f "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" ]; then SGC="node $CLAUDE_PLUGIN_ROOT/bin/sgc.mjs"
elif command -v sgc >/dev/null 2>&1;          then SGC=sgc
elif test -f src/sgc.ts;                      then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

$SGC metrics                  # human-readable scorecard
$SGC metrics --json           # machine form (FourHuaMetrics)
$SGC metrics --write-baseline # dev: recompute + rewrite metrics/metrics-baseline.yaml
```

## What you should do

1. Run the CLI verbatim; stream the scorecard.
2. 智能化 is a CAPACITY proxy (how many agents can invoke an LLM), NOT a quality score — say so if asked.
3. `--write-baseline` is a dev-only refresh; `sgc doctor` fails if `metrics/metrics-baseline.yaml` drifts from a live recompute.

## Notes

- Read-only. The baseline is a dev/CI drift reference + README source; it is not read at user runtime (the scorecard is computed from the embedded product).
