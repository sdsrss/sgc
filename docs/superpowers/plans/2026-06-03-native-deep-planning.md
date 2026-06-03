# Native Deep Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under L2/L3 (and L1 with `--deep`), `sgc plan` natively authors a file-level task decomposition with bite-sized TDD steps into an enriched `feature-list.md` (single source of truth) and derives an `sp:writing-plans`-style markdown doc, with prior-art / pre-mortem shaping the tasks (CE reuse-in).

**Architecture:** A new `planner.decompose` agent (isomorphic with the existing planner cluster: own prompt + pinned scope tokens + inline heuristic fallback) runs serially after `fusePlan`, consuming eng `structural_risks` + researcher `prior_art` + adversarial `failure_modes` + CE-1 `prior_preventions`. Its `tasks[]→steps[]` output is mapped 1:1 into `feature-list.md` features; a pure `renderPlanMarkdown` function derives the markdown doc from that single source of truth (no drift). `sgc work` gains a light read adaptation only.

**Tech Stack:** TypeScript (Node ESM, bun test runner), the existing `spawn` protocol, YAML contracts, the `embedded-data.ts` bundle-inlining mechanism.

**Spec:** `docs/superpowers/specs/2026-06-03-native-deep-planning-design.md`

---

## Conventions for this codebase (read before starting)

- **Test runner:** `bun test`. Run a single file: `bun test tests/dispatcher/<file>.test.ts`. Inline/deterministic agent mode is forced with `SGC_FORCE_INLINE=1`.
- **Two test lanes** (`feedback_sgc_test_lane_divergence`): `npm test` + `publish.yml` run only `tests/dispatcher`; CI `test.yml` runs `tests/dispatcher tests/eval`. **Before ship, run `bun test tests/dispatcher tests/eval`** and grep both dirs for callers of changed functions.
- **Agent pattern:** every agent exports a `*Heuristic(input)` pure fallback + a backward-compat alias (`export const plannerX = plannerXHeuristic`). The LLM path is routed by `spawn.ts` from the manifest `prompt_path`. Tests exercise the heuristic; LLM output is only sanity/banned-vocab checked in the eval lane.
- **New prompt = three wiring points** or `sgc doctor` goes red: (1) `contracts/sgc-capabilities.yaml` manifest `prompt_path`, (2) `src/dispatcher/embedded-data.ts` import + `EMBEDDED_PROMPTS` map entry, (3) the `prompts/<name>.md` file itself.
- **Bundle:** any `src/` or `package.json` change requires `npm run build:cli` + committing `plugins/sgc/bin/sgc.mjs` with mode `100755` (`git add --chmod=+x`). Done once at the end (Task 9), not per task.
- **Reply language:** Chinese chat prose; English code/commits/paths.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/dispatcher/types.ts` | Modify | Add `PlanStep`, `PlanStepKind`; extend `Feature` with `files?` / `steps?` / `prior_art_refs?`. |
| `src/dispatcher/agents/planner-decompose.ts` | Create | `planner.decompose` agent: input/output types + heuristic fallback + alias. Pure, no I/O. |
| `prompts/planner-decompose.md` | Create | LLM prompt template for the decomposer. |
| `src/dispatcher/plan-render.ts` | Create | Pure `renderPlanMarkdown(list, intent)` → sp-style markdown string. No I/O. |
| `contracts/sgc-capabilities.yaml` | Modify | `planner.decompose` manifest block. |
| `contracts/sgc-state.schema.yaml` | Modify | Document new `Feature` fields. |
| `src/dispatcher/embedded-data.ts` | Modify | Embed `prompts/planner-decompose.md`. |
| `src/dispatcher/state.ts` | Modify | Add `writePlanDoc(slug, md, stateRoot)` (resolves the docs path; thin I/O wrapper). |
| `src/commands/plan.ts` | Modify | `--deep` gating; spawn decompose after fusion; map tasks→features; render+write markdown. |
| `src/sgc.ts` | Modify | Parse `--deep` flag → `PlanOptions.deep`. |
| `src/commands/work.ts` | Modify | `printList` shows files + step count; `nextActiveId` honors `depends_on`. |
| `docs/POSITIONING.md` | Modify | "Deep plan authoring" row: light → native. |
| `tests/dispatcher/planner-decompose.test.ts` | Create | Heuristic shape + reuse-in mapping. |
| `tests/dispatcher/plan-render.test.ts` | Create | sp-format render + no-drift round-trip. |
| `tests/dispatcher/plan-deep.test.ts` | Create | plan.ts deep gating + writeback integration. |
| `tests/dispatcher/work.test.ts` | Modify | multi-task print + depends_on ordering. |

---

## Task 1: Schema types — `PlanStep` + enriched `Feature`

**Files:**
- Modify: `src/dispatcher/types.ts:53-84` (the `Feature` and `FeatureList` interfaces)
- Modify: `contracts/sgc-state.schema.yaml` (document the new fields, near the `feature_list` block ~line 123)
- Test: `tests/dispatcher/state.test.ts` (round-trip via existing `writeFeatureList`/`readFeatureList`)

- [ ] **Step 1: Write the failing test**

Append to `tests/dispatcher/state.test.ts`:

```ts
import { test, expect } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { writeFeatureList, readFeatureList, ensureSgcStructure } from "../../src/dispatcher/state"
import type { FeatureList } from "../../src/dispatcher/types"

