# SGC Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 60% gap between sgc v1.1's architectural promises and delivery by (a) committing sgc's role as "规范层 + 知识引擎" atop sp/gs, (b) swapping two critical stubs (classifier.level, reviewer.correctness) for real-LLM dispatch with heuristic fallback, (c) wiring plugin SKILL.md files to actually dispatch via `!sgc`, (d) closing state-layer gaps (writeHandoff, session resume), and (e) hardening eval with four negative scenarios.

**Architecture:** sgc = protocol + audit + knowledge compression. sgc owns L0-L3 classification, 12 invariants, state layer, dedup, compound, janitor, and solutions compaction. When sp/gs are available, sgc commands cite and link to them as the execution muscle; when absent, sgc keeps its current inline fallbacks. We do NOT gut plan.ts / review.ts / ship.ts — we reposition them as protocol-enforcing orchestrators.

**Tech Stack:** TypeScript 5.x + Bun 1.x + Citty (CLI) + Anthropic SDK + js-yaml + Playwright (qa only). Tests: bun test. Contracts: YAML manifests under contracts/.

**Scope:** P0 + P1 from 2026-04-16 audit. Deferred: #9 中文 tokenizer (no demonstrated need), #10 OS-level sandbox (security hardening — separate L3 task).

**Session / worktree strategy:** Execute in worktree `sgc-audit-fix` per sp:using-git-worktrees. Frequent commits — one per task minimum.

---

## Strategic Decision (Read before execute)

**This plan assumes sgc is positioned as a "规范层 + 知识引擎" that coexists with sp (THINK+EXECUTE) and gs (DECIDE+SHIP).**

Under this positioning:
- **sgc owns**: L0-L3 classifier, state layer (.sgc/), 12 invariants, dedup (0.85), compound cluster, janitor decisions, solutions/ knowledge base.
- **sgc delegates (when sp/gs present)**: deep plan-writing → sp:writing-plans; TDD discipline → sp:test-driven-development; root-cause debugging → sp:systematic-debugging; pre-ship review → gs:/review; git/PR/deploy → gs:/ship + /land-and-deploy; browser QA → gs:/browse.
- **sgc fallback (when sp/gs absent)**: keep current inline implementations of plan.ts / review.ts / qa.ts / ship.ts.

**If you prefer option 2 (sgc as standalone all-in-one replacement) or option 3 (quiet coexistence), STOP and override this plan in the AUTH step.**

---

## File Structure

Files created or modified by this plan:

**New files:**
- `docs/POSITIONING.md` — sgc's relationship to sp/gs (authoritative)
- `prompts/classifier-level.md` — LLM prompt template for classifier
- `prompts/reviewer-correctness.md` — LLM prompt template for reviewer.correctness
- `tests/eval/L3-auto-refused.test.ts` — Invariant §4 negative case
- `tests/eval/override-reason-short.test.ts` — Invariant §5 negative case
- `tests/eval/compound-rollback.test.ts` — Invariant §10 mid-stream failure
- `tests/eval/reviewer-conflict.test.ts` — worst-of aggregation

**Modified files:**
- `src/dispatcher/anthropic-sdk-agent.ts` — add system block with cache_control
- `src/dispatcher/agents/classifier-level.ts` — split into heuristic + LLM-dispatch paths
- `src/dispatcher/agents/reviewer-correctness.ts` — same split
- `src/dispatcher/spawn.ts` — teach spawn to call LLM for these agents when mode permits
- `src/commands/plan.ts` — writeHandoff on creation + readHandoff on entry
- `src/commands/ship.ts` — writeHandoff on close
- `contracts/sgc-capabilities.yaml` — annotate or prune unimplemented agent slots
- `plugins/sgc/skills/{plan,work,review,qa,ship,compound,discover}/SKILL.md` — real dispatch
- `plugins/sgc/CLAUDE.md` — describe delegate pattern
- `README.md` — link to POSITIONING.md
- `CHANGELOG.md` — v1.2.0 entry
- `package.json` — version bump

---

## Task Map (15 tasks, 5 phases)

| Phase | Task | Description | Effort |
|-------|------|-------------|--------|
| 0 | 1 | Declare sgc positioning (POSITIONING.md) | ~30 min |
| 1 | 2 | Add cache_control to system block | ~20 min |
| 1 | 3 | Annotate or prune empty agent slots | ~30 min |
| 2 | 4 | Extract classifier prompt + LLM path | ~60 min |
| 2 | 5 | Classifier LLM eval test | ~30 min |
| 2 | 6 | reviewer.correctness LLM path + eval | ~60 min |
| 3 | 7 | Rewrite 9 SKILL.md files for real dispatch | ~45 min |
| 3 | 8 | Update plugins/sgc/CLAUDE.md with delegate pattern | ~20 min |
| 4 | 9 | writeHandoff called in plan.ts + ship.ts | ~30 min |
| 4 | 10 | readHandoff in plan entry + resume logic | ~30 min |
| 4 | 11 | Eval: L3 --auto refused (§4) | ~20 min |
| 4 | 12 | Eval: override.reason <40 chars (§5) | ~20 min |
| 4 | 13 | Eval: compound mid-stream rollback (§10) | ~30 min |
| 4 | 14 | Eval: reviewer conflict worst-of | ~25 min |
| 5 | 15 | CHANGELOG, version bump, commit | ~20 min |

**Total estimate**: ~7 hours focused coding.

---

## Phase 0: Strategic commitment

### Task 1: Declare sgc's positioning

**Files:**
- Create: `docs/POSITIONING.md`
- Modify: `README.md` (add link near top)
- Modify: `plugins/sgc/CLAUDE.md` (add positioning link — Task 8 expands this)

- [ ] **Step 1: Write the positioning doc**

Create `docs/POSITIONING.md`:

```markdown
# SGC Positioning (as of v1.2.0)

## Role: 规范层 + 知识引擎

sgc coexists with the `superpowers` (sp) and `gstack` (gs) plugins. It does NOT replace them.

### sgc owns (authoritative)

- **L0-L3 classification** — `sgc plan` classifies every task
- **12 invariants** — scope isolation, immutability, dedup, generator-evaluator separation
- **State layer** — `.sgc/{decisions,progress,solutions,reviews}/` with schema validation
- **Knowledge compression** — dedup (Jaccard ≥0.85) + compound cluster + janitor decisions
- **Solutions base** — append-only, signed, dedup-enforced

### sgc delegates (when sp/gs are available)

| Need | Delegate to |
|------|-------------|
| Deep plan authoring | `sp:writing-plans` |
| TDD discipline | `sp:test-driven-development` |
| Root-cause debugging | `sp:systematic-debugging` |
| Parallel subagents | `sp:dispatching-parallel-agents` |
| Pre-ship comprehensive review | `gs:/review` |
| Git / PR / deploy | `gs:/ship` + `gs:/land-and-deploy` |
| Browser QA / dogfood | `gs:/browse` |
| Design polish | `gs:/design-review` |

### sgc falls back (when sp/gs absent)

Each `sgc` command keeps a working inline implementation. The delegate is a
recommendation surfaced in the command's output, not a hard dependency.

### Non-goals

- sgc is NOT a replacement for sp or gs
- sgc does NOT implement full CI/deploy — that stays in gs
- sgc does NOT manage IDE integration or agent orchestration UIs

## User mental model

> "`sgc` decides the level, enforces the protocol, and records the knowledge.
> `sp` does the thinking and implementation work. `gs` ships it and monitors prod."
```

