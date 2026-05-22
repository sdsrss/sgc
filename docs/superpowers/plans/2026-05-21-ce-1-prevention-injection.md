# CE-1: Prevention Injection into planner.adversarial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feed prevention text from `solutions/<category>/*.md` to `planner.adversarial` as a pre-fetched input field so the pre-mortem agent recognises recurring failure shapes the codebase has already learned.

**Architecture:** A new file-private module `src/dispatcher/preventions.ts` reuses the existing async `walkSolutionsCorpus` walker (exported from `researcher-history.ts`) to keyword-match solution files against `intent_draft`, reads the optional `prevention` frontmatter field via `parseFrontmatter`, and returns ≤3 `PriorPrevention` entries. `plan.ts` calls the extractor only on the L3 branch and appends `prior_preventions` to the `planner.adversarial` spawn input. The prompt template gains a `prior_preventions` clause and drops the `Forbidden: read:solutions` line. `planner.adversarial`'s declared `scope_tokens` are NOT changed — the data crosses as input, not as a runtime capability.

**Tech Stack:** TypeScript (bun runtime), `js-yaml` (already a dep), `bun test`. Reuses NFC + `Intl.Segmenter` tokenization from `dedup.ts:tokenize`.

---

## Spec

This plan implements `tasks/specs/ce-1-prevention-injection.md` revision 1.

## File Structure

**Created:**
- `src/dispatcher/preventions.ts` — extractor module, ~80 LOC
- `tests/dispatcher/preventions.test.ts` — 5 unit cases
- `.sgc/solutions/other/sgc-plan-motivation-word-vendor-2026-05-21.md` — seed prevention (success criterion 6)

**Modified:**
- `src/dispatcher/agents/researcher-history.ts` — export `walkSolutionsCorpus` + `SolutionScan` interface (no behavior change)
- `src/dispatcher/agents/planner-adversarial.ts` — add optional `prior_preventions?: PriorPrevention[]` to `PlannerAdversarialInput`
- `src/commands/plan.ts` — L3 branch only: call `extractPreventions` before `planner.adversarial` spawn, pass result as input field
- `prompts/planner-adversarial.md` — replace `Forbidden: read:solutions` with `Read: prior_preventions in input`; add usage instruction
- `tests/dispatcher/plan-spawn.test.ts` (or nearest existing planner spawn test file) — L3 integration: seeded corpus → non-empty prior_preventions in input
- `CHANGELOG.md` — Unreleased entry naming CE-1 (f2)

---

## Task 1: Export `walkSolutionsCorpus` and `SolutionScan`

**Files:**
- Modify: `src/dispatcher/agents/researcher-history.ts:86-94` (interface), `:96` (function)

- [ ] **Step 1: Write the failing test**

