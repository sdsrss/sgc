# L2 Reviewer Cluster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `sgc review` run a real cluster at L2+: always-on quality trio (`reviewer.correctness` + `reviewer.tests` + `reviewer.maintainability`) plus diff-conditional domain specialists (gate lowered L3→L2+), so README's "L2 = Reviewer cluster" claim becomes true.

**Architecture:** Two new heuristic reviewer agents in a new `reviewer-quality.ts` (tests + maintainability), flip their manifest entries from `slot-only` to `implemented` (keep `prompt_path: null` → synthesized prompt, no new prompt files), then wire `review.ts` to spawn the quality trio at L2+ and lower the existing specialist gate from `level === "L3"` to L2+. Reviewers stay amnesiac (Invariant §1); CE closure is the evaluator gate (no new CE code).

**Tech Stack:** TypeScript (Node ESM, bun test), the existing `spawn` protocol + `appendReview`, YAML manifest.

**Spec:** `docs/superpowers/specs/2026-06-03-l2-reviewer-cluster-design.md`

---

## Conventions (read before starting)

- Test runner: `bun test`; inline/deterministic agent mode = `SGC_FORCE_INLINE=1`.
- Two test lanes (`feedback_sgc_test_lane_divergence`): `npm test`/`publish.yml` run only `tests/dispatcher`; CI `test.yml` runs `tests/dispatcher tests/eval`. Before ship run `bun test tests/dispatcher tests/eval` and grep both for `runReview(`.
- New reviewer agents follow the `reviewer-specialists.ts` pattern: pure functions returning `ReviewerSpecialistOutput`. `prompt_path: null` means the LLM path uses the synthesized prompt derived from the `reviewer.correctness` anchor — **no new prompt files** and **no `## Input`/`<input_yaml/>` requirement** (that applies only to prompt FILES; see `feedback_new_prompt_needs_input_yaml_placeholder`).
- CLI entry stays bare `runMain(main)` — never add `import.meta.main` (`feedback_import_meta_main_breaks_bun_bundle`).
- Bundle rebuild (`npm run build:cli` + `git add --chmod=+x`) is done ONCE at the end (Task 6), not per task.
- Reply language: Chinese chat prose; English code/commits/paths.
- Established fact: `freshTask()` in `tests/dispatcher/sgc-review.test.ts` classifies "simple change" as **L1**, so all existing freshTask-based tests stay correctness-only after this change. The one L2 test is `W3` (line ~143, uses "public API" description → L2).

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/dispatcher/agents/reviewer-quality.ts` | Create | `reviewer.tests` (file-level: source-changed-without-test → concern) + `reviewer.maintainability` (added-line: long lines / TODO / @ts-ignore / as any → concern). Pure functions. |
| `contracts/sgc-capabilities.yaml:372-373` | Modify | Flip `reviewer.tests` + `reviewer.maintainability` `status: slot-only` → `status: implemented`. |
| `src/commands/review.ts` | Modify | Spawn quality trio at L2+; lower specialist gate `level === "L3"` → L2+. |
| `docs/POSITIONING.md:28` + `README.md:125` | Modify | Reflect the now-true L2 cluster. |
| `tests/dispatcher/reviewer-quality.test.ts` | Create | Unit tests for both heuristics. |
| `tests/dispatcher/sgc-review.test.ts` | Modify | Add L1/L2/L3 cluster integration tests; verify W3 still passes. |

---

## Task 1: `reviewer.tests` + `reviewer.maintainability` heuristic agents

**Files:**
- Create: `src/dispatcher/agents/reviewer-quality.ts`
- Test: `tests/dispatcher/reviewer-quality.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/dispatcher/reviewer-quality.test.ts`:

```ts
import { test, expect, describe } from "bun:test"
import {
  reviewerTests,
  reviewerMaintainability,
} from "../../src/dispatcher/agents/reviewer-quality"