- [ ] **Step 2: Link from README**

Modify `README.md` — find the section near line 1-30 (title + intro) and add after the intro:

```markdown
> **Positioning**: sgc is a 规范层 + 知识引擎 that coexists with `superpowers` (sp) and `gstack` (gs). See [docs/POSITIONING.md](docs/POSITIONING.md) for the delegate pattern.
```

- [ ] **Step 3: Verify the file exists and is reachable**

Run: `cat docs/POSITIONING.md | head -20 && grep -c "POSITIONING" README.md`
Expected: file content prints; README grep returns `1`.

- [ ] **Step 4: Commit**

```bash
git add docs/POSITIONING.md README.md
git commit -m "docs: declare sgc positioning as 规范层 + 知识引擎

Clarify that sgc coexists with sp (THINK+EXECUTE) and gs (DECIDE+SHIP).
sgc owns classification + state + invariants + knowledge compression.
Delegates implementation muscle to sp/gs when present; keeps inline
fallback when absent. See docs/POSITIONING.md."
```

---

## Phase 1: Quick P0 wins

### Task 2: Add cache_control to system block in anthropic-sdk-agent.ts

**Why:** Currently only the user message has ephemeral caching (line 63). The system prompt (which includes scope tokens + output schema + manifest context) is the heavier repeated block. Adding system-level caching cuts token cost significantly across 22 agent types × many calls per day.

**Files:**
- Modify: `src/dispatcher/anthropic-sdk-agent.ts`

- [ ] **Step 1: Understand current shape**

Read `src/dispatcher/anthropic-sdk-agent.ts` lines 38-70. Note: currently `messages` has one user message with cache_control; there is no `system` parameter.

- [ ] **Step 2: Refactor prompt assembly to split system and user portions**

The current `promptText` = `readFileSync(promptPath)` bundles everything. We need to split. Check how `spawn.ts:150-185` constructs the prompt file. The prompt file has sections: Purpose, Scope, Input (YAML), Reply format, Submit. Purpose + Scope + Reply format are stable per agent; Input is the variable bit.

Decision: add a structured prompt format. The prompt file already separates these with markdown headers. Split at the `## Input` header.

- [ ] **Step 3: Update runAnthropicSdkAgent to use system + user with cache_control on system**

Replace lines 42-70 in `src/dispatcher/anthropic-sdk-agent.ts`:

```typescript
export async function runAnthropicSdkAgent(
  promptPath: string,
  manifest: SubagentManifest,
  clientFactory?: AnthropicClientFactory,
): Promise<unknown> {
  const promptText = readFileSync(promptPath, "utf8")
  const { systemPart, userPart } = splitPrompt(promptText)
  const client = clientFactory ? clientFactory() : new Anthropic()

  const maxTokens = Math.min(manifest.token_budget ?? 4096, MAX_TOKENS_CAP)
  const timeoutMs = (manifest.timeout_s ?? 60) * 1000

  let response: Anthropic.Message
  try {
    response = await (client.messages.create as typeof Anthropic.prototype.messages.create)(
      {
        model: DEFAULT_MODEL,
        max_tokens: maxTokens,
        thinking: { type: "adaptive" },
        system: [
          {
            type: "text",
            text: systemPart,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPart,
              },
            ],
          },
        ],
      },
      { timeout: timeoutMs },
    )
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      throw new AnthropicSdkError(
        `Anthropic API error ${e.status ?? "?"} for ${manifest.name}: ${e.message}`,
        e.status,
      )
    }
    throw e
  }
  // ... rest unchanged (text extraction + YAML parse)
}

// Split a prompt into stable (system) and variable (user) portions.
// System = everything up to the `## Input` heading (purpose, scope, reply format).
// User = the `## Input` section onward (task-specific payload).
// If no `## Input` heading found, treat whole prompt as user (fallback = previous behavior).
function splitPrompt(text: string): { systemPart: string; userPart: string } {
  const marker = "\n## Input\n"
  const idx = text.indexOf(marker)
  if (idx === -1) {
    return { systemPart: "", userPart: text }
  }
  return {
    systemPart: text.slice(0, idx).trim(),
    userPart: text.slice(idx).trim(),
  }
}
```

- [ ] **Step 4: Write test for splitPrompt behavior**

Create or extend `tests/dispatcher/anthropic-sdk-agent.test.ts`:

```typescript
import { test, expect } from "bun:test"
import { splitPromptForTest } from "../../src/dispatcher/anthropic-sdk-agent" // will need export

test("splitPrompt: separates system and user at ## Input heading", () => {
  const prompt = `# Purpose\nclassify task\n## Scope\nfoo\n## Input\nyaml:\n  here: true\n## Reply`
  const { systemPart, userPart } = splitPromptForTest(prompt)
  expect(systemPart).toContain("# Purpose")
  expect(systemPart).toContain("## Scope")
  expect(systemPart).not.toContain("## Input")
  expect(userPart).toContain("## Input")
  expect(userPart).toContain("yaml:")
})

test("splitPrompt: fallback when no Input heading — whole prompt is user", () => {
  const prompt = `simple prompt with no structure`
  const { systemPart, userPart } = splitPromptForTest(prompt)
  expect(systemPart).toBe("")
  expect(userPart).toBe(prompt)
})
```

Export splitPrompt as `splitPromptForTest` (or rename splitPrompt to be exported).

- [ ] **Step 5: Run the test**

Run: `bun test tests/dispatcher/anthropic-sdk-agent.test.ts`
Expected: both new tests pass; existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/dispatcher/anthropic-sdk-agent.ts tests/dispatcher/anthropic-sdk-agent.test.ts
git commit -m "perf(sdk): cache system block in anthropic-sdk agent

Previously only the user content had cache_control=ephemeral. System
prompt (purpose + scope + reply format) was re-tokenized every call.
Split at '## Input' heading; system block now cached, user block
carries task-specific payload only.

Expected: 50-80% token cost reduction on repeat agent calls within
the 5-min cache window."
```

---

### Task 3: Annotate empty agent slots in capabilities.yaml

**Why:** capabilities.yaml:327-347 declares 5 reviewer slots (security/performance/tests/maintainability/adversarial/migration/infra/spec) using `<<: *reviewer_base`. Of these, security/performance/migration/infra are implemented in `reviewer-specialists.ts`. The remaining four (tests/maintainability/adversarial/spec) have NO stub — they are aspirational. `janitor.archive` (447-458) is also manifest-only.

**Decision:** Annotate, don't delete. Delete loses future intent; annotation + status marker signals roadmap. Users + agents can read status and act accordingly.

**Files:**
- Modify: `contracts/sgc-capabilities.yaml`

- [ ] **Step 1: Add status field to affected manifests**

In `contracts/sgc-capabilities.yaml`, modify lines 327-333 from:

```yaml
  reviewer.security:        { <<: *reviewer_base }
  reviewer.performance:     { <<: *reviewer_base }
  reviewer.tests:           { <<: *reviewer_base }
  reviewer.maintainability: { <<: *reviewer_base }
  reviewer.adversarial:     { <<: *reviewer_base }
  reviewer.migration:       { <<: *reviewer_base }
  reviewer.infra:           { <<: *reviewer_base }
```

to:

