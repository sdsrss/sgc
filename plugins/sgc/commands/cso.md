---
name: cso
description: "GS-5 pre-ship security review: secret scan + dependency audit + events.ndjson anomaly detection. Append-only report under .sgc/cso/. Exit 1 on fail, 0 on pass/warn."
---

# /sgc:cso

Chief Security Officer pass before shipping. Scans for committed secrets, audits dependencies, and looks for anomalies in the event stream. Fails closed — exit 1 means do not ship until resolved.

## Invocation

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise, for a Scope the list shows for sgc@sgc, run claude plugin uninstall sgc@sgc --scope <scope> && claude plugin install sgc@sgc --scope <scope>. The list can include other projects' installs; an uninstall that fails changes nothing, so then try the next Scope" >&2; exit 1; }

sgc.mjs cso                              # run the security review
```

## What you should do

1. Run the CLI; stream output.
2. If the verdict is `fail` (exit 1), surface each finding and STOP — do not proceed to `/sgc:ship`.
3. On `warn`, summarize the warnings so the user can decide; on `pass`, note it as the pre-ship security gate evidence.

## Notes

- The report is append-only under `.sgc/cso/` per Invariant §6 — re-runs add, never overwrite.
- Dependency-audit schema is tool-specific: `bun audit` and `npm audit` emit different JSON shapes; the parser dispatches per tool.
