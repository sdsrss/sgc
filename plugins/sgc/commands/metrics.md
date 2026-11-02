---
name: metrics
description: "Four-化 product self-scorecard: 规范化/智能化/自动化/高效化, computed from git-tracked artifacts. Read-only."
---

# /sgc:metrics

Reports sgc's four-化 scorecard — 规范化 (machine-enforced invariants), 智能化 (LLM-invokable subagents, a capacity proxy not a quality score), 自动化 (automated loop steps), 高效化 (install steps · runtime · bundle). Computed live from embedded contracts + compiled loop symbols; read-only, zero LLM, zero writes.

## Invocation

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found — /plugin install sgc, see https://github.com/sdsrss/sgc#install" >&2; exit 1; }

sgc.mjs metrics                  # human-readable scorecard
sgc.mjs metrics --json           # machine form (FourHuaMetrics)
sgc.mjs metrics --write-baseline # sgc source repo only: rewrite its metrics baseline
```

## What you should do

1. Run the CLI verbatim; stream the scorecard.
2. 智能化 is a CAPACITY proxy (how many agents can invoke an LLM), NOT a quality score — say so if asked.
3. `--write-baseline` is a refresh for the sgc source repository only (it rewrites that repo's metrics baseline file); there, `sgc doctor` fails if the baseline drifts from a live recompute.

## Notes

- Read-only. The baseline is a dev/CI drift reference + README source; it is not read at user runtime (the scorecard is computed from the embedded product).