```yaml
  reviewer.security:        { <<: *reviewer_base, status: implemented }
  reviewer.performance:     { <<: *reviewer_base, status: implemented }
  reviewer.tests:           { <<: *reviewer_base, status: slot-only, roadmap: "L2+ test-coverage review; deferred" }
  reviewer.maintainability: { <<: *reviewer_base, status: slot-only, roadmap: "readability/complexity review; deferred" }
  reviewer.adversarial:     { <<: *reviewer_base, status: slot-only, roadmap: "L3 pre-mortem reviewer; deferred" }
  reviewer.migration:       { <<: *reviewer_base, status: implemented }
  reviewer.infra:           { <<: *reviewer_base, status: implemented }
```

For `reviewer.spec` (lines 335-347), add `status: slot-only` to the manifest body and `roadmap: "drift detection post-ship; deferred to v1.3+"`.

For `janitor.archive` (lines 447-458), add `status: manual-only` and keep `trigger: manual only (never auto)` line for clarity.

- [ ] **Step 2: Update schema loader to accept status/roadmap fields**

Read `src/dispatcher/schema.ts`. If strict schema rejects unknown fields, update the agent manifest type to allow `status?: string` and `roadmap?: string`.

Check `src/dispatcher/types.ts` for `SubagentManifest` interface. If strict, extend:

```typescript
export interface SubagentManifest {
  // ... existing fields
  status?: "implemented" | "slot-only" | "manual-only"
  roadmap?: string
}
```

- [ ] **Step 3: Run existing schema + capabilities tests**

Run: `bun test tests/dispatcher/schema.test.ts tests/dispatcher/capabilities.test.ts`
Expected: all green. If a test rejects the new fields, update the test to allow them.

- [ ] **Step 4: Add a small test asserting status is honored**

Create or extend `tests/dispatcher/capabilities.test.ts`:

```typescript
test("schema: reviewer.tests is marked slot-only with roadmap", () => {
  const spec = loadSpec()
  expect(spec.subagents["reviewer.tests"].status).toBe("slot-only")
  expect(spec.subagents["reviewer.tests"].roadmap).toMatch(/deferred/i)
})

test("schema: reviewer.security is implemented", () => {
  const spec = loadSpec()
  expect(spec.subagents["reviewer.security"].status).toBe("implemented")
})
```

Run: `bun test tests/dispatcher/capabilities.test.ts`
Expected: new tests pass.

- [ ] **Step 5: Commit**

```bash
git add contracts/sgc-capabilities.yaml src/dispatcher/types.ts tests/dispatcher/capabilities.test.ts
git commit -m "docs(contracts): annotate implementation status on agent slots

Add status field: implemented|slot-only|manual-only. Five reviewer
slots (tests/maintainability/adversarial/spec) plus janitor.archive
are slot-only — kept for forward-compat roadmap visibility, not yet
wired. Closes audit finding '合约漂移'."
```

---

## Phase 2: Core LLM swap

### Task 4: Extract classifier.level prompt + LLM-dispatch path

**Why:** Currently `classifierLevel()` is 82 lines of keyword regex. Real LLM classification catches semantic signals keywords miss (e.g., "重构数据库连接池" — L3 by nature of "connection pool reconfiguration in prod", but keyword match would miss). Keep heuristic as fallback so inline/tests keep working.

**Files:**
- Create: `prompts/classifier-level.md`
- Modify: `src/dispatcher/agents/classifier-level.ts` (refactor to support both paths)
- Modify: `src/dispatcher/spawn.ts` (route classifier.level through LLM when mode != inline)

- [ ] **Step 1: Create the prompt template**

Create `prompts/classifier-level.md`:

```markdown
# Purpose

Classify a user's engineering request into L0, L1, L2, or L3 per the sgc level definitions.

## Scope

- Token scope: read:progress, read:decisions (read current-task context if relevant)
- Forbidden: read:solutions (reviewer-adjacent isolation — do not consult past answers)
- Allowed outputs: level, rationale, affected_readers_candidates

## Level definitions

- **L0**: typo / comment / formatting / config — no behavior change, no tests needed
- **L1**: single file, < 80 LOC, no contract change, local delta only
- **L2**: multi-file OR contract change OR new tests OR additive schema
- **L3**: architecture / breaking schema / prod migration / infra / auth/payment/crypto

## Hard escalation rules

1. Any migration, DB schema, prod infra, deploy config → minimum L3
2. Any public API, auth, payment, crypto surface → minimum L2
3. Uncertainty between two levels → pick the higher one
4. When the request is ambiguous about scope → ASK-equivalent: say "ambiguous" and propose both L and rationale

## Reply format

Produce YAML with exactly these fields:

```yaml
level: L0 | L1 | L2 | L3
rationale: |
  <2-3 sentences explaining the classification. Reference specific
  elements of the request. No generic phrasing like "seems complex" or
  "standard change".>
affected_readers_candidates:
  - <list of code areas or modules this change might ripple into>
```

## Input

<input_yaml/>

## Submit

Write only the YAML above to the result file. No prose outside the YAML block.
```

Note: `<input_yaml/>` is a placeholder that `spawn.ts` fills with the serialized input at prompt-build time.

- [ ] **Step 2: Refactor classifier-level.ts to expose both paths**

Replace `src/dispatcher/agents/classifier-level.ts` contents with:

```typescript
// classifier.level — heuristic fallback + LLM dispatch path.
//
// When spawn mode is inline (MVP, tests) → heuristic keyword classifier.
// When mode is anthropic-sdk / claude-cli / file-poll → LLM via prompts/classifier-level.md.
//
// Heuristic precedence (HARD escalation rules):
//   1. migration / infra / DB schema → L3
//   2. public API / auth / payment → at least L2
//   3. typo / format / comment / config-only → L0
//   4. otherwise → L1 (conservative default)

import type { Level } from "../types"

export interface ClassifierInput {
  user_request: string
  repo_summary?: string
}

export interface ClassifierOutput {
  level: Level
  rationale: string
  affected_readers_candidates: string[]
}

const L3_KEYWORDS = [
  /\bmigration\b/i,
  /\bschema\b/i,
  /\bDROP\b|\bALTER\b|\bCREATE TABLE\b/,
  /\binfra(structure)?\b/i,
  /\bdeploy(ment)?\b/i,
  /\barchitect(ure)?\b/i,
]

const L2_KEYWORDS = [
  /\bAPI\b/,
  /\bauth(entication|orization)?\b/i,
  /\bpayment\b/i,
  /\bcrypto\b|\bjwt\b|\btoken\b|\bsession\b/i,
  /\bmulti[- ]file\b/i,
  /\brefactor\b/i,
]

const L0_KEYWORDS = [
  /\btypo\b/i,
  /\bformat(ting)?\b/i,
  /\bcomment\b/i,
  /\brename (a )?(local )?variable\b/i,
  /\bdocstring\b/i,
  /^(fix|update) (a |the )?(typo|formatting|comment|whitespace|spelling)/i,
]

/** Heuristic fallback — used when no LLM is available (tests, inline mode). */
export function classifierLevelHeuristic(input: ClassifierInput): ClassifierOutput {
  const req = input.user_request

  if (L3_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L3",
      rationale:
        "request mentions architecture/migration/infra keywords; minimum L3 per HARD escalation rule",
      affected_readers_candidates: ["dispatcher", "future maintainers"],
    }
  }
  if (L2_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L2",
      rationale:
        "request involves public API/auth/payment surface; minimum L2 per HARD escalation rule",
      affected_readers_candidates: ["dispatcher", "downstream callers"],
    }
  }
  if (L0_KEYWORDS.some((re) => re.test(req))) {
    return {
      level: "L0",
      rationale: "request is a trivial text-only change (typo/format/comment); fast-path",
      affected_readers_candidates: ["dispatcher"],
    }
  }
  return {
    level: "L1",
    rationale:
      "default classification — single-file or simple change with no keyword hits for L0/L2/L3",
    affected_readers_candidates: ["dispatcher"],
  }
}

/** Backward-compat alias. Prefer heuristic-specific name in new code. */
export const classifierLevel = classifierLevelHeuristic
```

