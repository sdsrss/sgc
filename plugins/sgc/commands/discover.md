---
name: discover
description: "Turn vague topic into structured forcing-questions (goal / constraints / scope / edge-cases / acceptance). Feeds into sgc plan --motivation."
---

# /sgc:discover

When the user has an idea but the requirements are fuzzy. clarifier.discover emits ~20 forcing-questions so the user's answer can be dropped directly into `sgc plan --motivation`.

## Invocation

```bash
bun src/sgc.ts discover "<vague topic>"
```

## What you should do

1. Capture the user's free-text topic (one phrase to one paragraph).
2. Run the CLI; surface the question groups.
3. Offer to capture the user's answers and re-format them as a single `--motivation` string for `/sgc:plan`.

## Notes

- `/discover` writes nothing — its output is hand-carried by the user into `/sgc:plan`.
- Currently an inline-stub agent (heuristic). Real-LLM version is on the H+1 roadmap.
- Pairs well with the `office-hours` skill from gstack (if installed) for the deeper brainstorm pass.
