---
name: discover
description: "Turn vague topic into structured forcing-questions (goal / constraints / scope / edge-cases / acceptance). Feeds into sgc plan --motivation."
---

# /sgc:discover

When the user has an idea but the requirements are fuzzy. clarifier.discover emits ~20 forcing-questions so the user's answer can be dropped directly into `sgc plan --motivation`.

## Invocation

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise, for a Scope the list shows for sgc@sgc, run claude plugin uninstall sgc@sgc --scope <scope> && claude plugin install sgc@sgc --scope <scope>. The list can include other projects' installs; an uninstall that fails changes nothing, so then try the next Scope" >&2; exit 1; }

sgc.mjs discover "<vague topic>"
```

## What you should do

1. Capture the user's free-text topic (one phrase to one paragraph).
2. Run the CLI; surface the question groups.
3. Offer to capture the user's answers and re-format them as a single `--motivation` string for `/sgc:plan`.

## Notes

- `/discover` writes nothing — its output is hand-carried by the user into `/sgc:plan`.
- Currently an inline-stub agent (heuristic). Real-LLM version is on the H+1 roadmap.
- Pairs well with the `office-hours` skill from gstack (if installed) for the deeper brainstorm pass.