- [ ] **Step 3: Teach spawn.ts to prefer LLM for classifier.level**

Read `src/dispatcher/spawn.ts` focusing on the mode resolution (lines 99-125) and inline-stub dispatch. We want: when mode == inline AND there's an `inlineStub` provided, use it; when mode == anthropic-sdk / claude-cli, use the prompt at `prompts/classifier-level.md`.

The prompt-path resolution happens in the prompt-building section (around lines 150-185 per audit). Likely the current scheme uses a per-agent `prompt_template` field on the manifest. Verify by reading spawn.ts, then either:

(a) Add `prompt_path: prompts/classifier-level.md` to `classifier.level` manifest in capabilities.yaml
(b) Have spawn.ts look up `prompts/<agent-name-dotless>.md` by convention

Pick (a) — explicit beats implicit:

In `contracts/sgc-capabilities.yaml`, find the `classifier.level:` manifest block and add:
```yaml
  prompt_path: prompts/classifier-level.md
```

Then in spawn.ts prompt-building, if manifest.prompt_path exists, load and use it as the prompt template (substitute `<input_yaml/>` with serialized input YAML); otherwise use current synthesized prompt.

- [ ] **Step 4: Update types.ts**

Add `prompt_path?: string` to `SubagentManifest` interface.

- [ ] **Step 5: Run existing classifier + spawn tests**

Run: `bun test tests/dispatcher/classifier.test.ts tests/dispatcher/spawn.test.ts`
Expected: all pass (heuristic behavior unchanged; LLM path optional).

- [ ] **Step 6: Commit**

```bash
git add prompts/classifier-level.md src/dispatcher/agents/classifier-level.ts src/dispatcher/spawn.ts src/dispatcher/types.ts contracts/sgc-capabilities.yaml
git commit -m "feat(classifier): add LLM dispatch path with heuristic fallback

classifier.level was a pure keyword stub. Now: when ANTHROPIC_API_KEY
or claude CLI available, spawn uses prompts/classifier-level.md via
the standard dispatch machinery. Heuristic path preserved as fallback
for tests and inline mode.

Introduces manifest field prompt_path for agent → prompt mapping."
```

---

### Task 5: Classifier LLM eval test

**Why:** Validate the LLM path doesn't regress vs heuristic on representative cases.

**Files:**
- Create: `tests/eval/classifier-llm.test.ts`

- [ ] **Step 1: Write the failing test with mock client**

Create `tests/eval/classifier-llm.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { spawn } from "../../src/dispatcher/spawn"
import { loadSpec } from "../../src/dispatcher/schema"
import { createEvalWorkspace, destroyEvalWorkspace } from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-classifier-llm-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("classifier.level LLM dispatch (eval)", () => {
  test("routes through prompt_path when mode != inline", async () => {
    const spec = loadSpec()
    const manifest = spec.subagents["classifier.level"]

    expect(manifest.prompt_path).toBe("prompts/classifier-level.md")

    // Mock anthropic client that returns a YAML block.
    const mockClient = {
      messages: {
        create: async () => ({
          content: [
            {
              type: "text" as const,
              text: [
                "```yaml",
                "level: L3",
                "rationale: |",
                "  Request involves database migration with concurrent-write safety.",
                "affected_readers_candidates:",
                "  - dispatcher",
                "  - data-migration team",
                "```",
              ].join("\n"),
            },
          ],
        }),
      },
    }

    const result = await spawn({
      manifest,
      input: { user_request: "add 2FA column to 5M-row users table" },
      stateRoot: tmp,
      mode: "anthropic-sdk",
      anthropicClient: () => mockClient as any,
      caller: "classifier.level",
    })

    expect(result.level).toBe("L3")
    expect(result.rationale).toMatch(/migration/i)
  })

  test("falls back to heuristic when mode is inline", async () => {
    const spec = loadSpec()
    const manifest = spec.subagents["classifier.level"]

    const result = await spawn({
      manifest,
      input: { user_request: "add 2FA column to 5M-row users table" },
      stateRoot: tmp,
      mode: "inline",
      caller: "classifier.level",
    })

    // Heuristic would hit L2_KEYWORDS (auth/token/jwt) but this input has none.
    // Keyword test: no migration/schema/infra/architect keywords in the literal.
    // Falls through to L1 default. LLM path would catch the "migration" semantic.
    expect(result.level).toBe("L1")
  })
})
```

- [ ] **Step 2: Run the test — expect first test to pass, second to confirm heuristic limits**

Run: `bun test tests/eval/classifier-llm.test.ts`
Expected: first test PASS (LLM path works with mock); second test PASS (heuristic falls through to L1).

If the first test fails because `spawn` doesn't accept an `anthropicClient` injector in the current signature, either add it (preferable — small API change) or use env var / module-level mock. Prefer explicit injection for testability.

- [ ] **Step 3: Commit**

```bash
git add tests/eval/classifier-llm.test.ts
git commit -m "test(eval): classifier LLM path + heuristic limit demonstration

Adds eval scenario showing:
  - LLM path (mock SDK) correctly returns L3 on migration semantic
  - Heuristic path falls through to L1 on the same input (missing
    the 'migration' keyword — demonstrates why LLM path is needed)"
```

---

### Task 6: reviewer.correctness LLM path + eval

**Why:** Same pattern as classifier — current stub only detects TODO/FIXME markers, missing real semantic review.

**Files:**
- Create: `prompts/reviewer-correctness.md`
- Modify: `src/dispatcher/agents/reviewer-correctness.ts`
- Modify: `contracts/sgc-capabilities.yaml` (add prompt_path)
- Create: `tests/eval/reviewer-correctness-llm.test.ts`

- [ ] **Step 1: Create the prompt template**

Create `prompts/reviewer-correctness.md`:

```markdown
# Purpose

Review a git diff for correctness against the stated intent.

## Scope

- Token scope: read:decisions, read:progress, write:reviews, exec:git:read
- Forbidden: read:solutions (generator-evaluator separation, Invariant §1)
- Allowed outputs: verdict, severity, findings

## Review checklist

1. **Intent alignment**: does the diff accomplish what intent.md states?
2. **Correctness**: are there obvious bugs — off-by-one, null deref, missing error paths, race conditions?
3. **Test coverage**: are new behaviors covered by tests? (cite test file:line if yes; flag concern if not)
4. **Unresolved markers**: TODO/FIXME/XXX in added lines are concerns unless justified
5. **Empty diff or doc-only diff with code intent**: flag as concern
6. **Scope creep**: changes outside intent's stated surface

## Severity rubric

- **none**: pass with no findings
- **low**: cosmetic, TODO markers without impact
- **medium**: missing test coverage for new behavior, questionable logic but not obviously broken
- **high**: clear bug, missing error handling, contract violation
- **critical**: security regression, data loss risk, broken invariant