describe("reviewer.tests heuristic", () => {
  test("source file changed with no test file → concern", () => {
    const diff = "diff --git a/src/foo.ts b/src/foo.ts\n+++ b/src/foo.ts\n+export function foo() { return 1 }\n"
    const r = reviewerTests({ diff, intent: "" })
    expect(r.verdict).toBe("concern")
    expect(r.findings.length).toBe(1)
  })
  test("source + test file both changed → pass", () => {
    const diff =
      "diff --git a/src/foo.ts b/src/foo.ts\n+++ b/src/foo.ts\n+export function foo() { return 1 }\n" +
      "diff --git a/tests/foo.test.ts b/tests/foo.test.ts\n+++ b/tests/foo.test.ts\n+test('foo', () => {})\n"
    expect(reviewerTests({ diff, intent: "" }).verdict).toBe("pass")
  })
  test("test-only diff → pass", () => {
    const diff = "diff --git a/tests/foo.test.ts b/tests/foo.test.ts\n+++ b/tests/foo.test.ts\n+test('x', () => {})\n"
    expect(reviewerTests({ diff, intent: "" }).verdict).toBe("pass")
  })
  test("empty diff → pass", () => {
    expect(reviewerTests({ diff: "", intent: "" }).verdict).toBe("pass")
  })
  test("docs-only diff (no source) → pass", () => {
    const diff = "diff --git a/README.md b/README.md\n+++ b/README.md\n+# heading\n"
    expect(reviewerTests({ diff, intent: "" }).verdict).toBe("pass")
  })
})

