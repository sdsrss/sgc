---
slug: 2026-05-28-cso-events-anomaly-spawn-end-missing
status: closed
closed_in: v1.17.2 (2026-05-28)
surfaced_by: GS-5 v1.17.0 self-dogfood (`sgc cso` 2026-05-28T04:45Z)
priority: medium
level: L2
---

## Resolution (v1.17.2)

**Root cause (all 9 entries)**: process-level SIGINT/SIGTERM termination
bypasses Bun's await-stack unwinding, so spawn.ts's `try { ... } finally
{ emit spawn.end }` is skipped when the user Ctrl+Cs during an in-flight
LLM call. Per-entry timeline proves it:

```
spawn.start  T+0ms
llm.request  T+1ms      ← runOpenRouterAgent reached fetch()
(no llm.response, no spawn.end — process died mid-fetch)
```

9/9 unpaired entries match: all openrouter mode, all clarifier.discover or
planner.adversarial (long LLM calls), all show llm.request fired but no
llm.response. The 277 paired spawn.ends include 7 with `outcome=error`
(LLM throws DO emit spawn.end — finally runs on exceptions), proving the
try/finally is structurally correct. The only failure mode is hard process
termination.

**Forward fix**: `src/dispatcher/spawn.ts` now maintains a module-level
`Map<spawnId, OpenSpawnEntry>` registry. spawn() registers on spawn.start
emit, deregisters in finally. A lazily-installed SIGINT + SIGTERM handler
drains the registry on signal — synthesizing a paired `spawn.end` with
`outcome="interrupted"`, `signal="SIGINT"|"SIGTERM"`, `elapsed_ms`, level=warn
— before re-raising via `process.exit(128+N)`. 5 new unit tests in
`tests/dispatcher/spawn-interrupt.test.ts`.

**Retroactive cleanup**: appended 9 synthetic spawn.end events to
`.sgc/progress/events.ndjson` with `outcome="interrupted"`, `signal="unknown"`,
`note="retroactive synthesis: pre-v1.18 SIGINT handler did not exist"`.

**Verify command (Iron Law #2)**:
```
$ bun src/sgc.ts cso
events-anomaly: pass (0 finding(s), 0 warning(s))
```
Pre-fix: 9 findings. Post-fix: 0.

# Follow-up: events.ndjson has 9 historical unpaired spawn.start entries

## Surfaced by

First `sgc cso` invocation against sgc repo after v1.17.0 ship surfaced 9
real Invariant §13 Tier-1 violations in `.sgc/progress/events.ndjson`:

| Agent | Count | Date range |
|---|---|---|
| `clarifier.discover` | 8 | 2026-05-25 ~ 2026-05-26 |
| `planner.adversarial` | 1 | 2026-05-21 (task_id `E569EA1BB28E4468ABAE02043B`) |

All entries are `spawn.start` events with no matching `spawn.end` in
the events stream.

## Hypotheses to investigate

1. **clarifier.discover early-throw path** — when topic validation fails
   or the agent throws before completing, does the spawn wrapper still
   emit `spawn.end`? Look at `src/dispatcher/spawn.ts` event emission
   around the try/catch in `runOpenRouterAgent` / inline stub failure.
2. **planner.adversarial L3 abort** — May 21 event predates several
   planner-cluster refactors; possibly a one-off from an aborted plan
   that never wrote `intent.md`. Single occurrence — investigate but
   may not be a current bug.
3. **clarifier.discover CLI exit path** — `sgc discover` may exit
   process before logger flushes spawn.end. Check ordering between
   `spawn.end` emit and any `process.exit()` / unhandled-rejection
   path.

## Verify command (Iron Law #2)

```sh
bun src/sgc.ts cso
```

Post-fix: `events-anomaly` check should return `pass` with 0 findings
(after the 9 historical entries either get paired by retroactive
`spawn.end` synthesis OR pruned from the events stream).

## Out of scope for this ticket

- Modifying the cso scanner itself (works correctly — these ARE real
  unpaired entries).
- DOG-5 test-file false positives (separate, fixed in v1.17.1).
- `bun audit` non-JSON output ([[2026-05-28-cso-dep-audit-bun-fallback.md]]).
