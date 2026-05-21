---
name: review
description: "Run reviewer.correctness on git diff. L3 additionally dispatches diff-conditional specialists (security / migration / performance / infra)."
---

# /sgc:review

Independent static review of the current diff. Reviewers are AMNESIAC — they do NOT read `solutions/` (Invariant §1).

## Pre-flight

```bash
test -f src/sgc.ts || { printf "%s\n" "ERROR: sgc CLI not in current directory." "" "Install once per project (plugin layer is markdown-only; CLI is a separate clone):" "  git clone https://github.com/sdsrss/sgc && cd sgc" "  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install" "" "Then re-run from the sgc/ directory." "See https://github.com/sdsrss/sgc#install for the canonical install reference." >&2; exit 1; }
```

## Invocation

```bash
bun src/sgc.ts review                                # diff against HEAD
bun src/sgc.ts review --base <ref>                   # diff against specific ref
bun src/sgc.ts review --append-as <suffix>           # follow-up review → <reviewer>.<suffix>.md (F-5)
```

## What you should do

1. Determine the base ref (default HEAD). If user references a feature branch, suggest `--base main`.
2. Run the CLI; stream reviewer verdicts.
3. If verdict=fail and the user wants to ship anyway: surface that Invariant §5 requires `override.reason ≥40 chars` at `sgc ship`, NOT here.

## Invariants enforced at dispatch

- §1 reviewer.* has zero `read:solutions` permission — the dispatcher rejects reads.
- §6 every review report is append-only per (task, stage, reviewer); use `--append-as` for follow-ups.
- §9 reviewer cannot write outside `findings` / `verdict` / `severity` declared outputs.