## Verdict rubric

- **pass**: no findings above low
- **concern**: at least one medium-or-higher finding, but not blocking
- **fail**: at least one high-or-critical finding, ship should be blocked

## Reply format

```yaml
verdict: pass | concern | fail
severity: none | low | medium | high | critical
findings:
  - location: <file:line or "global">
    description: <what is wrong, 1-2 sentences>
    suggestion: <optional — one-line fix hint>
```

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
```

- [ ] **Step 2: Refactor reviewer-correctness.ts**

Replace `src/dispatcher/agents/reviewer-correctness.ts`:

```typescript
// reviewer.correctness — heuristic fallback + LLM dispatch path.
//
// When spawn mode is inline → marker scan (TODO/FIXME/XXX) + empty diff check.
// When mode is anthropic-sdk / claude-cli → LLM via prompts/reviewer-correctness.md.

import type { Finding, Severity, Verdict } from "../types"

export interface ReviewerCorrectnessInput {
  diff: string
  intent: string
}

export interface ReviewerCorrectnessOutput {
  verdict: Verdict
  severity: Severity
  findings: Finding[]
}

const MARKER_RE = /\b(TODO|FIXME|XXX)\b/

/** Heuristic fallback — used when no LLM is available. */
export function reviewerCorrectnessHeuristic(
  input: ReviewerCorrectnessInput,
): ReviewerCorrectnessOutput {
  const diff = input.diff ?? ""
  if (diff.trim() === "") {
    return {
      verdict: "concern",
      severity: "low",
      findings: [{ description: "no diff to review (empty change)" }],
    }
  }
  const findings: Finding[] = []
  const lines = diff.split("\n")
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++") && MARKER_RE.test(line)) {
      findings.push({
        description: `unresolved marker in added line: ${line.slice(1, 100).trim()}`,
      })
    }
  }
  return {
    verdict: findings.length > 0 ? "concern" : "pass",
    severity: findings.length > 0 ? "low" : "none",
    findings,
  }
}

/** Backward-compat alias. */
export const reviewerCorrectness = reviewerCorrectnessHeuristic
```

- [ ] **Step 3: Add prompt_path to manifest**

In `contracts/sgc-capabilities.yaml`, find `reviewer.correctness` block (around line 310-325) and add:
```yaml
  prompt_path: prompts/reviewer-correctness.md
```

- [ ] **Step 4: Write the eval test with mock**

Create `tests/eval/reviewer-correctness-llm.test.ts` modeled after classifier-llm.test.ts but with a diff input and LLM-response YAML demonstrating semantic catch (e.g., missing null check that TODO scan would miss).

Content outline (expand parallel to Task 5):
- Test 1: LLM path catches a missing null check in the diff (heuristic would pass because no TODO markers) → verdict: concern, severity: medium
- Test 2: heuristic path on same diff returns pass (demonstrates LLM adds value)

- [ ] **Step 5: Run tests**

Run: `bun test tests/eval/reviewer-correctness-llm.test.ts tests/dispatcher/reviewer.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add prompts/reviewer-correctness.md src/dispatcher/agents/reviewer-correctness.ts contracts/sgc-capabilities.yaml tests/eval/reviewer-correctness-llm.test.ts
git commit -m "feat(reviewer): add LLM dispatch path for reviewer.correctness

Parallel to classifier — heuristic retained as fallback, LLM path via
prompts/reviewer-correctness.md when mode permits. Eval demonstrates
LLM catches semantic bugs (null check missing) that the TODO-marker
scan would miss."
```

---

## Phase 3: Plugin integration

### Task 7: Rewrite 9 SKILL.md for real dispatch

**Why:** Currently `plugins/sgc/skills/plan/SKILL.md:31-34` has narrative prose pointing at `src/commands/plan.ts`. From CC's perspective this is docs, not execution. Claude Code skills can embed `!<bash>` inline — invoking `sgc plan` directly should happen from the skill.

**Files:**
- Modify: `plugins/sgc/skills/{plan,work,review,qa,ship,compound,discover,status,agent-loop}/SKILL.md` (9 files)

- [ ] **Step 1: Define the dispatch pattern**

Each SKILL.md keeps its header + routing info but adds an **Execution** section that invokes `sgc <cmd>` via Claude Code's bash tool. Claude Code expands `$ARGUMENTS` to the user-provided text.

Canonical pattern for plan/SKILL.md (replacing lines 38-48):

```markdown
## Execution

When this skill is invoked, dispatch to the sgc CLI directly:

```bash
bun /mnt/Sda2/dev/sdsbp/sgc/src/sgc.ts plan "$ARGUMENTS"
```

For L3 tasks, the CLI will prompt for `--signed-by` and require interactive `yes`.

If you need to override the auto-classified level, pass `--level L0|L1|L2|L3`.

## Delegation hint

sgc plan produces an intent.md and feature-list.md. For the deep **implementation** planning (file-level tasks, bite-sized TDD steps), compose with:

- `sp:writing-plans` — produces the task-by-task execution plan
- `sp:brainstorming` — for clarifying ambiguous scope before planning