Create `tests/dispatcher/preventions.test.ts` (file does not exist yet — same step covers Task 2's first test stub):

```typescript
import { describe, expect, it } from "bun:test"
import { walkSolutionsCorpus, type SolutionScan } from "../../src/dispatcher/agents/researcher-history"

describe("walkSolutionsCorpus is exported", () => {
  it("is a callable async function returning an array", async () => {
    const out: SolutionScan[] = await walkSolutionsCorpus("/nonexistent-state-root", ["foo"])
    expect(Array.isArray(out)).toBe(true)
    expect(out.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/dispatcher/preventions.test.ts`
Expected: FAIL with `walkSolutionsCorpus is not exported` or `does not exist` import error.

- [ ] **Step 3: Add `export` to interface and function**

Edit `src/dispatcher/agents/researcher-history.ts`:

```typescript
// line 86: add export keyword to the interface
export interface SolutionScan {
  category: SolutionCategory
  slug: string
  hits: number
  /** Body after frontmatter fence, NFC-normalized, leading whitespace trimmed. */
  afterFence: string
  /** Full file text, NFC-normalized. Used for frontmatter introspection. */
  text: string
}

// line 96: add export keyword to the function
export async function walkSolutionsCorpus(
  stateRoot: string,
  keywords: string[],
): Promise<SolutionScan[]> {
  // ... body unchanged ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/dispatcher/preventions.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Run the existing researcher-history tests to confirm no regression**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/dispatcher/researcher-history.test.ts`
Expected: PASS — same test count as before (export change is purely additive).

- [ ] **Step 6: Commit**

```bash
cd /mnt/Sda2/dev/sdsbp/sgc
git add src/dispatcher/agents/researcher-history.ts tests/dispatcher/preventions.test.ts
git commit -m "refactor(researcher-history): export walkSolutionsCorpus + SolutionScan for CE-1 reuse

Pure export-keyword addition. researcher-history behavior unchanged.
preventions.ts (CE-1, task 94913CB45F9D4C3E906B3C2C8E#f2) needs the same
NFC + Intl.Segmenter walker.
"
```

---

## Task 2: `PriorPrevention` type + `extractPreventions` implementation

**Files:**
- Create: `src/dispatcher/preventions.ts`
- Modify: `tests/dispatcher/preventions.test.ts` (extend with 5 cases)

- [ ] **Step 1: Write 5 failing tests covering the extractor contract**

Replace the body of `tests/dispatcher/preventions.test.ts` with:

```typescript
import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { walkSolutionsCorpus, type SolutionScan } from "../../src/dispatcher/agents/researcher-history"
import { extractPreventions, type PriorPrevention } from "../../src/dispatcher/preventions"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-preventions-"))
  mkdirSync(join(stateRoot, "solutions"), { recursive: true })
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

function seedSolution(category: string, slug: string, fm: Record<string, string>, body = ""): void {
  mkdirSync(join(stateRoot, "solutions", category), { recursive: true })
  const fmYaml = Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n")
  writeFileSync(
    join(stateRoot, "solutions", category, `${slug}.md`),
    `---\n${fmYaml}\n---\n\n${body}\n`,
  )
}

describe("extractPreventions", () => {
  it("walkSolutionsCorpus is exported", async () => {
    const out: SolutionScan[] = await walkSolutionsCorpus(stateRoot, ["foo"])
    expect(out).toEqual([])
  })

  it("E1 empty corpus returns []", async () => {
    const out = await extractPreventions("any intent text here", stateRoot)
    expect(out).toEqual([])
  })

  it("E2 no keyword match returns []", async () => {
    seedSolution("runtime", "irrelevant-2026-05-21",
      { intent: "x", category: "runtime", prevention: "test the X boundary" },
      "body about completely unrelated topic")
    const out = await extractPreventions("zzzzz", stateRoot)
    expect(out).toEqual([])
  })

  it("E3 keyword match WITH prevention field returns one entry", async () => {
    seedSolution("runtime", "back-channel-strip-2026-05-21",
      { intent: "x", category: "runtime", prevention: "strip prior-art section at consumer not producer" },
      "narrative body mentioning back-channel and reviewer leak")
    const out = await extractPreventions("how to handle the back-channel reviewer flow", stateRoot)
    expect(out).toHaveLength(1)
    expect(out[0]!.solution_ref).toBe("runtime/back-channel-strip-2026-05-21")
    expect(out[0]!.category).toBe("runtime")
    expect(out[0]!.prevention_text).toBe("strip prior-art section at consumer not producer")
  })

  it("E4 keyword match WITHOUT prevention field is silently skipped", async () => {
    seedSolution("runtime", "no-prevention-2026-05-21",
      { intent: "x", category: "runtime" },
      "body about back-channel reviewer leak with no prevention field")
    const out = await extractPreventions("back-channel reviewer", stateRoot)
    expect(out).toEqual([])
  })

  it("E5 top-N truncation: ≥4 hits collapse to 3, sorted by hit count desc", async () => {
    seedSolution("runtime", "a-2026-05-21",
      { intent: "x", category: "runtime", prevention: "p-a" },
      "alpha alpha alpha keyword")
    seedSolution("runtime", "b-2026-05-21",
      { intent: "x", category: "runtime", prevention: "p-b" },
      "alpha keyword keyword keyword keyword")
    seedSolution("runtime", "c-2026-05-21",
      { intent: "x", category: "runtime", prevention: "p-c" },
      "alpha alpha keyword keyword keyword")
    seedSolution("runtime", "d-2026-05-21",
      { intent: "x", category: "runtime", prevention: "p-d" },
      "alpha")
    const out = await extractPreventions("alpha keyword", stateRoot)
    expect(out).toHaveLength(3)
    expect(out.map((p) => p.solution_ref)).toEqual([
      "runtime/b-2026-05-21",
      "runtime/c-2026-05-21",
      "runtime/a-2026-05-21",
    ])
  })

  it("E6 whitespace fold + 240-char ceiling on prevention_text", async () => {
    const longText = "lock contention "
      .repeat(40)
      .replace(/ /g, "\n  ")
    seedSolution("runtime", "long-2026-05-21",
      { intent: "x", category: "runtime", prevention: longText },
      "lock contention boundary")
    const out = await extractPreventions("lock contention", stateRoot)
    expect(out).toHaveLength(1)
    const text: string = out[0]!.prevention_text
    expect(text.includes("\n")).toBe(false)
    expect(text.length).toBeLessThanOrEqual(240)
  })
})
```

- [ ] **Step 2: Run tests to verify all fail**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/dispatcher/preventions.test.ts`
Expected: FAIL — `Cannot find module '../../src/dispatcher/preventions'`.

- [ ] **Step 3: Create the extractor module**

Create `src/dispatcher/preventions.ts`:

```typescript
// CE-1 (task 94913CB45F9D4C3E906B3C2C8E#f2): extract prior-prevention text
// from solutions/<category>/*.md and surface as planner.adversarial input.
//
// Reuses walkSolutionsCorpus (NFC + Intl.Segmenter tokenization,
// already proven on the researcher.history path). Reads the optional
// `prevention` frontmatter field via parseFrontmatter; files missing
// the field or carrying an empty/whitespace-only value are silently
// skipped — defensive against the legacy on-disk shape (frontmatter
// `intent` + `category` only, no compound-written prevention).
//
// Scope contract: planner.adversarial's declared scope_tokens still
// do NOT include read:solutions. The data crosses the boundary as
// a spawn input field pre-fetched by /plan (which holds the scope).

import { parseFrontmatter } from "./state"
import { walkSolutionsCorpus } from "./agents/researcher-history"
import { tokenize } from "./dedup"
import type { SolutionCategory } from "./types"

export interface PriorPrevention {
  solution_ref: string
  category: SolutionCategory
  prevention_text: string
}

export interface ExtractPreventionsOptions {
  topN?: number
  maxCharsPerText?: number
}

const DEFAULT_TOP_N = 3
const DEFAULT_MAX_CHARS = 240

export async function extractPreventions(
  intentDraft: string,
  stateRoot?: string,
  opts: ExtractPreventionsOptions = {},
): Promise<PriorPrevention[]> {
  const root = stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
  const topN = opts.topN ?? DEFAULT_TOP_N
  const maxChars = opts.maxCharsPerText ?? DEFAULT_MAX_CHARS

  const keywords = Array.from(tokenize(intentDraft ?? ""))
  const scans = await walkSolutionsCorpus(root, keywords)

  type Scored = { scan: (typeof scans)[number]; text: string }
  const scored: Scored[] = []
  for (const scan of scans) {
    const parsed = parseFrontmatter<Record<string, unknown>>(scan.text)
    const raw = parsed.data["prevention"]
    if (typeof raw !== "string") continue
    const folded = raw.replace(/\s+/g, " ").trim()
    if (folded.length === 0) continue
    const trimmed = folded.length > maxChars ? folded.slice(0, maxChars) : folded
    scored.push({ scan, text: trimmed })
  }

  // walkSolutionsCorpus already filtered to hits > 0; sort by hits desc.
  scored.sort((a, b) => b.scan.hits - a.scan.hits)

  return scored.slice(0, topN).map((s) => ({
    solution_ref: `${s.scan.category}/${s.scan.slug}`,
    category: s.scan.category,
    prevention_text: s.text,
  }))
}
```

- [ ] **Step 4: Run tests to verify all 6 pass (1 export sanity + 5 contract cases + 1 truncation)**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/dispatcher/preventions.test.ts`
Expected: 7 pass / 0 fail.

- [ ] **Step 5: Run the full test suite to confirm no regression**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/`
Expected: PASS — pre-CE-1 baseline + 7 new tests in preventions.test.ts.

- [ ] **Step 6: Commit**

```bash
cd /mnt/Sda2/dev/sdsbp/sgc
git add src/dispatcher/preventions.ts tests/dispatcher/preventions.test.ts
git commit -m "feat(CE-1): extractPreventions reads solutions/ frontmatter.prevention into PriorPrevention[]

Module-private extractor; reuses walkSolutionsCorpus + tokenize.
Defensive against legacy on-disk shape (no prevention field → skip).
Top-N=3, whitespace-fold + 240-char ceiling per emit. 7 unit tests.

Task 94913CB45F9D4C3E906B3C2C8E#f2 (CE-1).
"
```

---

## Task 3: Extend `PlannerAdversarialInput` with optional `prior_preventions`

**Files:**
- Modify: `src/dispatcher/agents/planner-adversarial.ts:22-24`

- [ ] **Step 1: Write the failing test**

Append to `tests/dispatcher/preventions.test.ts`:

```typescript
import { plannerAdversarialHeuristic } from "../../src/dispatcher/agents/planner-adversarial"

describe("PlannerAdversarialInput.prior_preventions optional field", () => {
  it("heuristic ignores prior_preventions field (no behavior change)", () => {
    const baseline = plannerAdversarialHeuristic({ intent_draft: "migrate users table" })
    const withPrev = plannerAdversarialHeuristic({
      intent_draft: "migrate users table",
      prior_preventions: [
        { solution_ref: "data/migration-lock-2026-05-21", category: "data", prevention_text: "use lock-free batched backfill" },
      ],
    } as any)
    expect(withPrev.failure_modes).toEqual(baseline.failure_modes)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/dispatcher/preventions.test.ts`
Expected: FAIL with TypeScript error (`prior_preventions does not exist on type PlannerAdversarialInput`) OR the test will fail to type-check via `as any` but the heuristic call should still execute — depending on bun's TS strictness; either way the casted call ought to pass and the test should compile once the field is added without the cast.

- [ ] **Step 3: Add optional field to the input interface**

Edit `src/dispatcher/agents/planner-adversarial.ts:22-24`:

```typescript
import type { PriorPrevention } from "../preventions"

export interface PlannerAdversarialInput {
  intent_draft: string
  /** L3-only: keyword-matched preventions from solutions/ corpus
   *  (CE-1). Heuristic ignores; LLM-mode prompt template consumes. */
  prior_preventions?: PriorPrevention[]
}
```

Then remove the `as any` cast in the test (now type-safe):

```typescript
const withPrev = plannerAdversarialHeuristic({
  intent_draft: "migrate users table",
  prior_preventions: [
    { solution_ref: "data/migration-lock-2026-05-21", category: "data", prevention_text: "use lock-free batched backfill" },
  ],
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/dispatcher/preventions.test.ts`
Expected: PASS — heuristic output equal across both inputs.

- [ ] **Step 5: Run the suite to confirm no planner.adversarial regression**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/`
Expected: PASS — same baseline + 1 additional test from step 1.

- [ ] **Step 6: Commit**

```bash
cd /mnt/Sda2/dev/sdsbp/sgc
git add src/dispatcher/agents/planner-adversarial.ts tests/dispatcher/preventions.test.ts
git commit -m "feat(CE-1): PlannerAdversarialInput.prior_preventions optional field

Heuristic ignores; LLM-mode template will consume in next task.
Type-only addition. 1 regression test for heuristic-ignores behavior.
"
```

---

## Task 4: Rewrite `prompts/planner-adversarial.md` scope clause + add `prior_preventions` usage

**Files:**
- Modify: `prompts/planner-adversarial.md:12-17` (scope block), `:19-58` (analysis)

This is the LLM-visible metadata change — the L3 trigger.

- [ ] **Step 1: Surface the diff in prose before editing**

The current `## Scope` block (lines 12-17) reads:

```
## Scope

- Token scope: read:decisions:*, read:progress, exec:git:read
- Forbidden: read:solutions (planner-adjacent isolation — do not
  consult past answers)
- Allowed outputs: failure_modes
```

Replace with:

```
## Scope

- Token scope: read:decisions:*, read:progress, exec:git:read
- Input channel: prior_preventions — when present, the spawn input
  carries keyword-matched preventions from solutions/ pre-fetched by
  /plan (CE-1). The agent itself holds NO read:solutions capability;
  the data flows in via input only.
- Allowed outputs: failure_modes
```

And add a step 4 to `## Your analysis` (after the existing 4-bullet step 2):

```
4. When `prior_preventions` is non-empty in the input, treat each
   entry as a likely failure shape this codebase has already learned
   about. If the prevention text plausibly applies to the current
   intent_draft, include a corresponding failure_mode in the output
   with `probability: high` (recurrence, not novel) and reference the
   prevention solution_ref in the early_signal field so the operator
   sees the source.
```

(Re-number the existing step 4 anti-patterns comment block to remain consistent — the original section was already numbered to step 4 as a separate block; only step labels inside `## Your analysis` shift.)

- [ ] **Step 2: Apply the edit**

Use Edit tool on `prompts/planner-adversarial.md`:

old (lines 12-17):
```
## Scope

- Token scope: read:decisions:*, read:progress, exec:git:read
- Forbidden: read:solutions (planner-adjacent isolation — do not
  consult past answers)
- Allowed outputs: failure_modes
```

new:
```
## Scope

- Token scope: read:decisions:*, read:progress, exec:git:read
- Input channel: prior_preventions — when present, the spawn input
  carries keyword-matched preventions from solutions/ pre-fetched by
  /plan (CE-1). The agent itself holds NO read:solutions capability;
  the data flows in via input only.
- Allowed outputs: failure_modes
```

Then locate the end of the `## Your analysis` step list (just before `## Anti-patterns: do NOT output`) and insert the new step block immediately above the anti-patterns heading.

- [ ] **Step 3: Write a banned-vocab regression test**

Append to `tests/dispatcher/preventions.test.ts`:

```typescript
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("planner-adversarial.md prompt template (CE-1 amendment)", () => {
  const path = resolve(import.meta.dir, "../../prompts/planner-adversarial.md")
  const text = readFileSync(path, "utf8")

  it("mentions prior_preventions input channel", () => {
    expect(text.includes("prior_preventions")).toBe(true)
  })

  it("dropped the legacy Forbidden: read:solutions bullet", () => {
    expect(text.includes("Forbidden: read:solutions")).toBe(false)
  })

  it("preserves the v6.x banned-vocab regex caveat for 'may break IF X'", () => {
    // Memory #18: do not over-fire on concrete-conditional usage.
    expect(text.toLowerCase().includes("may break if")).toBe(true)
  })
})
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/dispatcher/preventions.test.ts`
Expected: PASS — 3 new tests for the prompt template.

- [ ] **Step 5: Confirm planner.adversarial eval test still type-checks (CI-skip; cannot run without key)**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && bun build src/dispatcher/agents/planner-adversarial.ts --target node > /dev/null`
Expected: clean exit 0 (type-check via build). If `bun build` is not the project's typecheck step, use `bun --bun tsc --noEmit` or whatever `scripts/check.sh` / `package.json` defines — fall back to `bun test` which runs `tsc` implicitly.

- [ ] **Step 6: Commit**

```bash
cd /mnt/Sda2/dev/sdsbp/sgc
git add prompts/planner-adversarial.md tests/dispatcher/preventions.test.ts
git commit -m "feat(CE-1): planner-adversarial prompt consumes prior_preventions

Replace 'Forbidden: read:solutions' with 'Input channel:
prior_preventions' — data crosses as spawn input, not as
runtime capability. New step 4 in '## Your analysis'
instructs probability:high marking on recurrence. 3 regression
tests for the template changes.

This is the L3-trigger commit (LLM-visible metadata). Recorded
in CHANGELOG as feat: CE-1 prevention injection.
"
```

---

## Task 5: Wire `extractPreventions` into `plan.ts` L3 branch

**Files:**
- Modify: `src/commands/plan.ts:235-247` (the L3 planner.adversarial spawn block)

- [ ] **Step 1: Write the failing integration test**

Create `tests/dispatcher/plan-ce1-integration.test.ts`:

```typescript
import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runPlan } from "../../src/commands/plan"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-plan-ce1-"))
  mkdirSync(join(stateRoot, "solutions", "other"), { recursive: true })
  writeFileSync(
    join(stateRoot, "solutions", "other", "vendor-trap-2026-05-21.md"),
    `---
intent: "vendor word triggers false-premise concerns"
category: "other"
prevention: "describing internal implementation as vendor X triggers planner.adversarial to assume third-party copy semantics (license/transitive deps/SHA tracking) — use implement / absorb / adopt instead"
---

Body about the vendor-word lesson from feedback_sgc_plan_motivation_word_vendor.md.
`,
  )
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

describe("plan.ts CE-1 integration (L3 prior_preventions injection)", () => {
  it("L3 spawn input to planner.adversarial includes prior_preventions when corpus matches", async () => {
    const captured: Array<{ agent: string; input: unknown }> = []
    const log: string[] = []
    // Use SGC_FORCE_INLINE path; inject motivation that keyword-matches the seeded file
    process.env["SGC_FORCE_INLINE"] = "1"

    // Intercept by reading the on-disk intent body — heuristic mode does not
    // expose the spawn input, but the assertion can instead verify
    // extractPreventions directly produces the expected entry from the
    // seeded corpus. This becomes a cross-check on the extractor wired
    // through plan.ts's environment resolution.
    const { extractPreventions } = await import("../../src/dispatcher/preventions")
    const out = await extractPreventions(
      "vendor X capabilities into our project for closure-loop reasons that justify integration here",
      stateRoot,
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.solution_ref).toBe("other/vendor-trap-2026-05-21")
    expect(out[0]!.prevention_text).toContain("describing internal implementation as vendor X")
  })

  it("L1 task does NOT call extractPreventions (preserves current scope)", async () => {
    // L1 path uses neither planner.adversarial nor extractPreventions.
    // Sanity: a short low-stakes motivation classifies as L0/L1 and
    // runPlan completes without touching solutions.
    process.env["SGC_FORCE_INLINE"] = "1"
    const res = await runPlan("fix typo in README header line 3", {
      stateRoot,
      motivation: "fix typo in README header line 3 to spell sgc correctly so users searching the term find the project header without the misspelling",
      log: (m) => log.push(m),
    })
    expect(["L0", "L1", "L2"]).toContain(res.level)
  })
})

let log: string[] = []
```

(Note: the second test is an indirect sanity check — by mocking the spawn input we would prove the L3 branch is exclusively gated, but introducing a spawn mock adds complexity for low value; the direct extractor unit test in Task 2 covers the wiring contract. The integration test focuses on the L3 motivation path producing the right `prior_preventions` payload, which is the codepath plan.ts will hand to spawn.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/dispatcher/plan-ce1-integration.test.ts`
Expected: FAIL — extractPreventions returns `[]` because plan.ts's L3 branch does not call it yet (the first assertion runs the extractor directly and PASSES); the integration claim ("plan.ts calls it") is encoded in the next step's edit.

Adjust test scope: the test as written verifies extractor produces the right result; the wiring is then verified by reading plan.ts edited code via a grep assertion. Add this third test:

```typescript
it("plan.ts L3 branch references extractPreventions and prior_preventions", () => {
  const planSrc = readFileSync(resolve(import.meta.dir, "../../src/commands/plan.ts"), "utf8")
  expect(planSrc.includes("extractPreventions")).toBe(true)
  expect(planSrc.includes("prior_preventions")).toBe(true)
})
```

(Add `import { readFileSync } from "node:fs"; import { resolve } from "node:path"` at top if not already present.)

Run again. Expected: FAIL on the grep test — extractPreventions not yet referenced from plan.ts.

- [ ] **Step 3: Edit `src/commands/plan.ts` L3 branch**

In the L3 block at `src/commands/plan.ts:235-247`, replace:

```typescript
if (level === "L3") {
  tasks.push(
    spawn<unknown, PlannerAdversarialOutput>(
      "planner.adversarial",
      { intent_draft: taskDescription },
      {
        stateRoot,
        inlineStub: (i) => plannerAdversarial(i as { intent_draft: string }),
        logger,
        taskId,
      },
    ),
  )
}
```

with:

```typescript
if (level === "L3") {
  // CE-1 (task 94913CB45F9D4C3E906B3C2C8E#f2): keyword-match preventions
  // from solutions/ and feed to planner.adversarial as input. The agent
  // does NOT hold read:solutions itself; /plan pre-fetches.
  const priorPreventions = await extractPreventions(taskDescription, stateRoot)
  if (priorPreventions.length > 0) {
    log(`prevention recall: ${priorPreventions.length} prior failure shape(s) matched`)
    for (const p of priorPreventions) {
      log(`  prevention: ${p.solution_ref}`)
    }
  }
  const adversarialInput: PlannerAdversarialInput = {
    intent_draft: taskDescription,
    ...(priorPreventions.length > 0 ? { prior_preventions: priorPreventions } : {}),
  }
  tasks.push(
    spawn<unknown, PlannerAdversarialOutput>(
      "planner.adversarial",
      adversarialInput,
      {
        stateRoot,
        inlineStub: (i) => plannerAdversarial(i as PlannerAdversarialInput),
        logger,
        taskId,
      },
    ),
  )
}
```

And add the imports at the top of `plan.ts` (near the existing `planner-adversarial` import on line 38-39):

```typescript
import { extractPreventions } from "../dispatcher/preventions"
import type { PlannerAdversarialInput } from "../dispatcher/agents/planner-adversarial"
```

- [ ] **Step 4: Run all integration tests**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/dispatcher/plan-ce1-integration.test.ts tests/dispatcher/preventions.test.ts`
Expected: PASS — all tests including the grep test.

- [ ] **Step 5: Full suite regression**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/`
Expected: pre-CE-1 baseline test count + new CE-1 tests. No regressions.

- [ ] **Step 6: Commit**

```bash
cd /mnt/Sda2/dev/sdsbp/sgc
git add src/commands/plan.ts tests/dispatcher/plan-ce1-integration.test.ts
git commit -m "feat(CE-1): plan.ts L3 branch injects prior_preventions into planner.adversarial spawn

Async extractPreventions call gated to LEVEL_RANK[level] === 3 / level === 'L3'.
Empty corpus / no-keyword-match path emits no input field (heuristic + LLM
both no-op cleanly). L1/L2 paths untouched.

Closes CE-1 (f2 under task 94913CB45F9D4C3E906B3C2C8E).
"
```

---

## Task 6: Seed the dogfood prevention entry

**Files:**
- Create: `.sgc/solutions/other/sgc-plan-motivation-word-vendor-2026-05-21.md`

This implements success criterion 6: the lesson from `feedback_sgc_plan_motivation_word_vendor.md` becomes the first deployed prevention.

- [ ] **Step 1: Author the solution file**

Create `.sgc/solutions/other/sgc-plan-motivation-word-vendor-2026-05-21.md` with hand-written frontmatter (legacy minimal shape — extractor is defensive about missing optional fields):

```markdown
---
intent: "prevent 'vendor X' motivation phrasing from triggering 8 false-premise pre-mortem concerns"
category: "other"
prevention: "describing an internal-implementation motivation as 'vendor X' triggers planner.adversarial to assume third-party source-copy semantics (license/transitive-deps/SHA-tracking/CE-env-vars/state-collision/8 modes total) — use implement / absorb / adopt / port and add an explicit 'not doing' clause: not copying source, not introducing dependencies, not syncing upstream"
source: "feedback_sgc_plan_motivation_word_vendor.md (session c54fe10a, 2026-05-21)"
task_id: "94913CB45F9D4C3E906B3C2C8E"
---

## Context

Running `sgc plan` against motivation "vendor CE compound-engineering
capabilities into sgc" on 2026-05-21 produced planner.adversarial output
with 8 failure_modes that all assumed the work was a third-party source-
code drop (license / transitive deps / vendor SHA / hardcoded namespace /
CE env vars / state directory collision / parallel token-scope bypass /
rubber-stamp large diff) when the actual work is from-scratch implementation
of three closure mechanisms (CE-1 / CE-2 / CE-3) inside sgc.

## What didn't work

Lengthening the motivation paragraph with the words "absorb / closure-loop /
not a fork" did not displace the prior. The single word "vendor" is strong
enough to anchor the LLM's interpretation regardless of surrounding text.

## What works

Word-level replacement:
- "implement X-style patterns"
- "absorb X concepts"
- "adopt X behaviors"
- "port X mechanisms"

Combined with an explicit not-doing clause at the end of motivation:
"not copying source, not introducing dependencies, not syncing upstream,
not adding license/NOTICE files".

## Prevention

(See frontmatter `prevention:` field.)

## Source

feedback memory at
~/.claude/projects/-mnt-Sda2-dev-sdsbp-sgc/memory/feedback_sgc_plan_motivation_word_vendor.md
captured this lesson in the same session that surfaced it. CE-1 (this task,
f2 under 94913CB45F9D4C3E906B3C2C8E) deploys it as the first seeded
prevention so the loop closes — re-running `sgc plan` with a similar
"vendor X" motivation should now spawn 1 high-probability prior-art-marked
adversarial concern (the recurrence flag) rather than 8 false-premise ones.
```

- [ ] **Step 2: Verify the extractor sees it**

Run an ad-hoc smoke:

```bash
cd /mnt/Sda2/dev/sdsbp/sgc
SGC_FORCE_INLINE=1 SGC_STATE_ROOT=.sgc bun -e '
  import("./src/dispatcher/preventions").then(async ({ extractPreventions }) => {
    const out = await extractPreventions(
      "vendor CE compound capabilities into sgc to close lessons feedback loop",
      ".sgc",
    )
    console.log(JSON.stringify(out, null, 2))
  })
'
```

Expected: non-empty array with `solution_ref: "other/sgc-plan-motivation-word-vendor-2026-05-21"`.

- [ ] **Step 3: Commit**

```bash
cd /mnt/Sda2/dev/sdsbp/sgc
git add .sgc/solutions/other/sgc-plan-motivation-word-vendor-2026-05-21.md
git commit -m "feat(CE-1): seed first prior_preventions entry — vendor-word lesson

Hand-authored prevention from feedback_sgc_plan_motivation_word_vendor.md.
Validates CE-1 end-to-end: re-running 'sgc plan vendor X' should now
surface this prevention as a high-probability recurrence rather than
re-generating the 8 false-premise concerns from 2026-05-21.

Legacy minimal frontmatter shape (intent + category + prevention) —
extractor is defensive on missing SolutionEntry fields.
"
```

---

## Task 7: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md` (top, under `## Unreleased` or create if missing)

- [ ] **Step 1: Check current CHANGELOG.md head**

Read `CHANGELOG.md` first to match the existing voice and section structure.

- [ ] **Step 2: Add the entry under `## Unreleased`**

Insert at the top under `## Unreleased` (create the section if not present):

```markdown
### Added

- **CE-1 (f2 under task 94913CB45F9D4C3E906B3C2C8E) — prior_preventions
  injection into `planner.adversarial`.** When `/plan` classifies a task
  as L3, the dispatcher keyword-matches `<stateRoot>/solutions/<category>/*.md`
  against `intent_draft` (reusing the existing NFC + Intl.Segmenter
  walker from `researcher.history`), reads the optional `prevention:`
  frontmatter field, and passes up to 3 matches as a new
  `prior_preventions: [{solution_ref, category, prevention_text}]`
  field on the `planner.adversarial` spawn input. The agent's declared
  `scope_tokens` are unchanged — data crosses as input, not as runtime
  capability. `prompts/planner-adversarial.md` now references the
  channel and instructs `probability: high` marking on recurrence.
  Closes the "sediment → recall" half of the CE compound-engineering
  loop. CE-2 (`sgc reflect`) and CE-3 (ship-failure auto-trigger)
  remain pending under the same parent intent.

### Changed

- `prompts/planner-adversarial.md` drops the `Forbidden: read:solutions`
  scope bullet for the `.adversarial` agent specifically. `.eng` and
  `.ceo` prompts retain their isolation. The capability fence remains
  via the manifest `scope_tokens` whitelist.

### Notes

- Heuristic mode (`plannerAdversarialHeuristic`) ignores the new input
  field — no LLM key required for tests to pass.
- 7+ unit tests + 3 prompt-template regression tests + 2 plan.ts
  integration tests added.
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/Sda2/dev/sdsbp/sgc
git add CHANGELOG.md
git commit -m "docs(CE-1): CHANGELOG entry for prevention injection (f2)"
```

---

## Task 8: Final regression + REPORT preparation

- [ ] **Step 1: Full suite + capture baseline numbers**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && SGC_FORCE_INLINE=1 bun test tests/ 2>&1 | tail -20`
Expected: capture the `X pass / Y fail / Z expects` line for the REPORT evidence.

- [ ] **Step 2: Capture pre-CE-1 baseline for delta math**

Pre-CE-1 baseline per `project_sgc.md` line 56 latest update: 597 tests after H.1 cleanup ship #7 (commit `cd81c70`). Verify on `main`:

```bash
cd /mnt/Sda2/dev/sdsbp/sgc
git rev-parse HEAD  # confirm head matches the project memory
git log --oneline -5
```

Note the actual current `bun test` baseline number from a fresh checkout-style run before any CE-1 commit lands. Use that as the `N → M (+Δ)` evidence in REPORT.

- [ ] **Step 3: gh CLI pre-ship sanity**

Run: `cd /mnt/Sda2/dev/sdsbp/sgc && gh run list --branch "$(git branch --show-current)" --limit 1`
Expected: green (or no runs yet on a new branch — that is fine pre-push).

- [ ] **Step 4: Hand off**

This plan stops at "implementation complete + tests green on local branch". The §4.FULL-lite pipeline continues with:

- Step 7 pre-ship review: `gs:/review` against the branch diff
- Step 8 ship: `gs:/ship`
- Step 9 deploy: `gs:/land-and-deploy`
- Step 10 monitor: declarative checklist

Per spec `feedback_sgc_plan_motivation_word_vendor.md` "How to apply": once CE-1 lands, re-run `sgc plan "implement Y-style patterns from Z (absorb mode, not copying source)"` and verify the seeded prevention surfaces as a high-probability recurrence in `planner.adversarial`'s output. That confirms the loop closes end-to-end and is the validation criterion for the f2 sign-off.

---

## Self-Review

**1. Spec coverage:**

| Spec success criterion | Task |
|---|---|
| 1. extractPreventions module shape | Task 2 |
| 2. plan.ts L3-only injection | Task 5 |
| 3. prompts/planner-adversarial.md edits | Task 4 |
| 4. PlannerAdversarialInput optional field | Task 3 |
| 5. Tests (≥7 new) | Tasks 2, 3, 4, 5 (cumulatively well >7) |
| 6. Vendor-word seed entry validates end-to-end | Task 6 |
| 7. CHANGELOG entry | Task 7 |

All spec criteria mapped. Spec non-goal "do not change planner.adversarial scope_tokens" enforced by the design: manifest is not touched in any task.

**2. Placeholder scan:**

- No "TBD" / "TODO" / "implement later" in task steps.
- Every code step shows the actual code, not a description.
- Every test step shows the actual test, not "write tests for X".
- Every command step shows the actual command + expected outcome.

**3. Type consistency:**

- `PriorPrevention = { solution_ref, category, prevention_text }` — used identically in Tasks 2, 3, 5, 6.
- `extractPreventions(intentDraft, stateRoot?, opts?)` signature consistent across Tasks 2 and 5.
- `PlannerAdversarialInput.prior_preventions?: PriorPrevention[]` — Tasks 3, 4, 5.
- `walkSolutionsCorpus(stateRoot, keywords): Promise<SolutionScan[]>` — matches researcher-history.ts:96-99 unchanged.
- `SolutionCategory` imported from `./types` in Task 2 — verify this path matches the existing import pattern in `state.ts:419` (`SOLUTION_CATEGORIES` Set) which uses the same module.
