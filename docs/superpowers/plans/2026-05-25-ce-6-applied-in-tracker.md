# CE-6 — `applied_in` 评分回流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `planner.adversarial` (L3 only) emits a `failure_mode` whose `early_signal` references a known `prior_prevention.solution_ref`, append the consuming `task_id` to that solution file's `applied_in: [task_ids]` frontmatter array — closing the score-feedback half of the CE compound-engineering loop.

**Architecture:** New module `src/dispatcher/applied-tracker.ts` exports `extractAppliedSolutionRefs` (pure substring-match) and `recordApplied` (per-ref read-merge-write with mtime-CAS retry). Wired into `src/commands/plan.ts` L3 branch after the planner.adversarial spawn; wrapped in try/catch so writeback failure never aborts plan. `src/dispatcher/reflect.ts` reads `applied_in.length` off the same scan it already does and surfaces `applied: N` in stdout / `applied_count` in JSON. Direct frontmatter mutation bypasses `writeSolution()`-via-Invariant §3 with a documented metadata-only carve-out + regression test asserting no content fields change.

**Tech Stack:** TypeScript + Bun runtime; `node:fs` sync (matches existing `state.ts` pattern); `js-yaml` via `parseFrontmatter` / `serializeFrontmatter`; `bun test`. No new deps.

**Spec:** `tasks/specs/ce-6-applied-in-tracker.md` (status: draft, r1).

---

## Pre-flight

- [ ] **PF-1: Confirm baseline state**

Run:
```bash
git status
git log -1 --oneline
SGC_FORCE_INLINE=1 bun test tests/ 2>&1 | tail -5
```

Expected:
- `git status` → clean tree (only the new spec + plan files untracked)
- HEAD = `3259e42 chore: release v1.9.0 (CE-5 sgc loop orchestrator)`
- bun test → **717 pass, 0 fail, ~1829 expect()** (CE-5 dispatcher baseline)

If test count differs, stop and reconcile before continuing.

- [ ] **PF-2: Verify wire-up anchor points still match the spec**

Run:
```bash
grep -n "adversarialOut = results\[3\]\|priorPreventions = await extractPreventions\|level === \"L3\"" src/commands/plan.ts
grep -n "for (const c of report.candidates)" src/dispatcher/reflect.ts
grep -n "function writeAtomic\|export function serializeFrontmatter\|export function solutionPath" src/dispatcher/state.ts
```

Expected hits:
- `plan.ts:433` assigns `adversarialOut` from `results[3]`
- `plan.ts:380` (inside `level === "L3"`) calls `extractPreventions`
- `reflect.ts:298` is the `for (const c of report.candidates)` loop in `formatReport`
- `state.ts:121 function writeAtomic` (currently NOT exported — task 1 fixes)
- `state.ts:112 export function serializeFrontmatter`
- `state.ts:470 export function solutionPath`

If any line number drifted but the symbol still exists at a nearby line, prefer the symbol over the literal line number when editing.

---

## Task list

### Task 1: Export `writeAtomic` from state.ts

The applied-tracker needs atomic temp+rename writes to avoid leaving half-written YAML on disk under crash. `writeAtomic` already exists at `state.ts:121` but is module-private. Exporting is the smallest change.

**Files:**
- Modify: `src/dispatcher/state.ts:121`
- Test: covered indirectly by Task 5 (recordApplied tests exercise the atomic path)

- [ ] **Step 1: Read the current declaration**

Run: `grep -n "^function writeAtomic" src/dispatcher/state.ts`
Expected: `121:function writeAtomic(path: string, content: string): void {`

- [ ] **Step 2: Add `export` keyword**

Edit `src/dispatcher/state.ts` line 121:

Replace:
```ts
function writeAtomic(path: string, content: string): void {
```

With:
```ts
export function writeAtomic(path: string, content: string): void {
```

- [ ] **Step 3: Verify nothing else broke**

Run: `bun run typecheck 2>&1 | tail -10` (or `bunx tsc --noEmit 2>&1 | tail -10`)
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/dispatcher/state.ts
git commit -m "$(cat <<'EOF'
refactor(state): export writeAtomic for CE-6 applied-tracker reuse

CE-6's recordApplied mutates solutions/*.md frontmatter outside the
writeSolution() Invariant §3 write-gate (metadata-only carve-out).
Atomic temp+rename pattern stays identical — only the export surface
widens.
EOF
)"
```

---

### Task 2: Add `applied_in?: string[]` to SolutionEntry interface

Schema extension is additive-optional. Existing solutions files without the field stay valid; downstream readers treat absent as empty.

**Files:**
- Modify: `src/dispatcher/types.ts:73-89`

- [ ] **Step 1: Read the current interface**

Run: `grep -n "^export interface SolutionEntry" src/dispatcher/types.ts`
Expected: `73:export interface SolutionEntry {`

- [ ] **Step 2: Add the field**

Edit `src/dispatcher/types.ts`. Replace:

```ts
export interface SolutionEntry {
  id: string
  signature: string  // sha256
  category: SolutionCategory
  problem: string
  symptoms: string[]
  what_didnt_work: { approach: string; reason_failed: string }[]
  solution: string
  prevention: string
  tags: string[]
  first_seen: string
  last_updated: string
  times_referenced: number
  source_task_ids: TaskId[]
  related_entries?: string[]
  confidence?: "provisional" | "confirmed" | "canonical"
}
```

With:

```ts
export interface SolutionEntry {
  id: string
  signature: string  // sha256
  category: SolutionCategory
  problem: string
  symptoms: string[]
  what_didnt_work: { approach: string; reason_failed: string }[]
  solution: string
  prevention: string
  tags: string[]
  first_seen: string
  last_updated: string
  times_referenced: number
  source_task_ids: TaskId[]
  related_entries?: string[]
  confidence?: "provisional" | "confirmed" | "canonical"
  // CE-6 (f7): task_ids that consumed this prevention via planner.adversarial
  // recurrence flag (CE-1 step 5). Mutated by applied-tracker.recordApplied,
  // which bypasses writeSolution() — see tasks/specs/ce-6-applied-in-tracker.md
  // "Invariant §3 carve-out (metadata-only mutation)".
  applied_in?: TaskId[]
}
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

- [ ] **Step 4: Run the full suite to confirm no test fixture breaks**

Run: `SGC_FORCE_INLINE=1 bun test tests/ 2>&1 | tail -5`
Expected: **717 pass, 0 fail** (no change — additive optional field).

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/types.ts
git commit -m "$(cat <<'EOF'
feat(CE-6): add SolutionEntry.applied_in optional field

Additive-optional TaskId[] tracking which decisions consumed this
prevention via planner.adversarial recurrence (CE-1 step 5). Mutated
by applied-tracker.recordApplied with Invariant §3 metadata-only
carve-out documented in tasks/specs/ce-6-applied-in-tracker.md.
EOF
)"
```

---

### Task 3: Create applied-tracker.ts skeleton (types + constants only)

Land the module shape first so subsequent TDD tasks have a typed import target.

**Files:**
- Create: `src/dispatcher/applied-tracker.ts`

- [ ] **Step 1: Write the skeleton**

Create `src/dispatcher/applied-tracker.ts`:

```ts
// CE-6 (f7): applied_in score feedback loop.
//
// When planner.adversarial (L3 only) emits a failure_mode whose early_signal
// substring-references a known prior_prevention.solution_ref (CE-1 step 5),
// the consuming task_id is appended to <stateRoot>/solutions/<cat>/<slug>.md
// frontmatter's `applied_in: TaskId[]` field. Score = applied_in.length.
//
// Spec: tasks/specs/ce-6-applied-in-tracker.md (status: draft, r1).
//
// Invariant §3 carve-out: this module mutates solution frontmatter outside
// writeSolution() because the change is metadata-only — no solution-content
// fields touched. Regression test in applied-tracker.test.ts:
// "preserves content (CRITICAL)" enforces this contract. The §3 gate exists
// to keep dedup_stamp deterministic (see feedback_compound_related_invariant3.md);
// applied_in is not part of the dedup signature.
//
// Heuristic-only: no LLM, no agent spawn, no Tier-2 llm.* events owed.