test("feature-list round-trips files/steps/prior_art_refs", () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-state-deep-"))
  ensureSgcStructure(root)
  const list: FeatureList = {
    features: [
      {
        id: "f1",
        title: "add cursor pagination",
        status: "pending",
        files: { create: ["src/page.ts"], modify: ["src/api.ts"], test: ["tests/page.test.ts"] },
        steps: [
          { kind: "test", text: "write failing test" },
          { kind: "verify-red", text: "run it", run: "bun test", expect: "FAIL" },
          { kind: "guard", text: "guard against off-by-one" },
        ],
        prior_art_refs: ["perf/pagination-cursor"],
      },
    ],
  }
  writeFeatureList(list, "", root)
  const back = readFeatureList(root)
  expect(back).not.toBeNull()
  const f = back!.list.features[0]!
  expect(f.files).toEqual({ create: ["src/page.ts"], modify: ["src/api.ts"], test: ["tests/page.test.ts"] })
  expect(f.steps).toHaveLength(3)
  expect(f.steps![1]).toEqual({ kind: "verify-red", text: "run it", run: "bun test", expect: "FAIL" })
  expect(f.prior_art_refs).toEqual(["perf/pagination-cursor"])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/state.test.ts -t "round-trips files"`
Expected: FAIL — TypeScript error / type mismatch on `files`/`steps`/`prior_art_refs` (not declared on `Feature`).

- [ ] **Step 3: Write minimal implementation**

In `src/dispatcher/types.ts`, immediately above `export interface Feature {` (line 53) add:

```ts
export type PlanStepKind =
  | "test"
  | "verify-red"
  | "implement"
  | "verify-green"
  | "commit"
  | "guard"

/**
 * One bite-sized step inside a decomposed plan task (Phase 2b). Mirrors the
 * sp:writing-plans 5-step TDD cycle (test → verify-red → implement →
 * verify-green → commit) plus `guard` — a defensive step derived from a prior
 * failure-mode / prevention (CE reuse-in).
 */
export interface PlanStep {
  kind: PlanStepKind
  /** Complete content for the engineer. NO placeholders (sp:writing-plans rule). */
  text: string
  /** Exact command for verify-* / commit steps. */
  run?: string
  /** Expected output for verify-* steps. */
  expect?: string
}
```

Then inside `interface Feature { ... }`, after the `waived_red?` field (line 79), add:

```ts
  /**
   * Deep-plan decomposition (Phase 2b). Set when `sgc plan` authors a
   * file-level task. Absent on the single-placeholder feature (non-deep paths).
   */
  files?: { create: string[]; modify: string[]; test: string[] }
  steps?: PlanStep[]
  /**
   * solution_refs from researcher.history prior_art that seeded this task
   * (CE reuse-in). Drives surfaced_in / applied_in writeback in plan.ts.
   */
  prior_art_refs?: string[]
```

In `contracts/sgc-state.schema.yaml`, under the `feature_list` documentation block, add a comment documenting the additive fields (the schema file is doc/comment-driven; mirror the style of the existing `prior_red` comment):

```yaml
    # Phase 2b deep-plan fields (additive, optional — absent on non-deep plans):
    #   files:          { create: [path], modify: [path], test: [path] }
    #   steps:          [{ kind, text, run?, expect? }]  kind ∈ test|verify-red|
    #                   implement|verify-green|commit|guard
    #   prior_art_refs: [solution_ref]  — CE reuse-in provenance
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/state.test.ts -t "round-trips files"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/types.ts contracts/sgc-state.schema.yaml tests/dispatcher/state.test.ts
git commit -m "feat(types): add PlanStep + enriched Feature fields for deep planning"
```

---

## Task 2: `planner.decompose` agent (heuristic + types)

**Files:**
- Create: `src/dispatcher/agents/planner-decompose.ts`
- Test: `tests/dispatcher/planner-decompose.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/dispatcher/planner-decompose.test.ts`:

```ts
import { test, expect } from "bun:test"
import {
  plannerDecomposeHeuristic,
  type DecomposeInput,
} from "../../src/dispatcher/agents/planner-decompose"

test("heuristic returns one coarse task with the canonical TDD steps", () => {
  const out = plannerDecomposeHeuristic({ intent_draft: "add cursor pagination to GET /orders" })
  expect(out.tasks).toHaveLength(1)
  const t = out.tasks[0]!
  expect(t.id).toBe("f1")
  expect(t.title).toContain("cursor pagination")
  const kinds = t.steps.map((s) => s.kind)
  expect(kinds).toEqual(["test", "verify-red", "implement", "verify-green", "commit"])
})

test("reuse-in: each failure mode adds a guard step before commit", () => {
  const input: DecomposeInput = {
    intent_draft: "migrate the orders table",
    failure_modes: [
      { scenario: "data loss on migration", probability: "medium", impact: "high", early_signal: "row count drops" },
    ],
  }
  const out = plannerDecomposeHeuristic(input)
  const steps = out.tasks[0]!.steps
  const guards = steps.filter((s) => s.kind === "guard")
  expect(guards).toHaveLength(1)
  expect(guards[0]!.text).toContain("data loss on migration")
  // guard precedes the final commit step
  expect(steps[steps.length - 1]!.kind).toBe("commit")
})

test("reuse-in: prior_art solution_refs flow into prior_art_refs", () => {
  const out = plannerDecomposeHeuristic({
    intent_draft: "add pagination",
    prior_art: [
      { solution_ref: "perf/pagination-cursor", relevance_score: 0.8, excerpt: "..." },
      { solution_ref: "api/orders-list", relevance_score: 0.6, excerpt: "..." },
    ],
  })
  expect(out.tasks[0]!.prior_art_refs).toEqual(["perf/pagination-cursor", "api/orders-list"])
})

test("empty intent does not throw and yields a placeholder title", () => {
  const out = plannerDecomposeHeuristic({ intent_draft: "" })
  expect(out.tasks[0]!.title.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/planner-decompose.test.ts`
Expected: FAIL — module `planner-decompose` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/dispatcher/agents/planner-decompose.ts`:

```ts
// planner.decompose — file-level task decomposition with bite-sized TDD steps
// (Phase 2b). Mirrors the planner.adversarial pattern: a pure *Heuristic
// fallback + a backward-compat alias; the LLM path is routed by spawn.ts from
// the manifest prompt_path (prompts/planner-decompose.md).
//
// CE reuse-in: prior failure-modes / preventions become `guard` steps, and
// researcher.history prior_art solution_refs flow into each task's
// prior_art_refs (consumed by plan.ts for surfaced_in/applied_in writeback).
// The agent receives all prior data as INPUT — it holds no read:solutions in
// scope_tokens (Invariant §1, same relaxation as planner.adversarial / CE-1).

import type { PlanStep } from "../types"

export interface DecomposeInput {
  intent_draft: string
  structural_risks?: { area: string; risk: string; mitigation: string }[]
  prior_art?: { solution_ref: string; relevance_score: number; excerpt: string }[]
  failure_modes?: {
    scenario: string
    probability: string
    impact: string
    early_signal: string
  }[]
  prior_preventions?: {
    solution_ref: string
    category: string
    prevention_text: string
  }[]
}

export interface DecomposeTask {
  id: string
  title: string
  files: { create: string[]; modify: string[]; test: string[] }
  steps: PlanStep[]
  prior_art_refs: string[]
}

export interface DecomposeOutput {
  tasks: DecomposeTask[]
}

/**
 * Heuristic fallback — used when no LLM is available (tests, SGC_FORCE_INLINE).
 * Produces ONE coarse task: the canonical 5-step TDD cycle, with a `guard` step
 * inserted before commit for each known failure-mode / prevention, and
 * prior_art_refs carried from prior_art. Intentionally trivial; the real
 * file-level depth lives in the LLM path (prompts/planner-decompose.md).
 */
export function plannerDecomposeHeuristic(input: DecomposeInput): DecomposeOutput {
  const title = (input.intent_draft ?? "").trim().slice(0, 200) || "implement the task"

  const steps: PlanStep[] = [
    { kind: "test", text: `Write a failing test for: ${title}` },
    { kind: "verify-red", text: "Run the test and confirm it fails", run: "bun test", expect: "FAIL" },
    { kind: "implement", text: "Write the minimal implementation to make the test pass" },
    { kind: "verify-green", text: "Run the test and confirm it passes", run: "bun test", expect: "PASS" },
  ]

  // reuse-in: prior failure-modes → guard steps (defensive checks).
  for (const fm of input.failure_modes ?? []) {
    steps.push({
      kind: "guard",
      text: `Guard against prior failure mode: ${fm.scenario}. Early signal: ${fm.early_signal}`,
    })
  }
  // reuse-in: prior preventions → guard steps (avoid the known-bad shape).
  for (const p of input.prior_preventions ?? []) {
    steps.push({
      kind: "guard",
      text: `Apply prevention from ${p.solution_ref}: ${p.prevention_text}`,
    })
  }

  steps.push({ kind: "commit", text: "Commit the change", run: "git commit -m \"<conventional message>\"" })

  const prior_art_refs = (input.prior_art ?? []).map((p) => p.solution_ref)

  return {
    tasks: [{ id: "f1", title, files: { create: [], modify: [], test: [] }, steps, prior_art_refs }],
  }
}

/** Backward-compat alias (matches plannerAdversarial / plannerEng convention). */
export const plannerDecompose = plannerDecomposeHeuristic
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/planner-decompose.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/agents/planner-decompose.ts tests/dispatcher/planner-decompose.test.ts
git commit -m "feat(agent): add planner.decompose heuristic with CE reuse-in"
```

---

## Task 3: Manifest + prompt + bundle wiring (doctor-green)

**Files:**
- Create: `prompts/planner-decompose.md`
- Modify: `contracts/sgc-capabilities.yaml` (add block after `planner.adversarial`, ~line 300)
- Modify: `src/dispatcher/embedded-data.ts:28` (import) and the `EMBEDDED_PROMPTS` map
- Test: `tests/dispatcher/doctor.test.ts` (or run `sgc doctor` — see Step 2)

- [ ] **Step 1: Write the failing test**

Append to `tests/dispatcher/embedded-data.test.ts`:

```ts
import { test, expect } from "bun:test"
import { EMBEDDED_PROMPTS } from "../../src/dispatcher/embedded-data"

test("planner-decompose prompt is embedded in the bundle", () => {
  expect(EMBEDDED_PROMPTS["prompts/planner-decompose.md"]).toBeDefined()
  expect(EMBEDDED_PROMPTS["prompts/planner-decompose.md"]!.length).toBeGreaterThan(100)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/embedded-data.test.ts -t "planner-decompose prompt"`
Expected: FAIL — `EMBEDDED_PROMPTS["prompts/planner-decompose.md"]` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

Create `prompts/planner-decompose.md`:

```markdown
# planner.decompose

You decompose an approved engineering intent into a **file-level task list with
bite-sized TDD steps**. You write the plan an engineer with zero context for
this codebase would need: exact files, complete steps, real commands. NO
placeholders ("TBD", "handle edge cases", "add validation" are failures).

## Inputs

- `intent_draft` — the approved task description.
- `structural_risks` — areas the eng reviewer flagged (area / risk / mitigation).
- `prior_art` — prior solutions surfaced from the knowledge corpus
  (`solution_ref` / `relevance_score` / `excerpt`). REUSE these: when a task
  reuses a prior solution, list its `solution_ref` in that task's
  `prior_art_refs`.
- `failure_modes` — pre-mortem scenarios (scenario / probability / impact /
  early_signal). For each, emit a `guard` step (a defensive test or check) in
  the task most likely to trigger it.
- `prior_preventions` — known failure shapes to avoid; emit a `guard` step
  citing the `solution_ref`.

## Output (JSON)

```json
{
  "tasks": [
    {
      "id": "f1",
      "title": "<imperative task title>",
      "files": { "create": ["path"], "modify": ["path"], "test": ["path"] },
      "steps": [
        { "kind": "test", "text": "Write the failing test: ..." },
        { "kind": "verify-red", "text": "Run it", "run": "<cmd>", "expect": "FAIL ..." },
        { "kind": "implement", "text": "..." },
        { "kind": "verify-green", "text": "Run it", "run": "<cmd>", "expect": "PASS" },
        { "kind": "guard", "text": "Guard against <failure_mode>: ..." },
        { "kind": "commit", "text": "Commit", "run": "git commit -m \"...\"" }
      ],
      "prior_art_refs": ["<solution_ref reused by this task>"]
    }
  ]
}
```

## Rules

- `kind` ∈ `test | verify-red | implement | verify-green | commit | guard`.
- Each task is self-contained and independently testable. Split by
  responsibility, not by technical layer. Smallest diff that works.
- Every `verify-*` / `commit` step has a real `run` command.
- Do NOT invent file paths you cannot justify from the intent. If unsure of an
  exact path, describe the file's responsibility in `text` and leave `files`
  arrays conservative.
- Banned vocabulary: no "robust", "comprehensive", "significantly",
  "should work", or baseline-less ratios.
```

In `src/dispatcher/embedded-data.ts`, after line 28 (`import plannerAdversarial ...`) add:

```ts
import plannerDecompose from "../../prompts/planner-decompose.md" with { type: "text" }
```

Then in the `EMBEDDED_PROMPTS` object (near the `"prompts/planner-adversarial.md":` entry) add:

```ts
  "prompts/planner-decompose.md": plannerDecompose,
```

In `contracts/sgc-capabilities.yaml`, after the `planner.adversarial` block (ends ~line 300 with `timeout_s: 180`) add:

```yaml
  planner.decompose:
    version: "0.1"
    source: sp:writing-plans pattern (re-authored natively, Phase 2b; not vendored)
    purpose: >
      Decompose an approved intent into file-level tasks with bite-sized TDD
      steps. CE reuse-in: prior failure-modes/preventions become guard steps;
      prior_art solution_refs flow into per-task prior_art_refs.
    prompt_path: prompts/planner-decompose.md
    inputs:
      intent_draft: markdown
      # Prior data crosses as INPUT only — the agent holds no read:solutions
      # (Invariant §1, same relaxation as planner.adversarial / CE-1).
      structural_risks: array[{area, risk, mitigation}]
      prior_art: array[{solution_ref, relevance_score, excerpt}]
      failure_modes: array[{scenario, probability, impact, early_signal}]
      prior_preventions: array[{solution_ref, category, prevention_text}]
    outputs:
      tasks: array[{id, title, files, steps, prior_art_refs}]
    scope_tokens: ["read:decisions:*", "read:progress", "exec:git:read"]
    token_budget: 8000
    timeout_s: 240
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/embedded-data.test.ts -t "planner-decompose prompt"`
Expected: PASS.

Then verify doctor parity (the manifest↔prompt↔bundle gate):
Run: `SGC_FORCE_INLINE=1 bun src/sgc.ts doctor`
Expected: `=== Manifest prompt_path ↔ prompts/ ===` lists `prompts/planner-decompose.md` as present; overall `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add prompts/planner-decompose.md contracts/sgc-capabilities.yaml src/dispatcher/embedded-data.ts tests/dispatcher/embedded-data.test.ts
git commit -m "feat(manifest): wire planner.decompose prompt + scope tokens"
```

---

## Task 4: `renderPlanMarkdown` (sp-style derived doc, no drift)

**Files:**
- Create: `src/dispatcher/plan-render.ts`
- Test: `tests/dispatcher/plan-render.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/dispatcher/plan-render.test.ts`:

```ts
import { test, expect } from "bun:test"
import { renderPlanMarkdown } from "../../src/dispatcher/plan-render"
import type { FeatureList } from "../../src/dispatcher/types"

const LIST: FeatureList = {
  features: [
    {
      id: "f1",
      title: "add cursor pagination",
      status: "pending",
      files: { create: ["src/page.ts"], modify: ["src/api.ts"], test: ["tests/page.test.ts"] },
      steps: [
        { kind: "test", text: "write failing test" },
        { kind: "verify-red", text: "run it", run: "bun test", expect: "FAIL" },
        { kind: "guard", text: "guard against off-by-one" },
        { kind: "commit", text: "commit", run: "git commit" },
      ],
      prior_art_refs: ["perf/pagination-cursor"],
    },
    { id: "f2", title: "wire the endpoint", status: "pending", steps: [{ kind: "implement", text: "wire it" }] },
  ],
}

test("renders the sp-style header + one Task block per feature", () => {
  const md = renderPlanMarkdown(LIST, { title: "Pagination", level: "L2" })
  expect(md).toContain("# Pagination Implementation Plan")
  expect(md).toContain("REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development")
  expect(md).toContain("### Task 1: add cursor pagination")
  expect(md).toContain("### Task 2: wire the endpoint")
})

test("no-drift: every task title, file path, and step text from the SoT appears in the render", () => {
  const md = renderPlanMarkdown(LIST, { title: "Pagination", level: "L2" })
  for (const f of LIST.features) {
    expect(md).toContain(f.title)
    for (const p of [...(f.files?.create ?? []), ...(f.files?.modify ?? []), ...(f.files?.test ?? [])]) {
      expect(md).toContain(p)
    }
    for (const s of f.steps ?? []) expect(md).toContain(s.text)
  }
  // prior art + run command + expected surfaced
  expect(md).toContain("perf/pagination-cursor")
  expect(md).toContain("bun test")
  expect(md).toContain("FAIL")
})

test("checkbox + kind label per step", () => {
  const md = renderPlanMarkdown(LIST, { title: "P", level: "L2" })
  expect(md).toMatch(/- \[ \] \*\*Step 1 \(test\):\*\* write failing test/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/plan-render.test.ts`
Expected: FAIL — module `plan-render` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/dispatcher/plan-render.ts`:

```ts
// Pure renderer: feature-list (single source of truth) → sp:writing-plans-style
// markdown. Phase 2b "double-write, no drift" — the markdown is always derived
// from feature-list.md, never hand-maintained.

import type { FeatureList } from "./types"

export function renderPlanMarkdown(
  list: FeatureList,
  intent: { title: string; level: string },
): string {
  const out: string[] = []
  out.push(`# ${intent.title} Implementation Plan`)
  out.push("")
  out.push(
    "> **For agentic workers:** REQUIRED SUB-SKILL: Use " +
      "superpowers:subagent-driven-development (recommended) or " +
      "superpowers:executing-plans to implement this plan task-by-task. " +
      "Steps use checkbox (`- [ ]`) syntax for tracking.",
  )
  out.push("")
  out.push(`**Level:** ${intent.level}`)
  out.push("")
  out.push("---")
  out.push("")

  let taskNo = 1
  for (const f of list.features) {
    out.push(`### Task ${taskNo}: ${f.title}`)
    out.push("")
    if (f.files) {
      out.push("**Files:**")
      for (const p of f.files.create) out.push(`- Create: \`${p}\``)
      for (const p of f.files.modify) out.push(`- Modify: \`${p}\``)
      for (const p of f.files.test) out.push(`- Test: \`${p}\``)
      out.push("")
    }
    if (f.prior_art_refs && f.prior_art_refs.length > 0) {
      out.push(`**Prior art (reused):** ${f.prior_art_refs.map((r) => `\`${r}\``).join(", ")}`)
      out.push("")
    }
    let stepNo = 1
    for (const s of f.steps ?? []) {
      out.push(`- [ ] **Step ${stepNo} (${s.kind}):** ${s.text}`)
      if (s.run) out.push(`  - Run: \`${s.run}\``)
      if (s.expect) out.push(`  - Expected: ${s.expect}`)
      stepNo++
    }
    out.push("")
    taskNo++
  }
  return out.join("\n")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/plan-render.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/plan-render.ts tests/dispatcher/plan-render.test.ts
git commit -m "feat(plan): add renderPlanMarkdown (derived sp-style doc)"
```

---

## Task 5: `writePlanDoc` I/O helper

**Files:**
- Modify: `src/dispatcher/state.ts` (add `writePlanDoc` near `writeFeatureList` ~line 386)
- Test: `tests/dispatcher/state.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/dispatcher/state.test.ts`:

```ts
import { existsSync, readFileSync as rf } from "node:fs"
import { writePlanDoc } from "../../src/dispatcher/state"

test("writePlanDoc writes under docs/superpowers/plans relative to base", () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plandoc-"))
  const p = writePlanDoc("native-deep-planning", "2026-06-03", "# Plan\n", root)
  expect(p).toContain("docs/superpowers/plans/2026-06-03-native-deep-planning.md")
  expect(existsSync(p)).toBe(true)
  expect(rf(p, "utf8")).toBe("# Plan\n")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/state.test.ts -t "writePlanDoc"`
Expected: FAIL — `writePlanDoc` is not exported from state.

- [ ] **Step 3: Write minimal implementation**

In `src/dispatcher/state.ts`, near `writeFeatureList` add (use the existing `mkdirSync`/`writeAtomic` imports already in the file; if `mkdirSync` is not imported, add it to the `node:fs` import):

```ts
/**
 * Write a derived sp-style plan markdown doc (Phase 2b). Path:
 * <base>/docs/superpowers/plans/<date>-<slug>.md. `base` defaults to cwd;
 * tests pass a tmp dir. The content is produced by renderPlanMarkdown — this
 * is a thin I/O wrapper only (the markdown is never hand-edited).
 */
export function writePlanDoc(
  slug: string,
  dateIso: string,
  content: string,
  base?: string,
): string {
  const dir = join(base ?? process.cwd(), "docs", "superpowers", "plans")
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${dateIso}-${slug}.md`)
  writeAtomic(path, content)
  return path
}
```

Confirm the imports at the top of `state.ts` include `join` (from `node:path`) and `mkdirSync` (from `node:fs`). If `mkdirSync` is missing, add it.

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/state.test.ts -t "writePlanDoc"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/state.ts tests/dispatcher/state.test.ts
git commit -m "feat(state): add writePlanDoc for derived plan markdown"
```

---

## Task 6: Wire `--deep` into `plan.ts`

**Files:**
- Modify: `src/commands/plan.ts` (add `deep` to `PlanOptions`; spawn decompose after fusion; map tasks→features; write markdown)
- Test: `tests/dispatcher/plan-deep.test.ts`

This is the integration task. The decompose spawn runs **after** the planner cluster `Promise.all` and `fusePlan` (it consumes their outputs), and **before** the `writeFeatureList` call (line ~717), replacing the single-placeholder feature write when deep is active.

- [ ] **Step 1: Write the failing test**

Create `tests/dispatcher/plan-deep.test.ts`:

```ts
import { test, expect } from "bun:test"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { readFeatureList } from "../../src/dispatcher/state"

const MOTIV = "we need cursor pagination on the orders endpoint because offset paging is slow at scale and clients time out on large pages"

test("L2 auto-decomposes into a feature with bite-sized steps", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plan-deep-"))
  process.env["SGC_FORCE_INLINE"] = "1"
  await runPlan("add cursor pagination to GET /orders", {
    stateRoot: root,
    forceLevel: "L2",
    motivation: MOTIV,
  })
  const fl = readFeatureList(root)!
  const f = fl.list.features[0]!
  expect(f.steps).toBeDefined()
  expect(f.steps!.map((s) => s.kind)).toContain("verify-red")
  expect(f.files).toBeDefined()
})

test("L1 default keeps the single placeholder (no decomposition)", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plan-l1-"))
  process.env["SGC_FORCE_INLINE"] = "1"
  await runPlan("fix a typo in the readme heading text now", {
    stateRoot: root,
    forceLevel: "L1",
    motivation: MOTIV,
  })
  const fl = readFeatureList(root)!
  expect(fl.list.features[0]!.steps).toBeUndefined()
})

test("L1 --deep decomposes", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plan-l1-deep-"))
  process.env["SGC_FORCE_INLINE"] = "1"
  await runPlan("refactor the date utils into a module", {
    stateRoot: root,
    forceLevel: "L1",
    motivation: MOTIV,
    deep: true,
  })
  const fl = readFeatureList(root)!
  expect(fl.list.features[0]!.steps).toBeDefined()
})

test("deep plan writes a derived markdown doc", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plan-md-"))
  process.env["SGC_FORCE_INLINE"] = "1"
  await runPlan("add cursor pagination to GET /orders", {
    stateRoot: root,
    forceLevel: "L2",
    motivation: MOTIV,
  })
  // plan.ts writes under <stateRoot>/docs/superpowers/plans in tests
  const dir = join(root, "docs", "superpowers", "plans")
  const { readdirSync } = await import("node:fs")
  const files = readdirSync(dir)
  expect(files.length).toBe(1)
  expect(readFileSync(join(dir, files[0]!), "utf8")).toContain("Implementation Plan")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/plan-deep.test.ts`
Expected: FAIL — `deep` not on `PlanOptions` / features have no `steps` / no markdown dir.

- [ ] **Step 3: Write minimal implementation**

In `src/commands/plan.ts`:

(a) Add to `PlanOptions` (after `async?` ~line 92):

```ts
  /**
   * Phase 2b: deep decomposition. Implied at L2/L3; opt-in at L1 via --deep.
   * When active, planner.decompose authors file-level tasks + bite-sized steps
   * into feature-list.md (replacing the single placeholder) and a derived
   * sp-style markdown doc is written.
   */
  deep?: boolean
```

(b) Add the import near the other agent imports (after the planner-adversarial import ~line 42):

```ts
import {
  plannerDecompose,
  type DecomposeInput,
  type DecomposeOutput,
} from "../dispatcher/agents/planner-decompose"
import { renderPlanMarkdown } from "../dispatcher/plan-render"
import { writePlanDoc } from "../dispatcher/state"
```

(Note: `writePlanDoc` joins the existing `state` import block — fold it into the
existing `from "../dispatcher/state"` import rather than adding a duplicate line.)

(c) After `fusePlan` (the block ending ~line 607 with `const fusedVerdict = ...`) and before the `if (level === "L3")` summary block, compute the deep decomposition. Add:

```ts
  // Phase 2b: deep decomposition. Active at L2/L3 automatically; at L1 only
  // with --deep; never at L0 (no intent). Runs serially after fusion because
  // it consumes the cluster outputs (eng risks + prior_art + failure_modes).
  const deepActive =
    level !== "L0" && (LEVEL_RANK[level] >= 2 || (level === "L1" && opts.deep === true))
  let decomposed: DecomposeOutput | null = null
  if (deepActive) {
    const decomposeInput: DecomposeInput = {
      intent_draft: taskDescription,
      ...(plannerEngOut ? { structural_risks: plannerEngOut.structural_risks } : {}),
      ...(researcherOut ? { prior_art: researcherOut.prior_art } : {}),
      ...(adversarialOut ? { failure_modes: adversarialOut.failure_modes } : {}),
      ...(capturedPriorPreventions.length > 0
        ? { prior_preventions: capturedPriorPreventions }
        : {}),
    }
    const decRes = await spawn<unknown, DecomposeOutput>(
      "planner.decompose",
      decomposeInput,
      {
        stateRoot,
        inlineStub: (i) => plannerDecompose(i as DecomposeInput),
        logger,
        taskId,
      },
    )
    decomposed = decRes.output
    log(`planner.decompose: ${decomposed.tasks.length} task(s)`)
  }
```

(d) Replace the single-placeholder `writeFeatureList` call (the block at lines ~717-730) with a conditional that uses the decomposition when present:

```ts
  // Step 5: write feature-list. Deep path → one feature per decomposed task;
  // otherwise the single-placeholder MVP shape (unchanged). Build the
  // features array ONCE (single source of truth) and reuse it for both the
  // feature-list write and the derived markdown render.
  if (decomposed && decomposed.tasks.length > 0) {
    const features = decomposed.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: "pending" as const,
      files: t.files,
      steps: t.steps,
      ...(t.prior_art_refs.length > 0 ? { prior_art_refs: t.prior_art_refs } : {}),
    }))
    writeFeatureList(
      { features },
      "Authored by `sgc plan` deep decomposition. Each task carries file-level scope + bite-sized TDD steps.\n",
      stateRoot,
    )
    // Derived sp-style markdown doc (single source of truth = the same features).
    const slug =
      taskDescription
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "plan"
    const dateIso = createdAt.slice(0, 10)
    const md = renderPlanMarkdown({ features }, { title: taskDescription.slice(0, 120), level })
    const docPath = writePlanDoc(slug, dateIso, md, stateRoot)
    log(`wrote plan doc ${docPath}`)
  } else {
    writeFeatureList(
      {
        features: [
          {
            id: "f1",
            title: taskDescription.slice(0, 200),
            status: "pending",
          },
        ],
      },
      "Refine this list during `sgc work`. The dispatcher does not infer fine-grained features in MVP.\n",
      stateRoot,
    )
  }
```

Note the `writePlanDoc` `base` argument is `stateRoot` so tests write under the
tmp dir; in production `stateRoot` is undefined → `writePlanDoc` falls back to
`process.cwd()` → `docs/superpowers/plans/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/plan-deep.test.ts`
Expected: PASS (4 tests).

Then confirm no regression in the existing plan tests:
Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/plan.test.ts`
Expected: PASS (existing count unchanged).

- [ ] **Step 5: Add the prior-art reuse-in integration assertion (acceptance #3)**

In a fresh tmp `stateRoot` `preFilterSolutions` returns `[]` (empty corpus →
empty `prior_art` → no `prior_art_refs`), so the end-to-end reuse-in path needs
a seeded solution fixture. Locate the existing seeding helper:
`grep -rln "writeSolution\|solutions/\|preFilterSolutions" tests/dispatcher` —
`tests/dispatcher/ce-loop-e2e.test.ts` already seeds `solutions/` and drives
`runPlan` to exercise researcher.history → `recordSurfaced` writeback. Mirror
that seeding, then append to `tests/dispatcher/plan-deep.test.ts` a test that:
seeds one solution whose tags/signature keyword-match the intent, runs
`runPlan(..., { forceLevel: "L2" })`, and asserts the resulting feature carries
a non-empty `prior_art_refs` (the new 2b surface) AND a `plan.surfaced_recorded`
event was logged (the pre-existing writeback). Use the same logger-capture
pattern the e2e test uses. This closes acceptance #3 at the integration level;
Task 2's unit test already covers the pure mapping.

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/plan-deep.test.ts`
Expected: PASS including the seeded-solution reuse-in test.

- [ ] **Step 6: Commit**

```bash
git add src/commands/plan.ts tests/dispatcher/plan-deep.test.ts
git commit -m "feat(plan): wire planner.decompose + derived markdown under --deep/L2/L3"
```

---

## Task 7: CLI `--deep` flag

**Files:**
- Modify: `src/sgc.ts` (the `plan` subcommand arg parsing)
- Test: `tests/dispatcher/cli-plan-flag.test.ts`

- [ ] **Step 1: Write the failing test**

First locate the plan flag parsing: `grep -n "force-new-task\|--auto\|signed-by\|args\[" src/sgc.ts | head`. The `--deep` flag is parsed the same way as the existing boolean `--auto` / `--force-new-task`. Create `tests/dispatcher/cli-plan-flag.test.ts`:

```ts
import { test, expect } from "bun:test"
import { parsePlanFlags } from "../../src/sgc"

test("--deep parses to deep:true", () => {
  const opts = parsePlanFlags(["plan", "do a thing", "--deep"])
  expect(opts.deep).toBe(true)
})

test("absent --deep leaves deep undefined", () => {
  const opts = parsePlanFlags(["plan", "do a thing"])
  expect(opts.deep).toBeUndefined()
})
```

If `src/sgc.ts` parses flags inline (not via an exported helper), refactor the
plan flag parsing into an exported `parsePlanFlags(argv: string[]): PlanOptions`
function and call it from the handler — this is the testable seam. If a
suitable exported parser already exists, target that instead and adjust the
import.

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/cli-plan-flag.test.ts`
Expected: FAIL — `parsePlanFlags` not exported / `deep` not handled.

- [ ] **Step 3: Write minimal implementation**

In `src/sgc.ts`, in the plan flag-parsing path, add a boolean flag handler mirroring `--auto`:

```ts
    } else if (arg === "--deep") {
      opts.deep = true
```

If extracting `parsePlanFlags`, move the existing per-flag `if/else` chain into
the exported function returning the accumulated `PlanOptions`, and have the
`plan` command handler call it. Update `--help` text for `plan` to list
`--deep   force deep decomposition at L1 (implied at L2/L3)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/cli-plan-flag.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sgc.ts tests/dispatcher/cli-plan-flag.test.ts
git commit -m "feat(cli): add sgc plan --deep flag"
```

---

## Task 8: `sgc work` light read adaptation

**Files:**
- Modify: `src/commands/work.ts:56-74` (`nextActiveId` depends_on; `printList` files/steps)
- Test: `tests/dispatcher/work.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/dispatcher/work.test.ts` (match the existing setup helpers in that file for `stateRoot` + writing a feature-list; the assertions below capture `log` output via the `log` option):

```ts
test("printList shows file + step counts for decomposed tasks", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-work-deep-"))
  ensureSgcStructure(root)
  writeCurrentTask({ task_id: "T1", level: "L2", active_feature: "f1", session_start: "x", last_activity: "x" }, "", root)
  writeFeatureList(
    {
      features: [
        {
          id: "f1",
          title: "add pagination",
          status: "pending",
          files: { create: ["a.ts"], modify: ["b.ts"], test: ["c.test.ts"] },
          steps: [{ kind: "test", text: "t" }, { kind: "commit", text: "c" }],
        },
      ],
    },
    "",
    root,
  )
  const lines: string[] = []
  await runWork({ stateRoot: root, log: (m) => lines.push(m) })
  const joined = lines.join("\n")
  expect(joined).toContain("f1: add pagination")
  expect(joined).toMatch(/3 files?/)
  expect(joined).toMatch(/2 steps?/)
})

test("nextActiveId skips a feature whose depends_on is unmet", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-work-dep-"))
  ensureSgcStructure(root)
  writeCurrentTask({ task_id: "T2", level: "L2", active_feature: "f1", session_start: "x", last_activity: "x" }, "", root)
  writeFeatureList(
    {
      features: [
        { id: "f1", title: "first", status: "pending" },
        { id: "f2", title: "second", status: "pending", depends_on: ["f1"] },
      ],
    },
    "",
    root,
  )
  const lines: string[] = []
  await runWork({ stateRoot: root, log: (m) => lines.push(m) })
  // f1 (no unmet deps) is active, not f2
  expect(lines.join("\n")).toContain("[>] f1")
})
```

(Ensure the imports at the top of `work.test.ts` include `ensureSgcStructure`,
`writeCurrentTask`, `writeFeatureList` from `state` and `runWork` from the
command — add any missing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/work.test.ts -t "printList shows file"`
Expected: FAIL — no file/step counts in output.

- [ ] **Step 3: Write minimal implementation**

In `src/commands/work.ts`, update `printList` (lines 64-74):

```ts
function printList(log: (m: string) => void, list: FeatureList, activeId: string | null): void {
  if (list.features.length === 0) {
    log("(feature list is empty — use `sgc work --add \"<title>\"` to add one)")
    return
  }
  for (const f of list.features) {
    const marker = f.status === "done" ? "[x]" : f.id === activeId ? "[>]" : "[ ]"
    const status = f.status === "done" ? "" : ` (${f.status})`
    let meta = ""
    if (f.files) {
      const n = f.files.create.length + f.files.modify.length + f.files.test.length
      meta += ` — ${n} file${n === 1 ? "" : "s"}`
    }
    if (f.steps && f.steps.length > 0) {
      meta += `${f.files ? "," : " —"} ${f.steps.length} step${f.steps.length === 1 ? "" : "s"}`
    }
    log(`  ${marker} ${f.id}: ${f.title}${status}${meta}`)
  }
}
```

Update `nextActiveId` (lines 56-62) to honor `depends_on`:

```ts
function nextActiveId(list: FeatureList): string | null {
  const done = new Set(list.features.filter((f) => f.status === "done").map((f) => f.id))
  const depsMet = (f: { depends_on?: string[] }) => (f.depends_on ?? []).every((d) => done.has(d))
  const inProgress = list.features.find((f) => f.status === "in_progress" && depsMet(f))
  if (inProgress) return inProgress.id
  const pending = list.features.find((f) => f.status === "pending" && depsMet(f))
  return pending ? pending.id : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/work.test.ts`
Expected: PASS (new tests + existing unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/commands/work.ts tests/dispatcher/work.test.ts
git commit -m "feat(work): surface files/steps + honor depends_on ordering"
```

---

## Task 9: POSITIONING update, full-suite green, bundle rebuild

**Files:**
- Modify: `docs/POSITIONING.md:33` (the "Deep plan authoring" row)
- Modify: `package.json` + `plugins/sgc/.claude-plugin/plugin.json` (version bump, lockstep)
- Modify: `CHANGELOG.md`
- Rebuild: `plugins/sgc/bin/sgc.mjs`

- [ ] **Step 1: Update POSITIONING + the interop intro**

In `docs/POSITIONING.md`, change the row (line 33):

```
| Deep plan authoring | native (`sgc plan` L2/L3 + `--deep`: file-level tasks + bite-sized TDD steps, CE reuse-in) | `sp:writing-plans` (optional richer path) |
```

And in the "Optional interop" intro paragraph (line 21), update the honest-gap
sentence: remove "deep plan authoring" from the remaining-native-gaps list
(leave "running the full TDD loop" as the remaining gap).

- [ ] **Step 2: Run the FULL test suite across both lanes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher tests/eval`
Expected: PASS — dispatcher count = prior 1063 + new tests; 0 fail. (The
`*-llm.test.ts` files may be flaky locally without API keys — confirm they are
the only failures and that they pass in CI eval lane, per
`feedback_sgc_test_lane_divergence`.)

Then grep both lanes for callers of the functions this plan changed, to catch
test-lane divergence before push:
Run: `grep -rn "runPlan(\|runWork(\|writeFeatureList(" tests/dispatcher tests/eval`
Expected: review each caller still compiles against the new optional fields
(all additions are optional → existing callers unaffected).

- [ ] **Step 3: Typecheck + doctor**

Run: `bunx tsc --noEmit`
Expected: 0 errors.
Run: `SGC_FORCE_INLINE=1 bun src/sgc.ts doctor`
Expected: 0 fail (manifest↔prompt↔bundle parity green, including the new agent).

- [ ] **Step 4: Bump version + CHANGELOG, rebuild bundle**

Bump `package.json` `version` and `plugins/sgc/.claude-plugin/plugin.json`
`version` in lockstep (e.g. `1.26.0`). Add a CHANGELOG entry under a new
`## [1.26.0]` heading describing the native deep-planning capability.

Run: `npm run build:cli`
Then stage the rebuilt bundle with the exec bit (per
`feedback_committed_build_artifact_exec_bit`):

```bash
git add --chmod=+x plugins/sgc/bin/sgc.mjs
```

Verify parity locally:
Run: `git diff --stat -- plugins/sgc/bin/sgc.mjs` (expect it changed)
Run: `SGC_FORCE_INLINE=1 bun src/sgc.ts doctor` (expect bundle parity ✓)

- [ ] **Step 5: Commit**

```bash
git add docs/POSITIONING.md package.json plugins/sgc/.claude-plugin/plugin.json CHANGELOG.md plugins/sgc/bin/sgc.mjs
git commit -m "feat: native deep planning (Phase 2b) — POSITIONING + v1.26.0 bundle"
```

(Release/tag is a separate operator step via the `ship` workflow — NOT part of
this implementation plan. See `docs/ROADMAP.md` release reminders +
`feedback_npm_publish_provenance_403_false_negative`.)

---

## Notes & known degradations (carry into review)

- **L1 `--deep` has thinner reuse-in:** the L1 plan path runs only
  `planner.eng` (no researcher/ceo/adversarial), so at L1 `--deep` the
  decompose input has `structural_risks` but empty `prior_art` / `failure_modes`
  → file-level decomposition still happens, but the prior-art reuse signal is
  exercised at L2/L3. This is intentional scope containment (per spec
  Non-goals); a future change could pre-fetch researcher.history at L1 `--deep`.
- **Heuristic depth:** the inline heuristic emits ONE coarse task. Multi-task
  file-level decomposition is the LLM path's job (`prompts/planner-decompose.md`).
  Tests assert structure + reuse-in mapping, not LLM decomposition quality
  (validated in the eval lane, like the other agents).
- **CE capture-out deferred** (spec Non-goals) — no `writeSolution` from this
  path; Invariant §3 untouched.
```
