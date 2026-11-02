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
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found — reinstall the sgc plugin in a terminal: claude plugin uninstall sgc@sgc, then claude plugin install sgc@sgc" >&2; exit 1; }

sgc.mjs cso                              # run the security review
```

## What you should do

1. Run the CLI; stream output.
2. If the verdict is `fail` (exit 1), surface each finding and STOP — do not proceed to `/sgc:ship`.
3. On `warn`, summarize the warnings so the user can decide; on `pass`, note it as the pre-ship security gate evidence.

## Notes

- The report is append-only under `.sgc/cso/` per Invariant §6 — re-runs add, never overwrite.
- Dependency-audit schema is tool-specific: `bun audit` and `npm audit` emit different JSON shapes; the parser dispatches per tool.