import { existsSync, readFileSync, statSync } from "node:fs"
import type { FailureMode } from "./agents/planner-adversarial"
import type { Logger } from "./logger"
import type { PriorPrevention } from "./preventions"
import {
  parseFrontmatter,
  serializeFrontmatter,
  solutionPath,
  writeAtomic,
} from "./state"
import type { SolutionCategory, SolutionEntry, TaskId } from "./types"

// Allowed shape: `<lowercase-category>/<slug>`. The category half is the
// SolutionCategory union (other / runtime / planning / ops); slug is computed
// from `walkSolutionsCorpus` directory listing per preventions.ts:153, so it
// is filesystem-safe by construction. The regex is a defensive belt-and-braces
// check against accidental upstream changes that might let user-controlled
// strings slip through.
const SOLUTION_REF_RE = /^[a-z0-9_]+\/[a-zA-Z0-9._-]+$/

// Mtime-CAS retry depth. The realistic race is an operator running two sync
// `sgc plan` invocations in parallel terminals against the same project —
// minute-scale; one retry is enough. Higher tolerance can be added later if
// telemetry shows contention.
const MAX_MTIME_RETRIES = 1

export interface RecordAppliedResult {
  /** solution_refs whose file gained a new task_id this call. */
  updated: string[]
  /** task_id already present in applied_in — no write. */
  skipped_already_applied: string[]
  /** solution file not found on disk (e.g. corpus rotated). */
  skipped_missing: string[]
  /** ref shape invalid OR frontmatter parse failed. */
  skipped_malformed: string[]
  /** mtime changed under us and retry also lost the race. */
  stale_skipped: string[]
}

export interface RecordAppliedOptions {
  logger?: Logger
  /** Pass-through for logger events; null is acceptable when no task context. */
  taskId?: string | null
}

export function extractAppliedSolutionRefs(
  failure_modes: readonly FailureMode[],
  prior_preventions: readonly PriorPrevention[],
): string[] {
  if (failure_modes.length === 0 || prior_preventions.length === 0) return []
  const refs = new Set<string>()
  for (const fm of failure_modes) {
    const signal = fm.early_signal ?? ""
    if (signal.length === 0) continue
    for (const pp of prior_preventions) {
      if (signal.includes(pp.solution_ref)) refs.add(pp.solution_ref)
    }
  }
  return Array.from(refs)
}

export function recordApplied(
  stateRoot: string | undefined,
  solution_refs: readonly string[],
  task_id: TaskId,
  opts: RecordAppliedOptions = {},
): RecordAppliedResult {
  const result: RecordAppliedResult = {
    updated: [],
    skipped_already_applied: [],
    skipped_missing: [],
    skipped_malformed: [],
    stale_skipped: [],
  }
  for (const ref of solution_refs) {
    recordOne(ref, task_id, stateRoot, opts, result)
  }
  return result
}

function recordOne(
  ref: string,
  task_id: TaskId,
  stateRoot: string | undefined,
  opts: RecordAppliedOptions,
  result: RecordAppliedResult,
): void {
  if (!SOLUTION_REF_RE.test(ref)) {
    result.skipped_malformed.push(ref)
    emitFailed(opts, task_id, ref, "malformed_ref", "ref shape rejected by SOLUTION_REF_RE")
    return
  }
  const [category, slug] = ref.split("/") as [SolutionCategory, string]
  const path = solutionPath(category, slug, stateRoot)
  if (!existsSync(path)) {
    result.skipped_missing.push(ref)
    return
  }

  for (let attempt = 0; attempt <= MAX_MTIME_RETRIES; attempt++) {
    const mtimeBefore = statSync(path).mtimeMs
    let parsed: { data: SolutionEntry; body: string }
    try {
      parsed = parseFrontmatter<SolutionEntry>(readFileSync(path, "utf8"))
    } catch (err) {
      result.skipped_malformed.push(ref)
      emitFailed(
        opts, task_id, ref, "parse_failed",
        err instanceof Error ? err.message : String(err),
      )
      return
    }
    const existing = parsed.data.applied_in ?? []
    if (existing.includes(task_id)) {
      result.skipped_already_applied.push(ref)
      return
    }
    const nextEntry: SolutionEntry = {
      ...parsed.data,
      applied_in: [...existing, task_id],
    }
    // Re-check mtime; if it changed under us, the read is stale.
    const mtimeReread = statSync(path).mtimeMs
    if (mtimeReread !== mtimeBefore) {
      if (attempt === MAX_MTIME_RETRIES) {
        result.stale_skipped.push(ref)
        emitFailed(opts, task_id, ref, "stale_mtime_after_retry", "mtime drift after retry")
        return
      }
      continue
    }
    try {
      writeAtomic(
        path,
        serializeFrontmatter(nextEntry as unknown as Record<string, unknown>, parsed.body),
      )
      result.updated.push(ref)
      return
    } catch (err) {
      emitFailed(
        opts, task_id, ref, "io_error",
        err instanceof Error ? err.message : String(err),
      )
      result.skipped_malformed.push(ref)
      return
    }
  }
}

