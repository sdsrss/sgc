---
name: handoff
description: "GS-2 session-state checkpoint — scans .sgc/ across 6 namespaces, derives the Iron Law #2 verify command, writes tasks/<slug>-paused.md for post-compaction recovery."
---

# /sgc:handoff

Capture working state before a context boundary (compaction, /clear, machine switch). Scans `.sgc/` across its 6 namespaces, derives the verify command you'd need to resume, and writes a `tasks/<slug>-paused.md` recovery doc.

## Invocation

```bash
if command -v sgc >/dev/null 2>&1; then SGC=sgc
elif test -f src/sgc.ts; then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — npm i -g @sdsrs/sgc (needs bun≥1.3), or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

$SGC handoff --auto                   # auto-detect slug + state from newest intent.md
$SGC handoff --print <slug>           # print an existing tasks/<slug>-paused.md
```

## What you should do

1. Run `--auto` to checkpoint the active task; stream output and surface the written `tasks/<slug>-paused.md` path.
2. To resume later, Read that file first — it carries the exact verify command (Iron Law #2) needed before claiming any resumed work is done.
3. Suggest running this proactively when the user is at a stopping point or context is about to compact.

## Notes

- Read-only over `.sgc/`; the only write is `tasks/<slug>-paused.md` (scratch recovery, not append-only state).
- `--print <slug>` exits 1 if the paused doc is missing.
