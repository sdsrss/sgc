---
name: review
description: "Run reviewer.correctness on git diff. L3 additionally dispatches diff-conditional specialists (security / migration / performance / infra)."
---

# /sgc:review

Independent static review of the current diff. Reviewers are AMNESIAC — they do NOT read `solutions/` (Invariant §1).

## Invocation

```bash
if   command -v sgc.mjs >/dev/null 2>&1;         then sgc() { sgc.mjs "$@"; }
elif [ -f "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" ]; then sgc() { node "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" "$@"; }
elif command -v sgc >/dev/null 2>&1;             then :
elif [ -f src/sgc.ts ];                          then sgc() { bun src/sgc.ts "$@"; }
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

sgc review                                # diff against HEAD
sgc review --base <ref>                   # diff against specific ref
sgc review --append-as <suffix>           # follow-up review → <reviewer>.<suffix>.md (F-5)
```

## What you should do

1. Determine the base ref (default HEAD). If user references a feature branch, suggest `--base main`.
2. Run the CLI; stream reviewer verdicts.
3. If verdict=fail and the user wants to ship anyway: surface that Invariant §5 requires `override.reason ≥40 chars` at `sgc ship`, NOT here.

## Invariants enforced at dispatch

- §1 reviewer.* has zero `read:solutions` permission — the dispatcher rejects reads.
- §6 every review report is append-only per (task, stage, reviewer); use `--append-as` for follow-ups.
- §9 reviewer cannot write outside `findings` / `verdict` / `severity` declared outputs.