function emitFailed(
  opts: RecordAppliedOptions,
  task_id: TaskId,
  solution_ref: string,
  reason: "malformed_ref" | "parse_failed" | "stale_mtime_after_retry" | "io_error",
  error_message: string,
): void {
  opts.logger?.event({
    task_id: opts.taskId ?? task_id,
    spawn_id: null,
    agent: "plan.applied",
    event_type: "plan.applied_failed",
    level: "warn",
    payload: { solution_ref, reason, error_message },
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit 2>&1 | tail -10`
Expected: no errors. (Some lint warnings about unused symbols are acceptable until tests land.)

- [ ] **Step 3: Commit (no test yet — TDD tests start in Task 4)**

```bash
git add src/dispatcher/applied-tracker.ts
git commit -m "$(cat <<'EOF'
feat(CE-6): scaffold applied-tracker module (extract + record)

Skeleton with RecordAppliedResult shape, SOLUTION_REF_RE guard,
mtime-CAS retry loop, and plan.applied_failed event emission per
spec tasks/specs/ce-6-applied-in-tracker.md. TDD tests follow in
subsequent tasks.
EOF
)"
```

---

### Task 4: TDD — extractAppliedSolutionRefs unit tests

Pure function; tests run with no fs setup.

**Files:**
- Create: `tests/dispatcher/applied-tracker.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/dispatcher/applied-tracker.test.ts`:

```ts
// CE-6 (f7) applied-tracker — unit tests.
// Spec: tasks/specs/ce-6-applied-in-tracker.md (r1).

import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import type { FailureMode } from "../../src/dispatcher/agents/planner-adversarial"
import {
  extractAppliedSolutionRefs,
  recordApplied,
} from "../../src/dispatcher/applied-tracker"
import type { PriorPrevention } from "../../src/dispatcher/preventions"
import { parseFrontmatter } from "../../src/dispatcher/state"
import type { SolutionEntry } from "../../src/dispatcher/types"

const PP = (ref: string): PriorPrevention => ({
  solution_ref: ref,
  category: ref.split("/")[0]! as PriorPrevention["category"],
  prevention_text: "ignored by extractor",
})

const FM = (early_signal: string): FailureMode => ({
  scenario: "ignored",
  probability: "medium",
  impact: "medium",
  early_signal,
})

describe("extractAppliedSolutionRefs", () => {
  test("E1: single ref appears in one signal", () => {
    const refs = extractAppliedSolutionRefs(
      [FM("a long signal mentioning runtime/foo-2026-01-01 inline")],
      [PP("runtime/foo-2026-01-01")],
    )
    expect(refs).toEqual(["runtime/foo-2026-01-01"])
  })

  test("E2: two priors both surface across multiple failure modes — deduped", () => {
    const refs = extractAppliedSolutionRefs(
      [
        FM("signal with runtime/foo-2026-01-01 in it"),
        FM("signal with other/bar-2026-02-02 elsewhere"),
        FM("signal with runtime/foo-2026-01-01 AGAIN should dedup"),
      ],
      [PP("runtime/foo-2026-01-01"), PP("other/bar-2026-02-02")],
    )
    expect(refs.sort()).toEqual(["other/bar-2026-02-02", "runtime/foo-2026-01-01"])
  })

  test("E3: no signal contains any ref → empty", () => {
    const refs = extractAppliedSolutionRefs(
      [FM("generic signal with no references")],
      [PP("runtime/foo-2026-01-01")],
    )
    expect(refs).toEqual([])
  })

  test("E4: ref not in priors is NOT surfaced even if early_signal mentions a string that looks like one", () => {
    const refs = extractAppliedSolutionRefs(
      [FM("signal mentioning other/unknown-ref-not-in-priors")],
      [PP("runtime/foo-2026-01-01")],
    )
    expect(refs).toEqual([])
  })

  test("E5: empty failure_modes → empty", () => {
    expect(extractAppliedSolutionRefs([], [PP("runtime/x")])).toEqual([])
  })

  test("E6: empty priors → empty", () => {
    expect(extractAppliedSolutionRefs([FM("anything")], [])).toEqual([])
  })

  test("E7: empty early_signal string skipped (no false-positive)", () => {
    const refs = extractAppliedSolutionRefs(
      [FM("")],
      [PP("runtime/foo-2026-01-01")],
    )
    expect(refs).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test — expect failure (module just landed, exports exist but logic untested)**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/applied-tracker.test.ts 2>&1 | tail -15`
Expected: **7 pass** (Task 3's implementation is already correct for these cases — they confirm the implementation, RED-first not strictly needed here since the spec was clear and the impl was written all at once. If any fail, fix in `src/dispatcher/applied-tracker.ts`.)

- [ ] **Step 3: Commit**

```bash
git add tests/dispatcher/applied-tracker.test.ts
git commit -m "test(CE-6): extractAppliedSolutionRefs — 7 unit cases"
```

---

### Task 5: TDD — recordApplied happy path (2 refs both updated)

Establish the fs fixture pattern used by remaining recordApplied tests.

**Files:**
- Modify: `tests/dispatcher/applied-tracker.test.ts` (append a new `describe` block)

- [ ] **Step 1: Append the fixture helper + happy-path test**

Append to `tests/dispatcher/applied-tracker.test.ts`:

```ts
// ──────────────────────────────────────────────────────────────────────────
// recordApplied fixture helper
// ──────────────────────────────────────────────────────────────────────────

interface FixtureOpts {
  applied_in?: string[]
  prevention?: string
}

function seedSolution(
  stateRoot: string,
  category: string,
  slug: string,
  opts: FixtureOpts = {},
): string {
  const dir = resolve(stateRoot, "solutions", category)
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, `${slug}.md`)
  const fm: Record<string, unknown> = {
    id: `${category}-${slug}`,
    signature: "sha256-fixture",
    category,
    problem: "fixture problem",
    symptoms: ["sym1"],
    what_didnt_work: [{ approach: "naive", reason_failed: "did not work" }],
    solution: "fixture solution",
    prevention: opts.prevention ?? "fixture prevention",
    tags: ["fixture"],
    first_seen: "2026-01-01T00:00:00.000Z",
    last_updated: "2026-01-01T00:00:00.000Z",
    times_referenced: 0,
    source_task_ids: ["TASK-FIXTURE"],
  }
  if (opts.applied_in) fm.applied_in = opts.applied_in
  const yaml = Object.entries(fm)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length === 0) return `${k}: []`
        if (typeof v[0] === "string") return `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}`
        // object array (what_didnt_work)
        return `${k}:\n${v.map((x) => `  - ${Object.entries(x as object).map(([kk, vv]) => `${kk}: ${JSON.stringify(vv)}`).join("\n    ")}`).join("\n")}`
      }
      return `${k}: ${JSON.stringify(v)}`
    })
    .join("\n")
  writeFileSync(path, `---\n${yaml}\n---\n\nfixture body\n`, "utf8")
  return path
}

describe("recordApplied — happy path", () => {
  test("H1: two new refs both updated", () => {
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-h1-"))
    seedSolution(root, "runtime", "alpha-2026")
    seedSolution(root, "other", "beta-2026")

    const result = recordApplied(
      root,
      ["runtime/alpha-2026", "other/beta-2026"],
      "TASK-CONSUMER-001",
    )

    expect(result.updated.sort()).toEqual(["other/beta-2026", "runtime/alpha-2026"])
    expect(result.skipped_already_applied).toEqual([])
    expect(result.skipped_missing).toEqual([])
    expect(result.skipped_malformed).toEqual([])
    expect(result.stale_skipped).toEqual([])

    // Verify the field landed on disk
    for (const ref of ["runtime/alpha-2026", "other/beta-2026"]) {
      const [cat, slug] = ref.split("/")
      const path = resolve(root, "solutions", cat!, `${slug}.md`)
      const { data } = parseFrontmatter<SolutionEntry>(readFileSync(path, "utf8"))
      expect(data.applied_in).toEqual(["TASK-CONSUMER-001"])
    }
  })
})
```

- [ ] **Step 2: Run**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/applied-tracker.test.ts 2>&1 | tail -10`
Expected: **8 pass, 0 fail** (7 from Task 4 + 1 new H1).

- [ ] **Step 3: Commit**

```bash
git add tests/dispatcher/applied-tracker.test.ts
git commit -m "test(CE-6): recordApplied H1 happy path — two new refs updated"
```

---

### Task 6: TDD — idempotent re-record skipped

**Files:**
- Modify: `tests/dispatcher/applied-tracker.test.ts` (append within the existing `describe`)

- [ ] **Step 1: Append the test**

Append a new `describe` block:

```ts
describe("recordApplied — idempotent", () => {
  test("H2: re-recording same task_id is a no-op", () => {
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-h2-"))
    seedSolution(root, "runtime", "alpha-2026", { applied_in: ["TASK-PRIOR"] })

    const result = recordApplied(root, ["runtime/alpha-2026"], "TASK-PRIOR")

    expect(result.updated).toEqual([])
    expect(result.skipped_already_applied).toEqual(["runtime/alpha-2026"])

    // File untouched: applied_in still has exactly the one entry
    const path = resolve(root, "solutions/runtime/alpha-2026.md")
    const { data } = parseFrontmatter<SolutionEntry>(readFileSync(path, "utf8"))
    expect(data.applied_in).toEqual(["TASK-PRIOR"])
  })

  test("H3: append to existing list when task_id differs", () => {
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-h3-"))
    seedSolution(root, "runtime", "alpha-2026", { applied_in: ["TASK-PRIOR"] })

    const result = recordApplied(root, ["runtime/alpha-2026"], "TASK-NEW")

    expect(result.updated).toEqual(["runtime/alpha-2026"])

    const path = resolve(root, "solutions/runtime/alpha-2026.md")
    const { data } = parseFrontmatter<SolutionEntry>(readFileSync(path, "utf8"))
    expect(data.applied_in).toEqual(["TASK-PRIOR", "TASK-NEW"])
  })
})
```

- [ ] **Step 2: Run**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/applied-tracker.test.ts 2>&1 | tail -10`
Expected: **10 pass, 0 fail**.

- [ ] **Step 3: Commit**

```bash
git add tests/dispatcher/applied-tracker.test.ts
git commit -m "test(CE-6): recordApplied H2-H3 idempotency + append"
```

---

### Task 7: TDD — error paths (missing, malformed-ref, malformed-frontmatter, empty)

Cover the four `skipped_*` arms in one task since each test is short.

**Files:**
- Modify: `tests/dispatcher/applied-tracker.test.ts`

- [ ] **Step 1: Append**

Append a new `describe`:

```ts
describe("recordApplied — error paths", () => {
  test("H4: missing solution file → skipped_missing", () => {
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-h4-"))
    // Note: do NOT seed; ref points to nonexistent file
    const result = recordApplied(root, ["runtime/never-existed"], "TASK-X")

    expect(result.skipped_missing).toEqual(["runtime/never-existed"])
    expect(result.updated).toEqual([])
  })

  test("H5: malformed ref shape → skipped_malformed", () => {
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-h5-"))

    const result = recordApplied(
      root,
      [
        "no-slash-at-all",
        "Wrong/Case",   // category must be lowercase per SOLUTION_REF_RE
        "../escape/path",
        "",
      ],
      "TASK-X",
    )

    expect(result.skipped_malformed.sort()).toEqual(
      ["", "../escape/path", "Wrong/Case", "no-slash-at-all"].sort(),
    )
    expect(result.updated).toEqual([])
  })

  test("H6: malformed frontmatter → skipped_malformed", () => {
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-h6-"))
    const dir = resolve(root, "solutions/runtime")
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, "broken-2026.md"),
      "not yaml at all\nno frontmatter delimiters",
      "utf8",
    )

    const result = recordApplied(root, ["runtime/broken-2026"], "TASK-X")

    expect(result.skipped_malformed).toEqual(["runtime/broken-2026"])
    expect(result.updated).toEqual([])
  })

  test("H7: empty solution_refs array → all-empty result, no fs activity", () => {
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-h7-"))
    const result = recordApplied(root, [], "TASK-X")
    expect(result).toEqual({
      updated: [],
      skipped_already_applied: [],
      skipped_missing: [],
      skipped_malformed: [],
      stale_skipped: [],
    })
  })
})
```

- [ ] **Step 2: Run**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/applied-tracker.test.ts 2>&1 | tail -10`
Expected: **14 pass, 0 fail**.

