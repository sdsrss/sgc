---
name: work
description: "Use when executing an approved plan - implements with TDD discipline, systematic debugging, worktree isolation, and progress tracking"
---

# Work

Execute an approved plan; track completion in `progress/feature-list.md`.

**Core principle:** no production code without a failing test first. Evidence at every step.

## When to Use

- User runs `/work` after `/plan` produced an intent and feature list
- Resuming work on an in-progress task

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | RW |
| solutions | R |
| reviews | — |

`reviews/` is intentionally locked — work must not self-select based on pending review verdicts.

## Routing

- **Behavior**: [`src/commands/work.ts`](../../../../src/commands/work.ts) (`runWork`)
- **State I/O**: feature-list + current-task files in [`src/dispatcher/state.ts`](../../../../src/dispatcher/state.ts)
- **TDD / debugging / worktree discipline**: authoritative in the user's global spec
  (`~/.claude/CLAUDE.md` §7 validate, `CLAUDE-extended.md` §6 debug / §7-EXT evidence ladder),
  not duplicated here.
- **System overview**: [`plugins/sgc/CLAUDE.md`](../../CLAUDE.md)

## Invocation

```bash
sgc work --add "<feature description>"   # append a feature to progress/feature-list.md
sgc work --done <feature_id>               # mark a feature complete
sgc work                                   # show current feature-list status
```

`work` does NOT spawn review agents. Call `sgc review` (and `sgc qa` for L2+) when all features are done.
