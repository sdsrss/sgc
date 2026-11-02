---
name: discover
description: "Use when requirements are unclear, before planning - clarifies goals, constraints, and acceptance criteria through structured questioning"
---

# Discover

Take a vague topic; emit structured forcing-questions (goal / constraints / scope / edge cases / acceptance) plus a concrete `sgc plan` follow-up. The user answers the questions inline, then carries the consolidated answer into `sgc plan --motivation`.

**Core principle:** ambiguity in requirements multiplies into bugs in code. Eliminate it before writing a single line.

## When to Use

- User says "I want to build..." but details are vague
- Requirements have obvious gaps or contradictions
- Multiple valid interpretations exist for the same request
- Before `/plan` when the task is L2+ and scope is unclear

## Permission

| Directory | Access |
|-----------|--------|
| decisions | — |
| progress | R |
| solutions | — |
| reviews | — |

Plus `spawn:clarifier.*`. No writes — `discover` cannot mutate `.sgc/` state beyond the spawn audit trail under `progress/agent-prompts/` and `agent-results/`.

## Routing

- **Behavior**: [`src/commands/discover.ts`](https://github.com/sdsrss/sgc/blob/main/src/commands/discover.ts) (`runDiscover`)
- **Agent**: [`src/dispatcher/agents/clarifier-discover.ts`](https://github.com/sdsrss/sgc/blob/main/src/dispatcher/agents/clarifier-discover.ts) — heuristic stub keys off auth / data / ui / perf / api keywords to tune the question set
- **Contract**: `clarifier.discover` manifest in [`contracts/sgc-capabilities.yaml`](https://github.com/sdsrss/sgc/blob/main/contracts/sgc-capabilities.yaml)

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise, for a Scope the list shows for sgc@sgc, run claude plugin uninstall sgc@sgc --scope <scope> && claude plugin install sgc@sgc --scope <scope>. The list can include other projects' installs; an uninstall that fails changes nothing, so then try the next Scope" >&2; exit 1; }

sgc.mjs discover "$ARGUMENTS"
```

Output is structured text with sections Goal / Constraints / Scope / Edge cases / Acceptance / Next. The last section contains the exact `sgc plan ...` command to run after answering.

## Delegation hint

For product-fuzzy requirements exploration beyond sgc's forcing questions:
- gstack's `/office-hours` skill (if installed) — YC-style brainstorming for demand reality, wedge identification, and design docs

## Pattern (what the agent emits)

1. **Goal**: "When X is done, what can the user do that they can't do today?"
2. **Constraints** (3-4): performance / platform / timeline + domain-tuned (threat-model for auth, rollback plan for migrations, baseline+target for perf).
3. **Scope** (2-3): what's explicitly OUT, breaking vs additive, replace vs augment.
4. **Edge cases** (3-4): empty/malformed/enormous input, concurrency, dependency failure, token lifecycle (auth).
5. **Acceptance** (2-3): test / URL / log line that proves done; smallest user-visible change.

If an active task exists (`progress/current-task.md`), its id + level show up in the suggested-next hint as context.