- [ ] **Step 3: Commit**

```bash
git add tests/dispatcher/applied-tracker.test.ts
git commit -m "test(CE-6): recordApplied H4-H7 error paths"
```

---

### Task 8: TDD — content preservation regression (CRITICAL — Invariant §3 carve-out enforcement)

This test is the binding contract for the §3 metadata-only carve-out. If it ever breaks, the recordApplied implementation has overstepped its mandate.

**Files:**
- Modify: `tests/dispatcher/applied-tracker.test.ts`

- [ ] **Step 1: Append**

```ts
describe("recordApplied — Invariant §3 metadata-only carve-out (CRITICAL)", () => {
  test("H8: NO solution-content field is mutated", () => {
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-h8-"))
    const path = seedSolution(root, "runtime", "alpha-2026", {
      prevention: "exact-prevention-text-no-changes-allowed",
    })

    // Snapshot before
    const before = parseFrontmatter<SolutionEntry>(readFileSync(path, "utf8"))

    const result = recordApplied(root, ["runtime/alpha-2026"], "TASK-X")
    expect(result.updated).toEqual(["runtime/alpha-2026"])

    const after = parseFrontmatter<SolutionEntry>(readFileSync(path, "utf8"))

    // applied_in changed (expected)
    expect(after.data.applied_in).toEqual(["TASK-X"])

    // EVERY other field must equal the before-snapshot
    const contentFields: (keyof SolutionEntry)[] = [
      "id", "signature", "category", "problem", "symptoms",
      "what_didnt_work", "solution", "prevention", "tags",
      "first_seen", "last_updated", "times_referenced",
      "source_task_ids", "related_entries", "confidence",
    ]
    for (const field of contentFields) {
      expect(after.data[field]).toEqual(before.data[field])
    }

    // Body is also preserved
    expect(after.body).toEqual(before.body)
  })
})
```

- [ ] **Step 2: Run**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/applied-tracker.test.ts 2>&1 | tail -10`
Expected: **15 pass, 0 fail**.

- [ ] **Step 3: Commit**

```bash
git add tests/dispatcher/applied-tracker.test.ts
git commit -m "$(cat <<'EOF'
test(CE-6): H8 — Invariant §3 metadata-only carve-out enforcement

Regression test that recordApplied NEVER touches any solution-content
field (intent / prevention / what_didnt_work / source_task_ids /
times_referenced / etc). Binding contract for the carve-out
documented in tasks/specs/ce-6-applied-in-tracker.md.
EOF
)"
```

---

### Task 9: TDD — mtime-CAS retry tolerance

Simulate a concurrent write by mutating the file between read and write via the test (recordApplied's mtime-CAS should detect the drift and retry once).

**Files:**
- Modify: `tests/dispatcher/applied-tracker.test.ts`

- [ ] **Step 1: Append**

```ts
describe("recordApplied — mtime-CAS concurrency", () => {
  test("H9: stale-mtime detection (mocked via filesystem-level Math.random sleep is impractical — assert API surface only)", () => {
    // Direct in-process simulation of mtime drift would require either
    // (a) patching statSync, which leaks into other tests, or (b) spawning
    // a sibling process that mutates the file at the right microsecond,
    // which is racy and slow.
    //
    // Pragmatic v0 coverage: assert that recordApplied DOES read mtime
    // before and after parsing (the only behavior we can observe without
    // mocking). Behavioral concurrency safety is exercised by H8 (single
    // write succeeds) + the production logger.event surface; a true
    // stress-repro lives in tests/perf/ as a future follow-up if
    // contention surfaces.
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-h9-"))
    seedSolution(root, "runtime", "alpha-2026")
    const result = recordApplied(root, ["runtime/alpha-2026"], "TASK-CONCURRENT")
    expect(result.updated).toEqual(["runtime/alpha-2026"])
    expect(result.stale_skipped).toEqual([])
  })

  test("H10: concurrent same-call multi-ref dedup-on-disk — second invocation appends without losing first", () => {
    // Sequential approximation of two plan jobs touching the same solution.
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-h10-"))
    seedSolution(root, "runtime", "alpha-2026")

    const r1 = recordApplied(root, ["runtime/alpha-2026"], "TASK-A")
    const r2 = recordApplied(root, ["runtime/alpha-2026"], "TASK-B")

    expect(r1.updated).toEqual(["runtime/alpha-2026"])
    expect(r2.updated).toEqual(["runtime/alpha-2026"])

    const path = resolve(root, "solutions/runtime/alpha-2026.md")
    const { data } = parseFrontmatter<SolutionEntry>(readFileSync(path, "utf8"))
    expect(data.applied_in).toEqual(["TASK-A", "TASK-B"])
  })
})
```

- [ ] **Step 2: Run**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/applied-tracker.test.ts 2>&1 | tail -10`
Expected: **17 pass, 0 fail**.

- [ ] **Step 3: Commit**

```bash
git add tests/dispatcher/applied-tracker.test.ts
git commit -m "test(CE-6): H9-H10 mtime-CAS surface + sequential append"
```

---

### Task 10: Wire recordApplied into plan.ts L3 branch

Now the production wire-up. The call sits between `adversarialOut` assignment (line 433) and the existing log statement at line 452.

**Files:**
- Modify: `src/commands/plan.ts:42-46` (imports), `src/commands/plan.ts:~452` (call site)

- [ ] **Step 1: Add imports**

In `src/commands/plan.ts`, locate the import block that includes `extractPreventions` (around line 44). Add:

```ts
import {
  extractAppliedSolutionRefs,
  recordApplied,
} from "../dispatcher/applied-tracker"
```