describe("reviewer.maintainability heuristic", () => {
  test("added line > 120 chars → concern", () => {
    const longLine = "+const x = " + "a".repeat(130)
    const r = reviewerMaintainability({ diff: longLine + "\n", intent: "" })
    expect(r.verdict).toBe("concern")
    expect(r.severity).toBe("low")
    expect(r.findings.length).toBeGreaterThan(0)
  })
  test("added TODO / @ts-ignore / as any → concern", () => {
    const diff = "+  // TODO fix this\n+  const y = z as any\n+  // @ts-ignore\n"
    const r = reviewerMaintainability({ diff, intent: "" })
    expect(r.verdict).toBe("concern")
    expect(r.findings.length).toBe(3)
  })
  test("clean short diff → pass", () => {
    const diff = "+const a = 1\n+const b = 2\n"
    expect(reviewerMaintainability({ diff, intent: "" }).verdict).toBe("pass")
  })
  test("markers on removed lines are not flagged", () => {
    const diff = "-// TODO old\n+const clean = 1\n"
    expect(reviewerMaintainability({ diff, intent: "" }).verdict).toBe("pass")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/reviewer-quality.test.ts`
Expected: FAIL — module `reviewer-quality` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/dispatcher/agents/reviewer-quality.ts`:

```ts
// L2+ always-on quality reviewers — keyword/structure heuristic stubs.
//
// runReview at L2+ spawns reviewer.correctness PLUS these two quality
// reviewers (always), independent of the diff-conditional domain specialists
// in reviewer-specialists.ts. Same SubagentManifest contract + output shape
// (verdict / severity / findings); the LLM path replaces the stub via the
// synthesized prompt (prompt_path: null in the manifest).
//
// Invariant §1: these reviewers receive only { diff, intent } (intent already
// stripped of prior-art/pre-mortem back-channel by review.ts) and hold no
// read:solutions in their inherited reviewer_base scope tokens.

import type { Finding, Severity, Verdict } from "../types"
import type {
  ReviewerSpecialistInput,
  ReviewerSpecialistOutput,
} from "./reviewer-specialists"

/** Lines starting with `+` (added) but not the `+++` file header. */
function addedLines(diff: string): string[] {
  return (diff ?? "")
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
}

/** File paths from `+++ b/<path>` headers in the diff. */
function changedFilePaths(diff: string): string[] {
  const paths: string[] = []
  for (const line of (diff ?? "").split("\n")) {
    if (line.startsWith("+++ ")) {
      // "+++ b/src/foo.ts" → "src/foo.ts"; "+++ /dev/null" skipped.
      const p = line.slice(4).replace(/^[ab]\//, "").trim()
      if (p && p !== "/dev/null") paths.push(p)
    }
  }
  return paths
}

/** A path is a test file if a path segment is test(s)/spec or the basename
 *  carries a .test./.spec./_test. marker. */
function isTestPath(path: string): boolean {
  return (
    /(^|\/)(tests?|spec|__tests__)(\/|$)/i.test(path) ||
    /\.(test|spec)\./i.test(path) ||
    /_test\./i.test(path)
  )
}

const NON_SOURCE = /\.(md|markdown|txt|json|ya?ml|toml|lock|cfg|ini)$/i

// reviewer.tests — flags source/behavior changes that ship without test
// additions. A real reviewer would assess coverage depth; the stub flags the
// coarse "you touched source but added no test file" smell.
export function reviewerTests(
  input: ReviewerSpecialistInput,
): ReviewerSpecialistOutput {
  const paths = changedFilePaths(input.diff ?? "")
  const sourceChanged = paths.filter(
    (p) => !isTestPath(p) && !NON_SOURCE.test(p),
  )
  const testChanged = paths.filter((p) => isTestPath(p))
  if (sourceChanged.length > 0 && testChanged.length === 0) {
    const findings: Finding[] = [
      {
        description: `source/behavior change without test additions: ${sourceChanged
          .slice(0, 5)
          .join(", ")}`,
      },
    ]
    return { verdict: "concern", severity: "medium", findings }
  }
  return { verdict: "pass", severity: "none", findings: [] }
}

// reviewer.maintainability — readability/complexity smells on added lines.
// Advisory (severity low): long lines + suppression/escape-hatch markers.
const MAINT_MARKERS = /(TODO|FIXME|@ts-ignore|@ts-nocheck|eslint-disable|\bas any\b)/
const MAX_LINE = 120

export function reviewerMaintainability(
  input: ReviewerSpecialistInput,
): ReviewerSpecialistOutput {
  const findings: Finding[] = []
  for (const raw of addedLines(input.diff ?? "")) {
    const line = raw.slice(1) // drop leading '+'
    if (line.length > MAX_LINE) {
      findings.push({
        description: `long added line (${line.length} > ${MAX_LINE} chars): ${line.slice(0, 80).trim()}`,
      })
    }
    if (MAINT_MARKERS.test(line)) {
      findings.push({
        description: `maintainability marker in added line: ${line.slice(0, 120).trim()}`,
      })
    }
  }
  const severity: Severity = findings.length > 0 ? "low" : "none"
  const verdict: Verdict = findings.length > 0 ? "concern" : "pass"
  return { verdict, severity, findings }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/reviewer-quality.test.ts`
Expected: PASS (9 tests). Then `bunx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/agents/reviewer-quality.ts tests/dispatcher/reviewer-quality.test.ts
git commit -m "feat(reviewer): add reviewer.tests + reviewer.maintainability heuristics"
```

---

## Task 2: Flip manifest entries to `implemented`

**Files:**
- Modify: `contracts/sgc-capabilities.yaml:372-373`
- Test: `tests/dispatcher/preprocessor.test.ts` (or capabilities.test.ts — see Step 1)

- [ ] **Step 1: Write the failing test**

First grep for any assertion pinning these as slot-only:
`grep -rn "slot-only\|reviewer.tests\|reviewer.maintainability" tests/dispatcher`

Append to `tests/dispatcher/preprocessor.test.ts` (inside the existing capabilities describe block; reuse existing `loadSpec`/`capsYaml` imports — check the file head):

```ts
test("reviewer.tests + reviewer.maintainability are implemented (Phase 2c)", () => {
  const spec = loadSpec<CapabilitiesSpec>(capsYaml)
  expect((spec.subagents["reviewer.tests"] as { status?: string }).status).toBe("implemented")
  expect((spec.subagents["reviewer.maintainability"] as { status?: string }).status).toBe("implemented")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/preprocessor.test.ts -t "are implemented"`
Expected: FAIL — status is `"slot-only"`.

- [ ] **Step 3: Write minimal implementation**

In `contracts/sgc-capabilities.yaml`, change lines 372-373:

```yaml
  reviewer.tests:           { <<: *reviewer_base, prompt_path: null, status: implemented }
  reviewer.maintainability: { <<: *reviewer_base, prompt_path: null, status: implemented }
```

(Remove the `roadmap: "..."` keys; set `status: implemented`. Keep `prompt_path: null`.)

If Step 1's grep found OTHER tests asserting these are `slot-only` (e.g. a "slot-only set" assertion), update those to match the new state — they are now implemented.

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/preprocessor.test.ts`
Expected: PASS. Then `SGC_FORCE_INLINE=1 bun src/sgc.ts doctor` → confirm no NEW failure (doctor allows `status: implemented` + `prompt_path: null`, same as the 4 existing specialists; bundle-parity may fail until Task 6 rebuild — that's expected).

- [ ] **Step 5: Commit**

```bash
git add contracts/sgc-capabilities.yaml tests/dispatcher/preprocessor.test.ts
git commit -m "feat(manifest): mark reviewer.tests + reviewer.maintainability implemented"
```

---

## Task 3: Wire the L2+ cluster into `review.ts`

**Files:**
- Modify: `src/commands/review.ts`
- Test: `tests/dispatcher/sgc-review.test.ts`

READ `src/commands/review.ts` fully first. Key anchors: `reviewer.correctness` spawn (~line 183), the `if (level === "L3")` specialist block (~line 220), `worstVerdict` (line 151), `appendReview` usage.

- [ ] **Step 1: Write the failing test**

Append to `tests/dispatcher/sgc-review.test.ts` (inside `describe("runReview — full flow")`; reuse existing imports — `runPlan`, `runReview`, `readReview`; `LONG_MOTIVATION` is already defined):

```ts
test("L1 review spawns ONLY reviewer.correctness (no quality/specialists)", async () => {
  await runPlan("simple change", { stateRoot: tmp, motivation: LONG_MOTIVATION, log: () => {} })
  await runReview({ stateRoot: tmp, diffOverride: "diff --git a/src/x.ts b/src/x.ts\n+++ b/src/x.ts\n+const ok = 1\n", log: () => {} })
  const promptsDir = resolve(tmp, "progress", "agent-prompts")
  const prompts = readdirSync(promptsDir)
  expect(prompts.some((f) => f.includes("reviewer.correctness"))).toBe(true)
  expect(prompts.some((f) => f.includes("reviewer.tests"))).toBe(false)
  expect(prompts.some((f) => f.includes("reviewer.maintainability"))).toBe(false)
})

test("L2 review spawns the quality trio + matched specialist", async () => {
  const plan = await runPlan("add OAuth token refresh to the public API client", {
    stateRoot: tmp, forceLevel: "L2", motivation: LONG_MOTIVATION, log: () => {},
  })
  const r = await runReview({
    stateRoot: tmp,
    // auth keyword → security specialist; source-only → tests concern
    diffOverride: "diff --git a/src/auth.ts b/src/auth.ts\n+++ b/src/auth.ts\n+const token = signJwt(user)\n",
    log: () => {},
  })
  const prompts = readdirSync(resolve(tmp, "progress", "agent-prompts"))
  for (const name of ["reviewer.correctness", "reviewer.tests", "reviewer.maintainability", "reviewer.security"]) {
    expect(prompts.some((f) => f.includes(name))).toBe(true)
  }
  // tests reviewer flags source-without-test → aggregate at least concern
  expect(["concern", "fail"]).toContain(r.verdict)
  expect(readReview(plan.taskId, "code", "reviewer.tests", tmp)?.report.verdict).toBe("concern")
})

test("L3 review still spawns correctness + quality + specialists (regression)", async () => {
  await runPlan("add a database migration to rename a column on the orders table", {
    stateRoot: tmp, forceLevel: "L3",
    userSignature: { signed_at: "2026-06-03T00:00:00Z", signer_id: "alice" },
    readConfirmation: async () => "yes", motivation: LONG_MOTIVATION, log: () => {},
  })
  await runReview({
    stateRoot: tmp,
    diffOverride: "diff --git a/db/m.sql b/db/m.sql\n+++ b/db/m.sql\n+ALTER TABLE orders RENAME COLUMN a TO b;\n",
    log: () => {},
  })
  const prompts = readdirSync(resolve(tmp, "progress", "agent-prompts"))
  for (const name of ["reviewer.correctness", "reviewer.tests", "reviewer.maintainability", "reviewer.migration"]) {
    expect(prompts.some((f) => f.includes(name))).toBe(true)
  }
})
```

NOTE: confirm the agent-prompt files land under `progress/agent-prompts/` with the reviewer name in the filename (the planner-adversarial/researcher tests use this same `progress/agent-prompts` + `f.includes(name)` pattern — mirror exactly what they do; adjust the dir/path if those tests use a different location).

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/sgc-review.test.ts -t "L2 review spawns"`
Expected: FAIL — reviewer.tests/maintainability/security prompts absent at L2 (only correctness spawns today).

- [ ] **Step 3: Write minimal implementation**

In `src/commands/review.ts`:

(a) Add the quality-agent imports near the specialist import (after the `reviewer-specialists` import ~line 33):

```ts
import {
  reviewerTests,
  reviewerMaintainability,
} from "../dispatcher/agents/reviewer-quality"
```

(b) After the `reviewer.correctness` report is appended + logged (~line 216, before the `// L3 diff-conditional specialist cluster` comment), insert the L2+ quality trio. Define a small helper inline to avoid repeating the spawn+append boilerplate, OR inline two spawns. Use this block:

```ts
  // Phase 2c: L2+ always-on quality reviewers (tests + maintainability) +
  // lowered specialist gate. L1 stays correctness-only. Reviewers receive the
  // already-stripped intentForReviewer (Invariant §1) and hold no read:solutions.
  const isL2Plus = level === "L2" || level === "L3"
  const clusterReports: SpecialistReportRef[] = []

  async function runClusterReviewer(
    name: string,
    agent: (i: { diff: string; intent: string }) => ReviewerSpecialistOutput,
  ): Promise<void> {
    const res = await spawn<unknown, ReviewerSpecialistOutput>(
      name,
      { diff, intent: intentForReviewer },
      { stateRoot, inlineStub: (i) => agent(i as { diff: string; intent: string }), logger, taskId },
    )
    const report: ReviewReport = {
      report_id: generateReportId(),
      task_id: taskId,
      stage: "code",
      reviewer_id: name,
      reviewer_version: "0.1",
      verdict: res.output.verdict,
      severity: res.output.severity,
      findings: res.output.findings,
      created_at: nowIso(),
    }
    const path = appendReview(report, "", stateRoot, opts.appendAs)
    clusterReports.push({
      reviewerId: name,
      verdict: res.output.verdict,
      severity: res.output.severity,
      reportPath: path,
      findingsCount: res.output.findings.length,
    })
    log(`${name}: ${res.output.verdict} (severity: ${res.output.severity}, ${res.output.findings.length} finding(s))`)
  }

  if (isL2Plus) {
    await runClusterReviewer("reviewer.tests", reviewerTests)
    await runClusterReviewer("reviewer.maintainability", reviewerMaintainability)
  }
```

NOTE: `ReviewerSpecialistOutput` is already imported (line 32-33 region) from `reviewer-specialists`; ensure it's in the import list. `SpecialistReportRef`, `ReviewReport`, `generateReportId`, `nowIso`, `appendReview`, `intentForReviewer`, `diff` are all already in scope.

(c) Change the specialist gate from L3-only to L2+. Find `if (level === "L3") {` (~line 220) and change it to:

```ts
  if (isL2Plus) {
```

The body (matchSpecialists + parallel spawn + appendReview, pushing into `specialistReports`) is UNCHANGED.

(d) Fold the quality-trio reports into the aggregate verdict + the final summary. Find the aggregate (line ~272):

```ts
  const aggregateVerdict = worstVerdict([
    correctnessReport.verdict,
    ...specialistReports.map((s) => s.verdict),
  ])
```

Change to include `clusterReports`:

```ts
  const aggregateVerdict = worstVerdict([
    correctnessReport.verdict,
    ...clusterReports.map((s) => s.verdict),
    ...specialistReports.map((s) => s.verdict),
  ])
```

Also update the returned `specialistReports` to include the quality trio so callers see the full cluster — change the `return` to spread both:

```ts
  return { taskId, verdict: aggregateVerdict, reportPath, specialistReports: [...clusterReports, ...specialistReports] }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/sgc-review.test.ts`
Expected: PASS — new L1/L2/L3 tests pass AND all existing tests pass. Pay special attention to the **W3 test** (`Invariant §1 back-channel`, ~line 143): it runs an L2 task, so it now spawns the quality trio + security specialist too. It asserts the prior-art/pre-mortem is stripped from reviewer input — the strip applies to ALL reviewers (they all receive `intentForReviewer`), so it should still pass. If W3 asserts a specific report's content or a spawn count, update it to the new cluster behavior (the §1 stripping guarantee is unchanged — that is the property under test). Run `bunx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/commands/review.ts tests/dispatcher/sgc-review.test.ts
git commit -m "feat(review): wire L2+ quality trio + lower specialist gate to L2+"
```

---

## Task 4: Update README + POSITIONING

**Files:**
- Modify: `README.md:125` (the level table L2 row) + `README.md:86,102` (the `sgc review` one-liners if they say "reviewer.correctness")
- Modify: `docs/POSITIONING.md:28` (Independent review row)

- [ ] **Step 1: Update the docs (no test — docs only, verified by reading)**

In `README.md`, the level table row for **L2** (line ~125) currently reads:
```
| **L2** | Multi-file / behavior change / new tests | + planner.ceo + researcher.history | Reviewer cluster | No |
```
Make the "Reviewer cluster" cell specific:
```
| **L2** | Multi-file / behavior change / new tests | + planner.ceo + researcher.history | correctness + tests + maintainability + conditional specialists | No |
```
Also check `README.md:86` and `README.md:102` — if they describe `sgc review` as only `reviewer.correctness`, update to note the L2+ cluster (e.g. "reviewer.correctness at L1; full cluster at L2+"). Keep claims honest and specific.

In `docs/POSITIONING.md:28`, the row:
```
| Independent review | `sgc review` (reviewer cluster) | `gs:/review` |
```
Make it accurate:
```
| Independent review | `sgc review` (native L2+ cluster: correctness + tests + maintainability + conditional specialists) | `gs:/review` |
```

- [ ] **Step 2: Verify by reading**

Run: `grep -n "Reviewer cluster\|reviewer.correctness\|reviewer cluster\|correctness + tests" README.md docs/POSITIONING.md`
Expected: the L2 row + POSITIONING row now enumerate the cluster; no stale "only correctness at L2" claim remains.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/POSITIONING.md
git commit -m "docs: README + POSITIONING reflect the native L2 reviewer cluster"
```

---

## Task 5: Full both-lane suite + eval-lane regression sweep

**Files:** (test-only fixes if regressions surface)

- [ ] **Step 1: Run both lanes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher tests/eval 2>&1 | tail -40`

The L2/L3 behavior change may break assertions in `tests/eval/` (the test-lane-divergence trap). Likely suspects: the L2 cross-file scenario and the **reviewer-isolation** scenario (it drives `runReview` at L2/L3 and may assert a specific reviewer set or verdict). Grep: `grep -rn "runReview\|reviewer\.\|verdict\|reviewer-isolation" tests/eval`.

- [ ] **Step 2: Fix real regressions (test-only)**

For any eval-lane test that asserts the OLD review behavior (L2 = correctness only, or specialists L3-only), update it to the new cluster behavior. The **reviewer-isolation** scenario's core property — reviewers can't read solutions (§1) — must STILL hold; if it now spawns more reviewers, verify each is amnesiac (receives stripped intent, no read:solutions) and update any count/verdict assertion. Do NOT weaken the §1 property. Distinguish real assertion regressions from the known `*-llm.test.ts` local-flaky failures (note those separately).

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit (if fixes were made)**

```bash
git add tests/eval
git commit -m "test: sync eval-lane review assertions for the L2+ cluster"
```
(Skip the commit if Step 2 found no regressions.)

---

## Task 6: Version bump, CHANGELOG, bundle rebuild

**Files:**
- Modify: `package.json` + `plugins/sgc/.claude-plugin/plugin.json` (lockstep) + `CHANGELOG.md`
- Rebuild: `plugins/sgc/bin/sgc.mjs`

- [ ] **Step 1: Bump version + CHANGELOG**

Bump `package.json` `version` and `plugins/sgc/.claude-plugin/plugin.json` `version` in lockstep to **1.27.0** (current is 1.26.0). Add a CHANGELOG.md entry under a new `## [1.27.0]` heading (match existing voice — read the most recent entry first): native L2 reviewer cluster (Phase 2c) — `sgc review` at L2+ runs correctness + tests + maintainability (new heuristic agents) + diff-conditional specialists (gate lowered L3→L2+); reviewers stay amnesiac (§1); makes the README L2 "Reviewer cluster" claim true. NO baseless superlatives.

- [ ] **Step 2: Rebuild bundle**

Run: `npm run build:cli`
Then: `git add --chmod=+x plugins/sgc/bin/sgc.mjs`

- [ ] **Step 3: Verify bundle runs + parity**

Run: `node plugins/sgc/bin/sgc.mjs --help` → exitCode 0, no error (runtime guard, not just SHA parity).
Run: `SGC_FORCE_INLINE=1 bun src/sgc.ts doctor` → 0 fail (bundle parity green post-rebuild).
Run: `bunx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add package.json plugins/sgc/.claude-plugin/plugin.json CHANGELOG.md plugins/sgc/bin/sgc.mjs
git commit -m "feat: native L2 reviewer cluster (Phase 2c) — v1.27.0 bundle"
```

(Release/tag is a separate operator step — NOT part of this plan. main-direct + `v1.27.0` tag → publish.yml; verify `npm view @sdsrs/sgc@1.27.0 dist.shasum`.)

---

## Notes & known degradations (carry into review)

- **Heuristic depth:** `reviewer.tests` only catches the coarse "source touched, no test file touched" smell — it does not assess coverage depth or whether the test actually exercises the change. `reviewer.maintainability` is advisory (severity low). The real depth is the LLM path's job (synthesized prompt); tests assert the heuristic structure only.
- **L2 strictness shift:** at L2, a source-only diff now yields a `concern` from `reviewer.tests` (was `pass` with correctness-only). This is intended — L2 is "behavior change / new tests", so shipping source without tests is a legitimate concern. Operators override per the existing reviewer-fail override (Invariant §5, human signature + reason).
- **CE closure = evaluator gate** (spec non-goal): no review→prevention capture; reviewers never read/write `solutions/`. §1 amnesia preserved.