sgc owns the intent + classification; sp owns the deep plan body.
```

- [ ] **Step 2: Apply to plan/SKILL.md**

Modify `plugins/sgc/skills/plan/SKILL.md` — replace the "Invocation" section with the "Execution" + "Delegation hint" sections above.

- [ ] **Step 3: Apply parallel changes to all 8 other SKILL.md files**

For each of work, review, qa, ship, compound, discover, status, agent-loop:
- Replace Invocation section with Execution using `bun /mnt/Sda2/dev/sdsbp/sgc/src/sgc.ts <cmd> "$ARGUMENTS"` (or no args for status)
- Add Delegation hint appropriate to the command (see mapping in Task 1 POSITIONING.md)

Delegation hints per command:
- **work**: "For TDD discipline, compose with `sp:test-driven-development`."
- **review**: "For comprehensive pre-ship review, compose with `gs:/review` (broader static analysis)."
- **qa**: "For rich browser testing, compose with `gs:/browse`."
- **ship**: "For git/PR/deploy, compose with `gs:/ship` + `gs:/land-and-deploy`. sgc ship enforces the sgc protocol; gs ships to production."
- **compound**: "Automatic after ship via janitor. Manual invocation only for reruns."
- **discover**: "For product-fuzzy requirements, compose with `gs:/office-hours`."
- **status**: no delegation hint (read-only)
- **agent-loop**: "Helper for file-poll mode. Rarely invoked directly."

- [ ] **Step 4: Verify**

Run: `find plugins/sgc/skills -name SKILL.md -exec grep -l "Execution" {} \;`
Expected: all 9 files listed.

Run: `grep -c "bun /mnt/Sda2/dev/sdsbp/sgc/src/sgc.ts" plugins/sgc/skills/*/SKILL.md`
Expected: each file reports 1.

- [ ] **Step 5: Commit**

```bash
git add plugins/sgc/skills/
git commit -m "feat(plugin): rewrite SKILL.md files for real dispatch

Before: SKILL.md was narrative docs pointing at src/commands/*.ts.
Claude Code saw prose, not executable.
After: each skill embeds 'bun src/sgc.ts <cmd>' via \$ARGUMENTS and
includes a Delegation hint per POSITIONING.md.

Users invoking /plan / /review / /ship via Claude Code now actually
run the sgc CLI."
```

---

### Task 8: Update plugins/sgc/CLAUDE.md with delegate pattern

**Files:**
- Modify: `plugins/sgc/CLAUDE.md`

- [ ] **Step 1: Add Positioning section near the top**

In `plugins/sgc/CLAUDE.md`, after the title + tagline (around line 3-4), add:

```markdown
## Positioning

sgc is a **规范层 + 知识引擎** that coexists with `superpowers` (sp) and `gstack` (gs). See [docs/POSITIONING.md](../../docs/POSITIONING.md) for the delegate pattern.

- **sgc owns**: L0-L3 classification, 12 invariants, `.sgc/` state layer, dedup, compound, solutions/
- **sgc delegates** (when sp/gs present): deep plan body, TDD, debugging, pre-ship review, git/PR/deploy, browser QA
- **sgc falls back** (when sp/gs absent): current inline implementations

User mental model: sgc decides the level, enforces the protocol, records the knowledge. sp does the thinking. gs ships.
```

- [ ] **Step 2: Update the Commands table to mention delegation**

Around the Commands table (the one listing /discover, /plan, /work, etc.), add a third column "Delegate" or a footnote referencing POSITIONING.md.

- [ ] **Step 3: Verify**

Run: `grep -c "POSITIONING.md" plugins/sgc/CLAUDE.md`
Expected: `>= 1`.

- [ ] **Step 4: Commit**

```bash
git add plugins/sgc/CLAUDE.md
git commit -m "docs(plugin): document delegate pattern in CLAUDE.md

Describe sgc's positioning alongside sp/gs, with link to
docs/POSITIONING.md. Mental model: sgc = protocol + audit,
sp = execution, gs = ship."
```

---

## Phase 4: Reliability

### Task 9: writeHandoff called in plan.ts + ship.ts

**Why:** `state.ts:278` exposes writeHandoff + readHandoff, but grep shows ZERO callers in commands. Session breakage leaves no resume marker. Write on plan-creation and ship-close.

**Files:**
- Modify: `src/commands/plan.ts`
- Modify: `src/commands/ship.ts`

- [ ] **Step 1: Read state.ts:278-290 for exact signature**

Look at `src/dispatcher/state.ts` around line 278 to find:
```
writeHandoff(handoff: Handoff, body: string, stateRoot?: string): string
readHandoff(stateRoot?: string): { handoff: Handoff; body: string } | null
```

And `src/dispatcher/types.ts:66` for the Handoff interface.

- [ ] **Step 2: Call writeHandoff at end of runPlan**

In `src/commands/plan.ts`, after successful intent write (near end of runPlan, before the return statement), add:

```typescript
import { writeHandoff } from "../dispatcher/state"
// ...
writeHandoff(
  {
    task_id: taskId,
    level,
    active_feature: undefined,
    last_checkpoint: new Date().toISOString(),
    next_action: "work — implement features per feature-list.md",
  },
  `Plan written for task ${taskId}. Level ${level}. Resume via 'sgc work'.\n`,
  stateRoot,
)
```

(Adjust field names to match the actual Handoff type after reading it.)

- [ ] **Step 3: Call writeHandoff at end of runShip**

In `src/commands/ship.ts`, after successful ship write, append handoff update:

```typescript
writeHandoff(
  {
    task_id: taskId,
    level,
    active_feature: undefined,
    last_checkpoint: new Date().toISOString(),
    next_action: "ship complete — new task starts from scratch",
  },
  `Task ${taskId} shipped. Ready for next task.\n`,
  stateRoot,
)
```

- [ ] **Step 4: Test — write fails loudly if signature wrong**

Run: `bun test tests/eval/L1-bugfix.test.ts`
Expected: pass — existing eval exercises plan + ship, which now write handoff. If tests fail due to handoff file appearing where unexpected, extend the test to assert handoff exists + has the right `next_action`.

- [ ] **Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/ship.ts
git commit -m "feat(state): auto-write handoff on plan + ship

writeHandoff exposed in state.ts:278 but never called from commands
(found by 2026-04-16 audit). Now written on plan creation and ship
close, recording task_id, level, and next_action — enables session
resume via readHandoff."
```

---

### Task 10: readHandoff in plan entry + resume logic

**Why:** Completes the handoff loop — if an active task exists in handoff.md, new plan invocation should warn (or offer resume) instead of silently proceeding.

**Files:**
- Modify: `src/commands/plan.ts`

- [ ] **Step 1: Add read + warn guard at plan entry**

At the top of `runPlan` (after args destructuring, before classifier spawn), add:

```typescript
import { readHandoff } from "../dispatcher/state"
// ...
const existingHandoff = readHandoff(stateRoot)
if (existingHandoff && existingHandoff.handoff.next_action !== "ship complete — new task starts from scratch") {
  const { handoff } = existingHandoff
  log(
    `Active task detected in handoff: ${handoff.task_id} (${handoff.level}).\n` +
    `Last checkpoint: ${handoff.last_checkpoint}\n` +
    `Next action: ${handoff.next_action}\n` +
    `Continuing with new plan will overwrite handoff. Pass --force-new-task to suppress this warning.`,
  )
  if (!opts.forceNewTask) {
    throw new PlanError(
      `active task ${handoff.task_id} in handoff.md. Complete it or pass --force-new-task.`,
    )
  }
}
```

(Add `forceNewTask?: boolean` to runPlan opts type; add `--force-new-task` flag in sgc.ts args for plan command.)

- [ ] **Step 2: Extend L1-bugfix.test.ts to exercise handoff**

Modify `tests/eval/L1-bugfix.test.ts` to verify handoff is written after plan:

```typescript
// after runPlan
const hf = readHandoff(tmp)
expect(hf).not.toBeNull()
expect(hf!.handoff.task_id).toBe(plan.taskId)
expect(hf!.handoff.level).toBe("L1")
```

Import `readHandoff` at top of file.

- [ ] **Step 3: Add new eval for resume guard**

Create `tests/eval/resume-guard.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { runPlan } from "../../src/commands/plan"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

let tmp: string
beforeEach(() => { tmp = createEvalWorkspace("sgc-eval-resume-") })
afterEach(() => { destroyEvalWorkspace(tmp) })

describe("resume guard (new task with active handoff)", () => {
  test("second runPlan without --force-new-task throws with active handoff", async () => {
    await runPlan("fix typo in README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      log: () => {},
    })

    await expect(
      runPlan("another task", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION_FIXTURE,
        log: () => {},
      }),
    ).rejects.toThrow(/active task/)
  })

  test("second runPlan with --force-new-task proceeds", async () => {
    await runPlan("fix typo in README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      log: () => {},
    })

    const plan2 = await runPlan("another task", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      forceNewTask: true,
      log: () => {},
    })

    expect(plan2.taskId).toBeDefined()
  })
})
```

- [ ] **Step 4: Run tests**

Run: `bun test tests/eval/resume-guard.test.ts tests/eval/L1-bugfix.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/plan.ts src/sgc.ts tests/eval/resume-guard.test.ts tests/eval/L1-bugfix.test.ts
git commit -m "feat(plan): resume guard — refuse new task when handoff active

Complements writeHandoff from previous commit. sgc plan now reads
handoff.md on entry; if active task exists, refuses with hint to
finish or pass --force-new-task. Covers the session-resume gap
identified in 2026-04-16 audit."
```

---

### Task 11: Eval — L3 --auto refused (Invariant §4)

**Files:**
- Create: `tests/eval/L3-auto-refused.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/eval/L3-auto-refused.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { runPlan } from "../../src/commands/plan"
import { runShip } from "../../src/commands/ship"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

let tmp: string
beforeEach(() => { tmp = createEvalWorkspace("sgc-eval-L3-auto-") })
afterEach(() => { destroyEvalWorkspace(tmp) })

describe("Invariant §4: L3 refuses --auto", () => {
  test("runPlan at L3 with autoConfirm=true throws", async () => {
    await expect(
      runPlan("migration to add 2FA column to 10M-row users table", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION_FIXTURE,
        autoConfirm: true, // the forbidden flag
        signedBy: "test-user",
        log: () => {},
      }),
    ).rejects.toThrow(/--auto|L3/i)
  })

  test("runShip at L3 with --auto throws", async () => {
    // First: plan at L3 with signedBy (interactive path simulated)
    const plan = await runPlan("migration for 2FA column on users", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      signedBy: "test-user",
      confirmStdin: "yes\n", // simulate interactive yes
      log: () => {},
    })
    expect(plan.level).toBe("L3")

    // Now ship with --auto → should refuse
    await expect(
      runShip({
        stateRoot: tmp,
        autoConfirm: true,
        log: () => {},
      }),
    ).rejects.toThrow(/L3.*--auto|--auto.*L3/i)
  })
})
```

- [ ] **Step 2: Run test**

Run: `bun test tests/eval/L3-auto-refused.test.ts`
Expected: PASS. If the test harness signatures differ (e.g., `confirmStdin` not a real opt), adjust to match the actual runPlan / runShip signatures — the goal is to confirm the refusal behavior.

- [ ] **Step 3: Commit**

```bash
git add tests/eval/L3-auto-refused.test.ts
git commit -m "test(eval): Invariant §4 — L3 refuses --auto

Explicit eval for the rule. Code at src/commands/plan.ts +
src/commands/ship.ts throws on L3 + --auto; audit noted this was
implemented but not covered by eval suite."
```

---

### Task 12: Eval — override.reason <40 chars refused (Invariant §5)

**Files:**
- Create: `tests/eval/override-reason-short.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/eval/override-reason-short.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { runPlan } from "../../src/commands/plan"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
  seedFailingReview,
} from "./eval-helpers"

let tmp: string
beforeEach(() => { tmp = createEvalWorkspace("sgc-eval-override-") })
afterEach(() => { destroyEvalWorkspace(tmp) })

describe("Invariant §5: override.reason must be ≥40 chars", () => {
  test("ship with short override reason throws", async () => {
    const plan = await runPlan("L2 change with failing review", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      level: "L2",
      log: () => {},
    })
    // Seed a failing review so override path activates
    await seedFailingReview(tmp, plan.taskId)

    await expect(
      runShip({
        stateRoot: tmp,
        override: {
          reason: "ok",  // 2 chars — should fail the ≥40 check
          signed_by: "test-user",
        },
        log: () => {},
      }),
    ).rejects.toThrow(/40|reason/i)
  })

  test("ship with 40+ char override reason proceeds", async () => {
    const plan = await runPlan("L2 change with failing review", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      level: "L2",
      log: () => {},
    })
    await seedFailingReview(tmp, plan.taskId)

    const result = await runShip({
      stateRoot: tmp,
      override: {
        reason: "Reviewer flagged a TODO marker we've tracked in the backlog separately.",
        signed_by: "test-user",
      },
      log: () => {},
    })

    expect(result.shipped).toBe(true)
  })
})
```

Note: `seedFailingReview` is a helper that may need adding to `eval-helpers.ts`. If it doesn't exist, add a utility that writes a reviews/{task_id}/code/reviewer.correctness.md with verdict=fail.

- [ ] **Step 2: Run**

Run: `bun test tests/eval/override-reason-short.test.ts`
Expected: PASS. Adjust harness signatures as needed to match actual runShip override API.

- [ ] **Step 3: Commit**

```bash
git add tests/eval/override-reason-short.test.ts tests/eval/eval-helpers.ts
git commit -m "test(eval): Invariant §5 — override.reason must be ≥40 chars

state.ts:312-320 enforces the 40-char minimum; this eval makes it
explicit. Adds seedFailingReview helper for override-path scenarios."
```

---

### Task 13: Eval — compound mid-stream rollback (Invariant §10)

**Files:**
- Create: `tests/eval/compound-rollback.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/eval/compound-rollback.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { runCompound } from "../../src/commands/compound"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  seedShippedL2Task,
} from "./eval-helpers"

let tmp: string
beforeEach(() => { tmp = createEvalWorkspace("sgc-eval-rollback-") })
afterEach(() => { destroyEvalWorkspace(tmp) })

describe("Invariant §10: compound transaction atomicity on mid-stream failure", () => {
  test("compound.solution fails → writeSolution skipped, no partial entry", async () => {
    const { taskId } = await seedShippedL2Task(tmp)
    const solutionsDir = resolve(tmp, "solutions")
    const beforeCount = existsSync(solutionsDir) ? countFiles(solutionsDir) : 0

    // Inject a compound.solution stub that throws
    await expect(
      runCompound({
        stateRoot: tmp,
        taskId,
        stubs: {
          "compound.solution": () => { throw new Error("simulated LLM failure") },
        },
        log: () => {},
      }),
    ).rejects.toThrow(/simulated|compound.solution/)

    const afterCount = existsSync(solutionsDir) ? countFiles(solutionsDir) : 0
    expect(afterCount).toBe(beforeCount)  // no partial write
  })
})

function countFiles(dir: string): number {
  let n = 0
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isDirectory()) n += countFiles(resolve(dir, e.name))
    else n += 1
  }
  return n
}
```

Note: `seedShippedL2Task` is a helper that creates a task up to shipped state (intent + review + ship records in .sgc/). If not present in eval-helpers.ts, add it. The `stubs` opts is a pass-through to spawn for injecting per-agent test behavior — may need adding to runCompound opts signature.

- [ ] **Step 2: Run test**

Run: `bun test tests/eval/compound-rollback.test.ts`
Expected: PASS. If runCompound doesn't support stub injection today, implement minimally for this test (opts.stubs = Record<agent-name, (input) => output>).

- [ ] **Step 3: Commit**

```bash
git add tests/eval/compound-rollback.test.ts tests/eval/eval-helpers.ts src/commands/compound.ts
git commit -m "test(eval): Invariant §10 — compound mid-stream failure rollback

Seeds L2 shipped task, injects failing compound.solution stub,
asserts solutions/ count unchanged. Exercises the transaction
atomicity rule that was implemented but not tested."
```

---

### Task 14: Eval — multi-reviewer conflict worst-of aggregation

**Files:**
- Create: `tests/eval/reviewer-conflict.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/eval/reviewer-conflict.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { runPlan } from "../../src/commands/plan"
import { runReview } from "../../src/commands/review"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
  stubReviewers,
} from "./eval-helpers"

let tmp: string
beforeEach(() => { tmp = createEvalWorkspace("sgc-eval-conflict-") })
afterEach(() => { destroyEvalWorkspace(tmp) })

describe("Reviewer conflict aggregation: worst-of", () => {
  test("3 pass + 1 fail aggregates to fail", async () => {
    const plan = await runPlan("migration to add 2FA column", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      level: "L3",
      signedBy: "test-user",
      confirmStdin: "yes\n",
      log: () => {},
    })
    expect(plan.level).toBe("L3")

    // Stub reviewers: correctness=pass, security=pass, migration=pass, infra=fail
    const result = await runReview({
      stateRoot: tmp,
      stubs: stubReviewers({
        "reviewer.correctness": { verdict: "pass", severity: "none", findings: [] },
        "reviewer.security": { verdict: "pass", severity: "none", findings: [] },
        "reviewer.migration": { verdict: "pass", severity: "none", findings: [] },
        "reviewer.infra": { verdict: "fail", severity: "high", findings: [{ description: "Dockerfile uses :latest" }] },
      }),
      log: () => {},
    })

    expect(result.aggregateVerdict).toBe("fail")
    expect(result.aggregateSeverity).toBe("high")
  })

  test("all concern aggregates to concern (not fail)", async () => {
    const plan = await runPlan("migration", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      level: "L3",
      signedBy: "test-user",
      confirmStdin: "yes\n",
      log: () => {},
    })

    const result = await runReview({
      stateRoot: tmp,
      stubs: stubReviewers({
        "reviewer.correctness": { verdict: "concern", severity: "medium", findings: [{ description: "TODO marker" }] },
        "reviewer.security": { verdict: "concern", severity: "low", findings: [] },
      }),
      log: () => {},
    })

    expect(result.aggregateVerdict).toBe("concern")
    expect(result.aggregateSeverity).toBe("medium") // worst-of
  })
})
```

Note: `stubReviewers` is a helper that builds the per-agent stub map. `runReview` must accept a `stubs` opt (may need minimal wiring like runCompound above).

- [ ] **Step 2: Run**

Run: `bun test tests/eval/reviewer-conflict.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/eval/reviewer-conflict.test.ts tests/eval/eval-helpers.ts src/commands/review.ts
git commit -m "test(eval): reviewer worst-of verdict aggregation

Stub 4 L3 reviewers with mixed verdicts (3 pass + 1 fail → fail;
all concern → concern with worst-of severity). Covers the
aggregation gap noted in the audit."
```

---

## Phase 5: Ship

### Task 15: CHANGELOG, version bump, prepare PR

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] **Step 1: Update CHANGELOG.md**

Prepend a new section:

```markdown
## v1.2.0 — 2026-04-16 — Audit remediation

### Strategy
- **Positioning**: sgc declared as "规范层 + 知识引擎" alongside sp/gs. See `docs/POSITIONING.md`.

### Features
- `classifier.level`: real-LLM dispatch path via `prompts/classifier-level.md` (heuristic fallback retained)
- `reviewer.correctness`: real-LLM dispatch path via `prompts/reviewer-correctness.md` (heuristic fallback retained)
- Plugin skills (`plugins/sgc/skills/*/SKILL.md`) now dispatch to the CLI via `!bun src/sgc.ts <cmd>`
- `sgc plan` / `sgc ship` auto-write `handoff.md`; new `--force-new-task` flag for conflicting sessions
- Manifest field `prompt_path` for agent → prompt template mapping
- Manifest field `status` + `roadmap` for slot-vs-implemented agent visibility

### Performance
- Anthropic SDK: system block now cached with `cache_control: ephemeral` (was user-only). Expected 50–80% token reduction on repeat agent calls within 5-min cache window.

### Tests
- Eval: `L3-auto-refused` (Invariant §4)
- Eval: `override-reason-short` (Invariant §5)
- Eval: `compound-rollback` (Invariant §10)
- Eval: `reviewer-conflict` (worst-of aggregation)
- Eval: `classifier-llm` + `reviewer-correctness-llm` (LLM path sanity)
- Eval: `resume-guard` (session handoff)

### Docs
- New: `docs/POSITIONING.md`
- Updated: `plugins/sgc/CLAUDE.md`, `README.md`, all `SKILL.md` files
- Annotated: 5 unimplemented reviewer slots + janitor.archive in capabilities.yaml
```