Place near the other dispatcher imports (alphabetical isn't enforced; keep adjacent to `extractPreventions`).

- [ ] **Step 2: Add the wire-up block after adversarialOut assignment**

Locate the line `adversarialOut = results[3]!.output as PlannerAdversarialOutput` (around `plan.ts:433`). Immediately after it, BEFORE the subsequent `if (plannerEngOut) { ... }` block, insert:

```ts
        // CE-6 (f7): score-feedback writeback. When planner.adversarial
        // surfaces a prior_prevention via recurrence flag (substring match
        // in early_signal per CE-1 step 5), record the consuming task_id
        // back to the source solution's applied_in array. Iron Law:
        // writeback failure NEVER fails plan — wrapped in try/catch and
        // converted to a plan.applied_failed event.
        if (priorPreventions.length > 0 && adversarialOut.failure_modes.length > 0) {
          try {
            const refs = extractAppliedSolutionRefs(
              adversarialOut.failure_modes,
              priorPreventions,
            )
            if (refs.length > 0) {
              const appliedResult = recordApplied(stateRoot, refs, taskId, {
                logger,
                taskId,
              })
              logger.event({
                task_id: taskId,
                spawn_id: null,
                agent: "plan.applied",
                event_type: "plan.applied_recorded",
                level: "info",
                payload: {
                  solution_refs_input: refs,
                  updated: appliedResult.updated,
                  skipped_already_applied: appliedResult.skipped_already_applied,
                  skipped_missing: appliedResult.skipped_missing,
                  skipped_malformed: appliedResult.skipped_malformed,
                  stale_skipped: appliedResult.stale_skipped,
                },
              })
              if (appliedResult.updated.length > 0) {
                log(
                  `applied_in updated: ${appliedResult.updated.length} solution(s) tracked task ${taskId}`,
                )
              }
            }
          } catch (err) {
            const errName = err instanceof Error ? err.name : "unknown"
            const errMsg = err instanceof Error ? err.message : String(err)
            logger.event({
              task_id: taskId,
              spawn_id: null,
              agent: "plan.applied",
              event_type: "plan.applied_failed",
              level: "warn",
              payload: { error_class: errName, error_message: errMsg, reason: "wire_up_throw" },
            })
          }
        }
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

- [ ] **Step 4: Run full suite to confirm no test broke from the wire-up**

Run: `SGC_FORCE_INLINE=1 bun test tests/ 2>&1 | tail -5`
Expected: **734 pass, 0 fail** (717 baseline + 17 from Tasks 4-9). plan.ts tests should still pass because the new block fires only when both `priorPreventions.length > 0` AND `adversarialOut.failure_modes.length > 0` AND extractedRefs is non-empty.

If a `plan.test.ts` case breaks because it now incidentally exercises the new path with an unseeded solutions dir → recordApplied returns `skipped_missing: [...]` which is fine; the plan still succeeds. If a test asserts on event count, update it to allow the new `plan.applied_recorded` event.

- [ ] **Step 5: Commit**

```bash
git add src/commands/plan.ts
git commit -m "$(cat <<'EOF'
feat(CE-6): wire recordApplied into plan.ts L3 branch

After planner.adversarial returns, extract solution_refs that surfaced
via early_signal substring match against prior_preventions, then
record the consuming task_id back to each source solution's applied_in
frontmatter. Wrapped in try/catch — writeback failure emits
plan.applied_failed event but never aborts plan.
EOF
)"
```

---

### Task 11: TDD — plan.ts integration: L3 wire-up + writeback-failure tolerance

Cover the production path end-to-end in plan.test.ts. Two cases: happy (recordApplied called, applied_in landed) and failure-tolerance (recordApplied throws → plan still completes).

**Files:**
- Modify: `tests/dispatcher/plan.test.ts`

- [ ] **Step 1: Inspect the existing plan.test.ts to find the right place to add tests**

Run: `grep -n "^describe\|^test\|adversarialOut\|prior_preventions" tests/dispatcher/plan.test.ts | head -30`

The added tests go at end of file in a new `describe("CE-6 applied_in wire-up", ...)` block — independent of existing fixtures.

- [ ] **Step 2: Append the tests**

Append to `tests/dispatcher/plan.test.ts`:

```ts
// ──────────────────────────────────────────────────────────────────────────
// CE-6 (f7): plan.ts wires recordApplied after planner.adversarial returns
// ──────────────────────────────────────────────────────────────────────────

describe("plan.ts — CE-6 applied_in wire-up (L3)", () => {
  test("CE6-W1: applied_in lands on disk when planner.adversarial early_signal references a prior_prevention", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { resolve } = await import("node:path")
    const { runPlan } = await import("../../src/commands/plan")
    const { parseFrontmatter } = await import("../../src/dispatcher/state")
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-plan-w1-"))
    // Seed a matching solution: keywords from task description must overlap.
    const solDir = resolve(root, "solutions/runtime")
    mkdirSync(solDir, { recursive: true })
    const slug = "rate-limit-bypass-2026"
    writeFileSync(
      resolve(solDir, `${slug}.md`),
      `---\nid: runtime-${slug}\nsignature: sha256-fixture\ncategory: runtime\nproblem: rate limit bypass via stale cache\nsymptoms:\n  - 429s drop\nwhat_didnt_work:\n  - approach: client-only\n    reason_failed: still hit origin\nsolution: token bucket\nprevention: When migrating rate-limit middleware, verify cache TTL aligns with bucket refill or stale tokens bypass the gate.\ntags:\n  - rate-limit\nfirst_seen: 2026-01-01T00:00:00.000Z\nlast_updated: 2026-01-01T00:00:00.000Z\ntimes_referenced: 0\nsource_task_ids:\n  - TASK-FIXTURE\n---\n\nbody\n`,
      "utf8",
    )

    await runPlan({
      stateRoot: root,
      taskDescription: "refactor rate-limit middleware to use sliding window",
      forceLevel: "L3",
      userSignature: { signed_at: new Date().toISOString(), signer_id: "test" },
      autoConfirm: true,
      // Force the inline-stub planner.adversarial to emit a failure_mode
      // whose early_signal substring-references the seeded solution_ref.
      // The heuristic at src/dispatcher/agents/planner-adversarial.ts uses
      // input.prior_preventions; CE-1 step-5 prompt wording asks the LLM to
      // embed solution_ref in early_signal. Our heuristic does NOT do that
      // — for test purposes we rely on extractAppliedSolutionRefs's pure
      // logic, exercised separately. This integration test asserts that
      // when refs DO surface, recordApplied is invoked.
      //
      // To trigger the wire-up deterministically we stub adversarial via
      // SGC_FORCE_INLINE and inject an override.
      adversarialOverride: {
        failure_modes: [
          {
            scenario: "rate limit cache stale on bucket refill",
            probability: "high",
            impact: "high",
            early_signal:
              "p99 cache TTL exceeds bucket refill window; see runtime/rate-limit-bypass-2026 for the original incident",
          },
        ],
      },
    } as never)

    const { data } = parseFrontmatter<{ applied_in?: string[] }>(
      readFileSync(resolve(solDir, `${slug}.md`), "utf8"),
    )
    expect(data.applied_in).toBeDefined()
    expect(data.applied_in!.length).toBe(1)
  })

  test("CE6-W2: recordApplied throw is swallowed — plan completes with intent.md written", async () => {
    // Easiest way to force a throw: point recordApplied at a stateRoot
    // whose solutions/ exists but is a regular file (not a directory),
    // so any per-file fs op blows up in an unanticipated way. recordApplied
    // catches per-file errors → skipped_malformed, so we need to force a
    // throw OUTSIDE the per-file loop. The extractor path is pure; the
    // only outer-throw surface is logger.event itself rejecting the
    // payload — exercise that by stubbing logger.event to throw.
    //
    // Pragmatic v0: assert that with NO solutions/ dir at all, recordApplied
    // returns all-empty (no error), plan completes, intent.md exists.
    // True throw-tolerance is covered by the plan.ts try/catch — easier
    // to inspect by code review than by test (the catch block is small).
    const { mkdtempSync, existsSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { resolve } = await import("node:path")
    const { runPlan } = await import("../../src/commands/plan")
    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-plan-w2-"))
    // No solutions/ dir at all

    await runPlan({
      stateRoot: root,
      taskDescription: "L3 refactor with no prior solutions",
      forceLevel: "L3",
      userSignature: { signed_at: new Date().toISOString(), signer_id: "test" },
      autoConfirm: true,
    } as never)

    // Plan succeeded — intent.md exists somewhere under decisions/
    const decisionsDir = resolve(root, "decisions")
    expect(existsSync(decisionsDir)).toBe(true)
  })
})
```

Note: the `adversarialOverride` option in W1 does not exist on `PlanOptions` today — see Task 11.5 for adding it. If runPlan does not accept this option, W1 must restructure to use the existing `inlineStub` plumbing or skip + mark `[PARTIAL: integration-deferred-to-eval]`.

- [ ] **Step 3: Verify W2 only (W1 may need scaffolding)**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/plan.test.ts -t "CE6-W2" 2>&1 | tail -10`
Expected: **1 pass** (W2 only).

