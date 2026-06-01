---
name: doctor
description: "Consistency scan across contracts/sgc-capabilities.yaml ↔ prompts/ ↔ slot-only annotations. Zero LLM, read-only. Exit 1 on any failure."
---

# /sgc:doctor

Pre-PR / pre-ship sanity check that the three name registries agree:

1. Every manifest with `prompt_path` declared has the referenced file in `prompts/`
2. Every `prompts/*.md` file is referenced by some manifest (orphans → warn)
3. Every `status: slot-only` entry has `prompt_path: null` (slot-only = documented placeholder, not LLM-routable)

## Invocation

```bash
if command -v sgc >/dev/null 2>&1; then SGC=sgc
elif test -f src/sgc.ts; then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — npm i -g @sdsrs/sgc (needs bun≥1.3), or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

$SGC doctor
```

## What you should do

1. Run the CLI verbatim.
2. If `fail` count > 0: CI / pre-PR gate should refuse — fix the listed mismatches before continuing.
3. `warn` count > 0 (orphan prompts) is informational — either remove the file or wire it into a manifest.

## Notes

- Read-only across all state — no `.sgc/` writes, no LLM calls.
- Exit code: 0 if `fail == 0`, 1 otherwise. Suitable for CI gates and pre-commit hooks.
- For runtime LLM routing concerns (which mode resolved + why), see `resolveModeDebug` in `src/dispatcher/spawn.ts` (added in P6 audit follow-up).
