---
name: discover
description: "Turn vague topic into structured forcing-questions (goal / constraints / scope / edge-cases / acceptance). Feeds into sgc plan --motivation."
---

# /sgc:discover

When the user has an idea but the requirements are fuzzy. clarifier.discover emits ~20 forcing-questions so the user's answer can be dropped directly into `sgc plan --motivation`.

## Invocation

```bash
if command -v sgc >/dev/null 2>&1; then SGC=sgc
elif test -f src/sgc.ts; then SGC="bun src/sgc.ts"
else
  printf '%s\n' \
    "ERROR: sgc CLI not found." "" \
    "Install via npm (recommended):" \
    "  npm install -g @sdsrs/sgc       # requires bun >=1.3 runtime" "" \
    "Or clone from source:" \
    "  git clone https://github.com/sdsrss/sgc && cd sgc" \
    "  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install" "" \
    "See https://github.com/sdsrss/sgc#install" >&2
  exit 1
fi

$SGC discover "<vague topic>"
```

## What you should do

1. Capture the user's free-text topic (one phrase to one paragraph).
2. Run the CLI; surface the question groups.
3. Offer to capture the user's answers and re-format them as a single `--motivation` string for `/sgc:plan`.

## Notes

- `/discover` writes nothing — its output is hand-carried by the user into `/sgc:plan`.
- Currently an inline-stub agent (heuristic). Real-LLM version is on the H+1 roadmap.
- Pairs well with the `office-hours` skill from gstack (if installed) for the deeper brainstorm pass.