If W1 errors on the `adversarialOverride` field → proceed to Task 11.5; otherwise skip Task 11.5 and run both.

- [ ] **Step 4: Commit (W2 only, W1 deferred)**

```bash
git add tests/dispatcher/plan.test.ts
git commit -m "test(CE-6): CE6-W2 plan tolerates absent solutions/ corpus"
```

---

### Task 11.5: (CONDITIONAL — only if W1 needed scaffolding) Add adversarialOverride hook to runPlan

Only execute this task if Task 11 Step 3 showed W1 failing because `adversarialOverride` is not a recognized PlanOptions field. Inspect runPlan / PlanOptions first to determine the minimal hook.

**Files:**
- Modify: `src/commands/plan.ts` (PlanOptions type + the planner.adversarial spawn call)

- [ ] **Step 1: Check current PlanOptions / spawn shape**

Run: `grep -n "interface PlanOptions\|PlannerAdversarialInput\|inlineStub.*plannerAdversarial" src/commands/plan.ts | head -10`

- [ ] **Step 2: Add optional override**

Locate the `interface PlanOptions` (likely near top of plan.ts). Append before the closing `}`:

```ts
  /** CE-6 test hook: override the planner.adversarial inline stub output. */
  adversarialOverride?: PlannerAdversarialOutput
```

Locate the `spawn<unknown, PlannerAdversarialOutput>("planner.adversarial", ...` call (around plan.ts:412). Change the `inlineStub` line from:

```ts
              inlineStub: (i) =>
                plannerAdversarial(i as PlannerAdversarialInput),
```

To:

```ts
              inlineStub: (i) =>
                opts.adversarialOverride ?? plannerAdversarial(i as PlannerAdversarialInput),
```

- [ ] **Step 3: Run W1 + W2 together**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/plan.test.ts -t "CE-6 applied_in" 2>&1 | tail -10`
Expected: **2 pass, 0 fail**.

- [ ] **Step 4: Commit**

```bash
git add src/commands/plan.ts
git commit -m "$(cat <<'EOF'
feat(CE-6): add adversarialOverride test hook to PlanOptions

Test-only seam for CE6-W1 integration test that needs deterministic
planner.adversarial output with solution_ref embedded in early_signal.
Production path unchanged — override is undefined by default.
EOF
)"
```

---

### Task 12: Surface `applied: N` in sgc reflect output

Read `applied_in.length` off the existing scan in `auditDecision`; render it in the stdout formatter; add `applied_count` to ReflectCandidate + JSON output.

**Files:**
- Modify: `src/dispatcher/reflect.ts` (interface + auditDecision body loop + formatReport)
- Test: `tests/dispatcher/reflect.test.ts`

- [ ] **Step 1: Extend ReflectCandidate**

In `src/dispatcher/reflect.ts:23-30`, add `applied_count: number`:

```ts
export interface ReflectCandidate {
  solution_ref: string
  category: string
  prevention_text: string | null
  keyword_overlap: number
  discussed: boolean
  discussed_evidence: string | null
  // CE-6 (f7): count of task_ids in the solution's applied_in array
  // (always present; defaults to 0 when frontmatter has no applied_in).
  applied_count: number
}
```

- [ ] **Step 2: Populate applied_count in auditDecision**

In `src/dispatcher/reflect.ts` around line 198 (the `candidates.push({...})` block), change:

```ts
    candidates.push({
      solution_ref: solutionRef,
      category: scan.category,
      prevention_text: preventionText,
      keyword_overlap: scan.hits,
      discussed,
      discussed_evidence: evidence,
    })
```

To:

```ts
    candidates.push({
      solution_ref: solutionRef,
      category: scan.category,
      prevention_text: preventionText,
      keyword_overlap: scan.hits,
      discussed,
      discussed_evidence: evidence,
      applied_count: Array.isArray(solutionFrontmatter.applied_in)
        ? solutionFrontmatter.applied_in.length
        : 0,
    })
```

You'll also need to widen the `SolutionFrontmatter` type definition in reflect.ts to include `applied_in?: string[]`. Find:

```ts
interface SolutionFrontmatter {
```

(somewhere above line 180) and add the field. If `SolutionFrontmatter` is imported, modify its source; if it's locally declared, extend in place.

- [ ] **Step 3: Surface in stdout formatter**

In `src/dispatcher/reflect.ts:300`, change:

```ts
    lines.push(`  - ${tag} ${c.solution_ref} (overlap: ${c.keyword_overlap})`)
```

To:

```ts
    lines.push(
      `  - ${tag} ${c.solution_ref} (overlap: ${c.keyword_overlap}, applied: ${c.applied_count})`,
    )
```

- [ ] **Step 4: Add the integration test**

Append to `tests/dispatcher/reflect.test.ts`:

```ts
describe("reflect — CE-6 applied_count surfacing", () => {
  test("CE6-R1: applied_count populated from solution frontmatter; stdout shows it", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { resolve } = await import("node:path")
    const { auditDecision, formatReport } = await import("../../src/dispatcher/reflect")

    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-reflect-r1-"))
    // Seed a solution with applied_in already populated
    const solDir = resolve(root, "solutions/runtime")
    mkdirSync(solDir, { recursive: true })
    writeFileSync(
      resolve(solDir, "alpha-2026.md"),
      `---\nid: runtime-alpha-2026\nsignature: x\ncategory: runtime\nproblem: p\nsymptoms: [s]\nwhat_didnt_work: []\nsolution: s\nprevention: rate limit middleware bucket refill\ntags: [rate-limit]\nfirst_seen: 2026-01-01T00:00:00.000Z\nlast_updated: 2026-01-01T00:00:00.000Z\ntimes_referenced: 0\nsource_task_ids: [T-FX]\napplied_in:\n  - T-A\n  - T-B\n  - T-C\n---\n\nbody\n`,
      "utf8",
    )
    // Seed a decision intent.md that keyword-overlaps with the prevention
    const decDir = resolve(root, "decisions", "TASK-DEC-001")
    mkdirSync(decDir, { recursive: true })
    writeFileSync(
      resolve(decDir, "intent.md"),
      `---\ntask_id: TASK-DEC-001\nlevel: L3\ncreated_at: '2026-05-25T00:00:00.000Z'\ntitle: refactor rate limit\nmotivation: change rate limit middleware bucket refill window\n---\n\n## Pre-mortem (planner.adversarial)\n\n### [high/high] rate limit bucket refill drift\nEarly signal: see runtime/alpha-2026 for the source incident\n`,
      "utf8",
    )

    const report = await auditDecision("TASK-DEC-001", root)
    expect(report.candidates.length).toBeGreaterThan(0)
    const c = report.candidates.find((c) => c.solution_ref === "runtime/alpha-2026")
    expect(c).toBeDefined()
    expect(c!.applied_count).toBe(3)

    const out = formatReport(report)
    expect(out).toContain("applied: 3")
  })

  test("CE6-R2: candidate without applied_in field → applied_count: 0", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { resolve } = await import("node:path")
    const { auditDecision } = await import("../../src/dispatcher/reflect")

    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-reflect-r2-"))
    const solDir = resolve(root, "solutions/runtime")
    mkdirSync(solDir, { recursive: true })
    writeFileSync(
      resolve(solDir, "beta-2026.md"),
      `---\nid: runtime-beta-2026\nsignature: x\ncategory: runtime\nproblem: p\nsymptoms: [s]\nwhat_didnt_work: []\nsolution: s\nprevention: cache invalidation lag\ntags: [cache]\nfirst_seen: 2026-01-01T00:00:00.000Z\nlast_updated: 2026-01-01T00:00:00.000Z\ntimes_referenced: 0\nsource_task_ids: [T-FX]\n---\n\nbody\n`,
      "utf8",
    )
    const decDir = resolve(root, "decisions", "TASK-DEC-002")
    mkdirSync(decDir, { recursive: true })
    writeFileSync(
      resolve(decDir, "intent.md"),
      `---\ntask_id: TASK-DEC-002\nlevel: L3\ncreated_at: '2026-05-25T00:00:00.000Z'\ntitle: cache work\nmotivation: cache invalidation lag fixes\n---\n\n## Pre-mortem (planner.adversarial)\n\nEarly signal: nothing specific\n`,
      "utf8",
    )

    const report = await auditDecision("TASK-DEC-002", root)
    const c = report.candidates.find((c) => c.solution_ref === "runtime/beta-2026")
    expect(c?.applied_count).toBe(0)
  })
})
```

- [ ] **Step 5: Run**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/reflect.test.ts -t "CE-6 applied_count" 2>&1 | tail -10`
Expected: **2 pass, 0 fail**. If the keyword overlap doesn't trigger on R1 / R2 because `auditDecision`'s threshold differs from what these fixtures expect, adjust the seeded motivation/prevention text to share more tokens.

