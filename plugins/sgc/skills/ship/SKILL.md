---
name: ship
description: "Use when ready to release - verifies all evidence, runs ship gate, handles deployment, triggers compound janitor"
---

# Ship

Run the ship gate, write immutable `decisions/{id}/ship.md`, optionally open a PR, auto-trigger `janitor.compound`. Every gate failure surfaces a specific error — do not bypass.

**Core principle:** every ship is backed by on-disk evidence. No evidence, no ship.

## When to Use

- User runs `/ship` after `/work` + `/review` (+ `/qa` for L2+)
- All features in `progress/feature-list.md` marked done

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R+W |
| progress | R |
| solutions | — |
| reviews | RW |

## Routing

- **Behavior**: [`src/commands/ship.ts`](../../../../src/commands/ship.ts) (`runShip`)
- **Gate checks** (in order): active task exists · all features done · ≥1 code review · qa evidence for L2+ · no unresolved `fail` verdicts (without `--override` ≥40)
- **L3 gate**: refuses `--auto`; prompts interactive `yes` confirmation (§4)
- **PR integration**: [`src/dispatcher/gh-runner.ts`](../../../../src/dispatcher/gh-runner.ts) — `--pr` shells `gh pr create`
- **Auto-janitor**: [`src/dispatcher/agents/janitor-compound.ts`](../../../../src/dispatcher/agents/janitor-compound.ts) — decision logged even on skip (§6)
- **Invariants**: §4 L3 no-auto · §5 override ≥40 · §6 janitor always logged · §10 compound atomic

## Invocation

```bash
sgc ship                                       # interactive at L3
sgc ship --auto                                # L0/L1/L2; refused at L3
sgc ship --pr                                  # + gh pr create
sgc ship --override "<≥40 char reason>"         # ship despite a fail review
sgc ship --janitor-skip-reason "<≥40>"         # §6-compliant skip log
sgc ship --force-compound                      # bypass janitor decision_rules
```

## Gate failure behavior

Each gate names itself in the error (`features not done`, `no code reviews`, `qa evidence missing`, `fail verdict without override`). Fix the underlying evidence; do not retry with `--auto`.

## Compound branch (post-ship)

If the janitor decides `compound` or `update_existing`, `runCompound` executes inside ship. Failure there is **non-fatal** to ship — `ship.md` is already committed; the compound failure is logged but the ship decision stands. §10 atomicity guarantees no partial solution write.
