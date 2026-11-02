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

- **Behavior**: [`src/commands/ship.ts`](https://github.com/sdsrss/sgc/blob/main/src/commands/ship.ts) (`runShip`)
- **Gate checks** (in order): active task exists · all features done · ≥1 code review · qa evidence for L2+ · no unresolved `fail` verdicts (without `--override` ≥40)
- **L3 gate**: refuses `--auto`; prompts interactive `yes` confirmation (§4)
- **PR integration**: [`src/dispatcher/gh-runner.ts`](https://github.com/sdsrss/sgc/blob/main/src/dispatcher/gh-runner.ts) — `--pr` shells `gh pr create`
- **Auto-janitor**: [`src/dispatcher/agents/janitor-compound.ts`](https://github.com/sdsrss/sgc/blob/main/src/dispatcher/agents/janitor-compound.ts) — decision logged even on skip (§6)
- **Invariants**: §4 L3 no-auto · §5 override ≥40 · §6 janitor always logged · §10 compound atomic

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise, for a Scope the list shows for sgc@sgc, run claude plugin uninstall sgc@sgc --scope <scope> && claude plugin install sgc@sgc --scope <scope>. The list can include other projects' installs; an uninstall that fails changes nothing, so then try the next Scope" >&2; exit 1; }

sgc.mjs ship $ARGUMENTS
```

## Gate failure behavior

Each gate names itself in the error (`features not done`, `no code reviews`, `qa evidence missing`, `fail verdict without override`). Fix the underlying evidence; do not retry with `--auto`.

## Compound branch (post-ship)

If the janitor decides `compound` or `update_existing`, `runCompound` executes inside ship. Failure there is **non-fatal** to ship — `ship.md` is already committed; the compound failure is logged but the ship decision stands. §10 atomicity guarantees no partial solution write.

## Delegation hint

For git/PR/deploy workflows beyond sgc's ship gate:
- gstack's `/ship` skill (if installed) — detect base branch, run tests, bump VERSION, update CHANGELOG, create PR
- gstack's `/land-and-deploy` skill (if installed) — merge the PR, wait for CI, verify production health