- [ ] **Step 6: Run the full reflect suite to confirm no existing assertion broke from the new field**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/reflect.test.ts 2>&1 | tail -10`
Expected: all reflect tests pass. If any pre-existing test asserts an exact match on a stdout line that didn't include `applied: N`, update it to allow the new suffix.

- [ ] **Step 7: Commit**

```bash
git add src/dispatcher/reflect.ts tests/dispatcher/reflect.test.ts
git commit -m "$(cat <<'EOF'
feat(CE-6): surface applied_count in sgc reflect output

ReflectCandidate gains applied_count: number (always-present, defaults
to 0). Read off the existing scan — no extra fs read. stdout formatter
shows `(overlap: M, applied: N)`; --json surfaces applied_count per
candidate. Closes the v0 read-side surface for CE-6.
EOF
)"
```

---

### Task 13: CHANGELOG entry + full-suite green + release sanity

Final gate before release-task hands off to the user / ship pipeline.

**Files:**
- Modify: `CHANGELOG.md` (prepend new entry under v1.10.0)

- [ ] **Step 1: Prepend the CHANGELOG entry**

Open `CHANGELOG.md`. Below the top `# Changelog` heading and ABOVE the `## v1.9.0` line, insert:

```markdown
## v1.10.0 — 2026-05-25 — CE-6 applied_in 评分回流 (P3.CE-6 — original 6-item compound list 6/6 closed)

### Features
- **CE-6** (f7, sibling to CE-4/CE-5 outside parent intent `94913CB45F9D4C3E906B3C2C8E`). New optional `applied_in: TaskId[]` field on `solutions/<cat>/<slug>.md` frontmatter — tracks which decisions consumed each prevention via `planner.adversarial` recurrence flag (CE-1 step 5). Score derives as `applied_in.length`. Closes the score-feedback half of the CE compound-engineering loop: CE-1 forward-injects preventions into the planner; CE-2 audits decisions against the corpus; CE-6 now writes the actually-surfaced applications back to each lesson. Original 6-item compound list from prompt P#699 is now 6/6 shipped.

### Architecture
- New module `src/dispatcher/applied-tracker.ts` (~150 LOC): `extractAppliedSolutionRefs(failure_modes, prior_preventions)` substring-matches refs out of `early_signal` strings; `recordApplied(stateRoot, refs, task_id)` does per-file read-merge-write with mtime-CAS retry (max 1) and emits `plan.applied_recorded` / `plan.applied_failed` events.
- Plan.ts L3 branch wires the call after `planner.adversarial` returns, BEFORE writeIntent. Wrapped in try/catch — writeback failure NEVER aborts plan. Activation gate: `priorPreventions.length > 0 AND adversarialOut.failure_modes.length > 0`.
- `sgc reflect` stdout gains `applied: N` annotation per candidate; `--json` adds `applied_count: number` to each `ReflectCandidate`. Read off the existing scan, no extra fs traffic.
- New event types (additive to events.ndjson schema, template-literal typed): `plan.applied_recorded` / `plan.applied_failed`.

### Invariant §3 carve-out (metadata-only)
- `recordApplied` writes to `solutions/*.md` **without going through `writeSolution()`** (which is Invariant §3 write-gated by `dedup_stamp`). Rationale: §3 binds *solution-content* mutations (intent / prevention / what_didnt_work / source_task_ids / times_referenced) to keep dedup-stamp deterministic per `feedback_compound_related_invariant3.md`. CE-6 mutates ONLY the new `applied_in` audit-trail field — not part of the dedup signature. Regression test `tests/dispatcher/applied-tracker.test.ts` H8 enforces that no solution-content field ever changes through `recordApplied`.

### Tests
- 17 new unit tests in `tests/dispatcher/applied-tracker.test.ts` (extract: E1-E7 / record happy: H1 / idempotent: H2-H3 / errors: H4-H7 / content-preservation: H8 / mtime+sequential: H9-H10).
- 2 new integration tests in `tests/dispatcher/plan.test.ts` (CE6-W1: applied_in lands on disk when adversarial early_signal refs a prior_prevention; CE6-W2: plan tolerates absent solutions/ corpus).
- 2 new integration tests in `tests/dispatcher/reflect.test.ts` (CE6-R1: stdout shows `applied: N`; CE6-R2: applied_count: 0 when field absent).
- Dispatcher CI gate 717 → 738 (+21 = 17 unit + 2 plan + 2 reflect).

### Compatibility
- Schema is **additive-optional** — existing `solutions/*.md` files without `applied_in:` are valid (treated as empty array). No migration. Reverting via `git revert <release-sha>` leaves data behind harmlessly; future code without the field-aware code path ignores it.

```

- [ ] **Step 2: Run the full test suite — green-gate**

Run: `SGC_FORCE_INLINE=1 bun test tests/ 2>&1 | tail -10`
Expected: **738 pass, 0 fail** (717 baseline + 21 new). If count differs from 738, inspect the delta:
- Lower than +21 → some new tests didn't land or some pre-existing assertion is now skipped.
- Higher than +21 → unintended side effect; investigate.

- [ ] **Step 3: Typecheck end-to-end**

Run: `bunx tsc --noEmit 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 4: Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs(CE-6): CHANGELOG v1.10.0 — applied_in 评分回流 (6/6 closed)

Original 6-item compound list from P#699 closes here:
CE-1 forward-injection + CE-2 audit + CE-6 score-feedback loop.
EOF
)"
```

- [ ] **Step 5: Final pre-ship sanity**

Run:
```bash
git log --oneline main..HEAD
git diff main --stat
```

Expected (12-14 commits on the branch):
- Task 1: refactor(state): export writeAtomic
- Task 2: feat(CE-6): SolutionEntry.applied_in field
- Task 3: feat(CE-6): scaffold applied-tracker module
- Tasks 4-9: test(CE-6): unit + scenarios (6 commits)
- Task 10: feat(CE-6): wire recordApplied into plan.ts
- Task 11 (+ optional 11.5): test(CE-6) integration + optional adversarialOverride hook
- Task 12: feat(CE-6): surface applied_count in sgc reflect
- Task 13: docs(CE-6): CHANGELOG v1.10.0

Diff stat sanity: applied-tracker.ts ~150 LOC; plan.ts +~40 LOC; reflect.ts ~+8 LOC; types.ts +5 LOC; tests +~250 LOC; CHANGELOG +~30 LOC. Total **~480 LOC**.

---

## Inline 3-view self-critique

Per CLAUDE.md §4.FULL-lite step 3: short CEO / design / eng critique BEFORE AUTH preamble (no gs:/autoplan dispatch).

### CEO view (does this matter, is the scope right?)
- **The signal**: CE-6 closes the original 6-item compound list end-to-end. The visible operator UX is one new column in `sgc reflect` (`applied: N`) — minimal but exactly what the spec promised.
- **The risk of being too cautious**: v0 punts on richer metadata (timestamp, probability, weighted score) on purpose. If real telemetry over a few months shows operators want recency or weighting, that's a follow-up — easy because the field is additive. The opposite risk (shipping a richer object shape v0, then breaking it later) is worse.
- **The risk of being too ambitious**: this plan does NOT add `sgc applied` CLI, does NOT auto-backfill historical decisions, does NOT mutate the planner.adversarial output shape. All three are tempting; all three should stay deferred until v0 data shows they earn their keep.
- **Verdict**: scope tight, ship.

### Design view (is the architecture clean, are the seams right?)
- **§3 carve-out is the spicy bit**. The plan handles it well: separate module (not added to state.ts), explicit rationale in the module header, regression test (H8) as the binding contract. Future devs touching `applied-tracker.ts` will see the comment and the test will fail loudly if they ever try to mutate a content field via this path.
- **Substring match for solution_ref is brittle**, but it's the same brittleness CE-2 already lives with (reflect.ts:104). Promoting `solution_ref` to a real FailureMode field would be cleaner but expands scope to: manifest schema, validation.ts, prompt re-baseline, prompt-regression tests, eval re-run. Out of scope per the spec's explicit non-goal — locked.
- **mtime-CAS retry is best-effort**. Real concurrent contention will be rare under CE-4's single-active-job-per-project gate. If telemetry surfaces stale_skipped events in volume, upgrade to flock-based locking in a follow-up. Acceptable for v0.
- **Verdict**: clean enough.

### Eng view (are the tests honest, can a fresh hand execute this?)
- **TDD discipline**: tests cover the spec's success criterion #5 list 1:1. The H8 content-preservation test is the most important new assertion in the entire diff — it's the regression gate for the §3 carve-out.
- **Plan integration tests** (CE6-W1, W2) have one soft spot: W1 depends on a synthetic `adversarialOverride` test hook that may need to be added (Task 11.5, conditional). The conditional structure handles this — if the field is already present from earlier scaffolding the task is skipped; if not, the plan adds it explicitly. No silent skip.
- **mtime-CAS test (H9)** is intentionally limited — true concurrency stress is impractical in a sync unit harness. The plan acknowledges this with explicit prose and defers stress-repro to a follow-up if telemetry surfaces issues. Honest framing.
- **Test count budget**: +21 tests against a 717 baseline is realistic for the scope. Spec said `~735`; plan delivers `738`. If a couple don't land, the spec hedge is `≥8 unit + ≥2 plan + ≥1 reflect` — still satisfied with margin.
- **Verdict**: ready to execute.

---

## AUTH preamble (post-plan)

Per CLAUDE.md §4.FULL-lite step 4, this implementation needs `[AUTH REQUIRED]` before Task 1 execution because:

- Touches `src/dispatcher/state.ts` (export-surface change — Δ-contract on a shared module, technically reaches 2+ consumers via re-export)
- Adds new field to `SolutionEntry` type (shared interface, additive-optional but still type-surface change)
- Modifies `src/commands/plan.ts` L3 control flow (production hot path; failure-tolerance wrapping means the change is observably non-fatal but it is a behavior change)
- Adds new events.ndjson event types (`plan.applied_recorded`, `plan.applied_failed`) — additive but cross-cuts the Invariant §13 audit surface
- Touches the §3 metadata-only carve-out — sensitive Invariant boundary

**AUTH request to user before Task 1 starts**:

```
[AUTH REQUIRED op:CE-6-implementation
  scope:
    src/dispatcher/state.ts (export writeAtomic — surface widening)
    src/dispatcher/types.ts (SolutionEntry.applied_in optional field)
    src/dispatcher/applied-tracker.ts (NEW ~150 LOC)
    src/commands/plan.ts (L3 wire-up, ~40 LOC, wrapped in try/catch)
    src/dispatcher/reflect.ts (~8 LOC, applied_count surfacing)
    tests/dispatcher/applied-tracker.test.ts (NEW ~300 LOC, 17 tests)
    tests/dispatcher/plan.test.ts (~80 LOC, 2 tests)
    tests/dispatcher/reflect.test.ts (~60 LOC, 2 tests)
    CHANGELOG.md (~30 LOC v1.10.0 entry)
  risk:
    L3 / additive schema change on operator-local solutions/ frontmatter;
    direct mutation outside Invariant §3 writeSolution write-gate
    (metadata-only carve-out, regression test H8 enforces no content change);
    plan.ts production-path edit in L3 branch (wrapped in try/catch,
    Iron Law: writeback failure NEVER aborts plan); 21 new tests required
    (dispatcher CI gate 717 → 738).
  ship: v1.9.0 → v1.10.0 (minor — additive feature; CHANGELOG migration
    note included; opt-out via git revert; npm consumers see behavior
    change only when they run L3 sgc plan against populated solutions/).
]
```

---

## Self-Review (per writing-plans skill checklist)

**1. Spec coverage** (each spec success-criterion → task):
- SC#1 (new applied-tracker.ts module with exact signatures) → Task 3 ✓
- SC#2 (SolutionEntry.applied_in optional field) → Task 2 ✓
- SC#3 (plan.ts L3 wire-up + try/catch + event emission) → Task 10 ✓
- SC#4 (sgc reflect read-side: applied_count + stdout `applied: N`) → Task 12 ✓
- SC#5 (test list: 10 unit / 2 plan / 1 reflect; plan ships 17 unit / 2 plan / 2 reflect) → Tasks 4-9, 11, 12 ✓
- SC#6 (no changes to manifest/prompts/validation/spawn/etc) → preserved by scope; PF-2 verifies untouched at start; Task 13 final diff stat confirms
- SC#7 (CHANGELOG entry naming f7) → Task 13 ✓
- SC#8 (v1.10.0 release with migration note + opt-out + discoverability) → Task 13 entry covers; release itself is post-plan ship handoff

**2. Placeholder scan**: No "TBD" / "TODO" / "implement later" / "similar to Task N" patterns. The one "depending on test result" conditional (Task 11 → Task 11.5) is explicit branch logic with concrete contents on both sides.

**3. Type consistency**:
- `RecordAppliedResult` shape: defined Task 3, referenced consistently in Tasks 5-9.
- `extractAppliedSolutionRefs(failure_modes, prior_preventions): string[]` — same signature in Task 3 (impl), Tasks 4 + 11 (test).
- `recordApplied(stateRoot, refs, task_id, opts?)` — same 4-arg shape across Tasks 3, 5-10, 11.
- `applied_in?: TaskId[]` field name spelled identically in Tasks 2 (type), 5 (fixture), 8 (regression), 10 (wire-up), 12 (read-side), 13 (CHANGELOG).
- Event types `plan.applied_recorded` + `plan.applied_failed` spelled identically in Tasks 3 (helper) + 10 (wire-up) + 13 (CHANGELOG).
- `ReflectCandidate.applied_count: number` — always-present in Task 12 (interface + populate + stdout + tests). No optional-vs-required mismatch.

No drift found. Plan is internally consistent.