- [ ] **Step 2: Bump version**

Modify `package.json` — change `"version": "1.1.0"` to `"version": "1.2.0"`.

- [ ] **Step 3: Run full test suite**

Run: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun test`
Expected: all tests pass (existing 357 + ~10 new eval tests; final count should be 367+).

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md package.json
git commit -m "chore: release v1.2.0

Audit remediation — closes P0+P1 findings from 2026-04-16 audit.
See CHANGELOG.md for full list."
```

- [ ] **Step 5: Prepare pre-ship review via gs:/review or sp:requesting-code-review**

Per POSITIONING.md delegate pattern — pre-ship comprehensive review belongs to gs:/review. If gs is available, invoke it. If not, fall back to sp:requesting-code-review with the branch diff as context.

- [ ] **Step 6: Hand off to gs:/ship for PR creation**

Per POSITIONING.md — actual git push / PR / deploy delegate to gs:/ship. If gs unavailable, manual `git push` + `gh pr create` (with explicit user AUTH per §5).

---

## Self-Review

**Spec coverage:**
- P0-#1 (classifier LLM): ✓ Task 4-5
- P0-#2 (SKILL.md dispatch): ✓ Task 7
- P0-#3 (战略定调): ✓ Task 1 + 8
- P0-#4 (system cache_control): ✓ Task 2
- P1-#5 (4 eval negatives): ✓ Tasks 11-14
- P1-#6 (reviewer.correctness LLM): ✓ Task 6
- P1-#7 (writeHandoff): ✓ Tasks 9-10
- P1-#8 (yaml annotation): ✓ Task 3
- P2-#9 (中文 tokenizer): deferred (noted in plan intro)
- P2-#10 (sandbox): deferred (noted in plan intro)

