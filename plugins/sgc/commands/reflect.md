---
name: reflect
description: "CE-2 audit: which solutions/ preventions surfaced in intent.md discussions. Read-only, heuristic-only. CE-6 annotates applied:N (L3 reuse) + surfaced:N (L2 reuse)."
---

# /sgc:reflect

Read-only audit of `.sgc/decisions/*/intent.md` motivations against `.sgc/solutions/*/*.md` `prevention:` fields. Each match is classified `discussed` (the pre-mortem referenced it) or `silent` (the prevention existed but no decision mentioned it). Zero LLM, zero writes (unless `--save`).

## Invocation

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found — /plugin install sgc, see https://github.com/sdsrss/sgc#install" >&2; exit 1; }

sgc.mjs reflect                          # audit all decisions/
sgc.mjs reflect --task <task_id>         # audit one task
sgc.mjs reflect --since 2026-05-01       # decisions created on/after date
sgc.mjs reflect --save                   # write reports to reflections/<task_id>.md
sgc.mjs reflect --json                   # emit ReflectReport[] for tooling
```

## What you should do

1. Run the CLI verbatim; stream output.
2. Surface the `silent` matches first — those are preventions that existed but were not consulted during planning (the actionable signal).
3. CE-6: each candidate shows `applied: N` (L3 adversarial-validated reuse) and `surfaced: N` (L2+ `researcher.history` reuse). Higher = the prevention is paying off.

## Notes

- `--save` writes to `<stateRoot>/reflections/` (replace-on-rerun), which lives OUTSIDE the Invariant §6 append-only `reviews/` namespace — re-running overwrites, no append.
- Permission: read-only across `decisions / progress / solutions / reviews`.