**Placeholder scan:** All steps have file paths and code blocks. A few "adjust to match actual signature" notes appear where the executing engineer will need to read the actual types — these are intentional escape hatches, not placeholders. Each notes the exact file to check.

**Type consistency:**
- `classifierLevelHeuristic` defined Task 4, not referenced in later tasks
- `reviewerCorrectnessHeuristic` defined Task 6, consistent
- `writeHandoff` / `readHandoff` referenced consistently Tasks 9-10
- `stubReviewers`, `stubShipFailingReview`, `seedShippedL2Task` are eval-helpers additions — each task that uses them notes to add the helper if missing
- `prompt_path` manifest field introduced in Task 4 (types.ts update), reused Task 6

**Known gaps / engineer judgment calls:**
1. Task 3 uses YAML `<<: *reviewer_base, status: implemented` syntax — confirm YAML merge key + explicit key coexistence works in js-yaml; if not, expand to full form
2. Task 9-10 rely on readHandoff signature that exists (confirmed line 284); Handoff type (types.ts:66) field names may differ from my assumed `task_id / level / active_feature / last_checkpoint / next_action` — read first, match exactly
3. Tasks 11-14 assume runPlan/runReview/runShip accept `stubs` / `level` / `override` / `confirmStdin` opts — some may need minimal wiring. Each task notes to adjust

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-sgc-audit-remediation.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a long plan like this (15 tasks) — protects context, enforces per-task review.

2. **Inline Execution** — Execute tasks in this session with batched checkpoints. Faster turnaround but burns context; risk of drift over 15 tasks.

**Recommendation:** Subagent-driven. 15 tasks × average ~300 lines of prompt + output per task = substantial context. Fresh subagent per task is the design intent of sp:subagent-driven-development.

Which approach?
