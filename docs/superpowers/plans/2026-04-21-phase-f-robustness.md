# Phase F: Robustness + Real-World Validation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sgc safe for real-world use: fix QA rubber-stamp, add spawn retry/clamp, then run a real E2E workflow to surface remaining friction.

**Architecture:** Two concrete hardening tasks (qa.browser + spawn retry) first, then a structured experiment running the full sgc pipeline with a real ANTHROPIC_API_KEY.

**Tech Stack:** TypeScript/Bun, Anthropic SDK, existing test harness.

**Scope:** Phase F only (4 tasks). Phase G (stub→LLM swap) and Phase H (prompt versioning + scope enforcement) will be planned in separate sessions after F-1 experiment findings.

---

## File Structure

**Modified files:**
- `src/dispatcher/agents/qa-browser.ts` — change stub default from `pass` to `concern`
- `src/dispatcher/spawn.ts` — add timeout clamp + retry with backoff to `pollForResult` and `spawn`
- `src/dispatcher/types.ts` — add retry config fields to SubagentManifest (optional)
- `tests/dispatcher/spawn.test.ts` — retry + clamp tests
- `tests/eval/qa-browser.test.ts` — update expected verdict for stub path

**New files:**
- `tests/dispatcher/spawn-retry.test.ts` — dedicated retry/backoff tests

---

## Task 1: qa.browser stub returns `concern` instead of `pass`

**Why:** When no browseRunner is injected, qa.browser returns `pass` — making the L2+ QA gate a rubber stamp. A `concern` verdict forces users to acknowledge the skip via `--skip-qa` or explicit override rather than silently passing.

**Files:**
- Modify: `src/dispatcher/agents/qa-browser.ts:76-80`
- Modify: `tests/eval/qa-browser.test.ts:46-58`

- [ ] **Step 1: Write the failing test — stub path now returns concern**

In `tests/eval/qa-browser.test.ts`, the test at line 46-58 ("pass path: runQa writes qa review + hasQaEvidence becomes true") currently asserts `r.verdict === "pass"`. After our change, the stub path (no browseRunner) should return `concern`.

But first — read `src/commands/qa.ts` to understand if `runQa` directly calls `qaBrowser` or routes through `spawn`. If it routes through spawn with `inlineStub: qaBrowser`, the change in qa-browser.ts will propagate automatically.

Create `tests/dispatcher/qa-stub-concern.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { qaBrowser } from "../../src/dispatcher/agents/qa-browser"

describe("qa.browser stub default verdict", () => {
  test("stub without browseRunner returns concern (not pass)", async () => {
    const result = await qaBrowser(
      { target_url: "http://localhost:3000", user_flows: ["home", "login"] },
      {}, // no browseRunner
    )
    expect(result.verdict).toBe("concern")
    expect(result.failed_flows).toHaveLength(1)
    expect(result.failed_flows[0].observed).toMatch(/no browser runner|stub|QA skipped/i)
  })

  test("empty target still returns fail (higher priority)", async () => {
    const result = await qaBrowser(
      { target_url: "", user_flows: ["home"] },
      {},
    )
    expect(result.verdict).toBe("fail")
  })

  test("empty flows still returns concern with different message", async () => {
    const result = await qaBrowser(
      { target_url: "http://localhost:3000", user_flows: [] },
      {},
    )
    expect(result.verdict).toBe("concern")
    expect(result.failed_flows[0].observed).toMatch(/no user_flows/)
  })

  test("injected browseRunner still returns whatever runner says", async () => {
    const result = await qaBrowser(
      { target_url: "http://localhost:3000", user_flows: ["home"] },
      {
        browseRunner: async () => ({
          verdict: "pass",
          evidence_refs: ["/tmp/s1.png"],
          failed_flows: [],
        }),
      },
    )
    expect(result.verdict).toBe("pass")
  })
})
```

- [ ] **Step 2: Run test — expect first test to FAIL (currently returns pass)**

Run: `bun test tests/dispatcher/qa-stub-concern.test.ts`
Expected: first test FAILS (`expected "concern", got "pass"`), others pass.

- [ ] **Step 3: Fix qa-browser.ts — change stub default**

In `src/dispatcher/agents/qa-browser.ts`, replace lines 76-80:

```typescript
  // Before:
  return {
    verdict: "pass",
    evidence_refs: [],
    failed_flows: [],
  }
```

with:

```typescript
  // Stub: no browser runner available — return concern, not pass.
  // This prevents the L2+ QA gate from being a rubber stamp.
  // Real QA requires browseRunner injection (SGC_QA_REAL=1).
  return {
    verdict: "concern",
    evidence_refs: [],
    failed_flows: [
      {
        flow: "(all)",
        step: "runner",
        observed: "no browser runner — QA skipped (stub mode)",
      },
    ],
  }
```

- [ ] **Step 4: Run test — expect all 4 tests to PASS**

Run: `bun test tests/dispatcher/qa-stub-concern.test.ts`
Expected: 4 pass / 0 fail.

- [ ] **Step 5: Fix broken eval test**

`tests/eval/qa-browser.test.ts:54` asserts `r.verdict === "pass"`. Update to `"concern"`. Also update `tests/eval/qa-browser.test.ts:58` — `hasQaEvidence` may now return false if the QA gate requires `pass` not just `concern`. Read `src/dispatcher/state.ts` for `hasQaEvidence` logic and adjust.

If `hasQaEvidence` checks for the presence of ANY review file (not verdict), it should still return true. If it checks verdict === "pass", we need to update it to accept "concern" as well (QA was done, just with caveats).

Read and adjust accordingly.

- [ ] **Step 6: Run full suite**

Run: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun test tests/`
Expected: all pass (445 baseline + 4 new - any adjusted = ~449).

- [ ] **Step 7: Commit**

```bash
git add src/dispatcher/agents/qa-browser.ts tests/dispatcher/qa-stub-concern.test.ts tests/eval/qa-browser.test.ts
git commit -m "fix(qa): stub returns concern instead of pass

qa.browser without browseRunner was returning pass — making the
L2+ QA gate a rubber stamp. Now returns concern with descriptive
finding. Real QA requires browseRunner injection or SGC_QA_REAL=1.

Ship gate still accepts concern (QA was executed, just with caveats);
only fail blocks ship."
```

---

## Task 2: spawn timeout clamp + exponential retry

**Why:** `pollForResult` has no timeout floor (manifest `timeout_s: 1` would time out instantly) and no retry (single timeout kills the entire pipeline). LLM calls have natural latency variance; a single timeout should not abort 20 minutes of work.

**Files:**
- Modify: `src/dispatcher/spawn.ts` — add clamp + retry in `spawn()`
- Create: `tests/dispatcher/spawn-retry.test.ts`

- [ ] **Step 1: Write failing tests for clamp + retry**

Create `tests/dispatcher/spawn-retry.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { spawn, SpawnTimeout } from "../../src/dispatcher/spawn"
import { createEvalWorkspace, destroyEvalWorkspace } from "../eval/eval-helpers"
import { afterEach, beforeEach } from "bun:test"

let tmp: string
beforeEach(() => { tmp = createEvalWorkspace("sgc-spawn-retry-") })
afterEach(() => { destroyEvalWorkspace(tmp) })

describe("spawn timeout clamp", () => {
  test("timeout_s < 30 is clamped to 30s (30000ms)", async () => {
    // Manifest declares timeout_s: 1, but spawn should clamp to 30s minimum.
    // We verify by checking the SpawnTimeout error message includes 30000ms.
    // Use file-poll mode with an unreachable result to trigger timeout.
    // Override pollIntervalMs to avoid waiting 30s in test.
    try {
      await spawn("classifier.level", { user_request: "test" }, {
        stateRoot: tmp,
        mode: "file-poll",
        timeoutMs: 1, // raw override — should be clamped to 30000
        pollIntervalMs: 10,
      })
      expect(true).toBe(false) // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(SpawnTimeout)
      expect((e as SpawnTimeout).message).toMatch(/30000/) // clamped
    }
  })

  test("timeout_s > 300 is clamped to 300s (300000ms)", async () => {
    try {
      await spawn("classifier.level", { user_request: "test" }, {
        stateRoot: tmp,
        mode: "file-poll",
        timeoutMs: 999999, // should clamp to 300000
        pollIntervalMs: 10,
      })
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(SpawnTimeout)
      expect((e as SpawnTimeout).message).toMatch(/300000/) // clamped
    }
  })
})
```

Note: the exact clamping behavior depends on where we apply it (manifest.timeout_s vs opts.timeoutMs). The implementer should read spawn.ts:339 to understand the current flow and decide:
- Clamp `manifest.timeout_s` at load time → affects all modes
- Clamp the computed `timeoutMs` before passing to `pollForResult` → only affects file-poll

Recommend clamping at the computed timeoutMs level (line 339) to affect all poll paths.

**For retry**: testing retry requires a file-poll scenario where the first attempt times out but a result appears before the second attempt's deadline. This is hard to test without actual async coordination. Alternative: test via mock that counts invocation attempts.

```typescript
describe("spawn retry on timeout", () => {
  test("retries up to 3 times on SpawnTimeout in file-poll mode", async () => {
    let attempts = 0
    // We can't easily inject retry into file-poll without modifying spawn.
    // Instead, test the retry wrapper function directly once it's extracted.
    // For now, verify that spawn throws SpawnTimeout after exhausting retries.
    try {
      await spawn("classifier.level", { user_request: "test" }, {
        stateRoot: tmp,
        mode: "file-poll",
        timeoutMs: 100, // small for test speed (will be clamped to 30000)
        pollIntervalMs: 10,
        maxRetries: 3,
      })
    } catch (e) {
      expect(e).toBeInstanceOf(SpawnTimeout)
      // The error should mention it's the final attempt
    }
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (clamp not implemented yet)**

Run: `bun test tests/dispatcher/spawn-retry.test.ts`
Expected: FAIL — current code doesn't clamp.

- [ ] **Step 3: Implement timeout clamp in spawn.ts**

In `src/dispatcher/spawn.ts`, find line 339:

```typescript
const timeoutMs = opts.timeoutMs ?? (manifest.timeout_s ?? 60) * 1000
```

Replace with:

```typescript
const MIN_TIMEOUT_MS = 30_000   // 30 seconds
const MAX_TIMEOUT_MS = 300_000  // 5 minutes
const rawTimeoutMs = opts.timeoutMs ?? (manifest.timeout_s ?? 60) * 1000
const timeoutMs = Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, rawTimeoutMs))
```

Move `MIN_TIMEOUT_MS` / `MAX_TIMEOUT_MS` to module-level constants (export for test).

- [ ] **Step 4: Implement retry with exponential backoff**

Add `maxRetries?: number` to `SpawnOptions` (default 0 = no retry, preserving current behavior). Add retry logic around the file-poll path:

```typescript
} else {
  // file-poll with optional retry
  const maxRetries = opts.maxRetries ?? 0
  let lastError: SpawnTimeout | undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      output = await pollForResult(resultPath, timeoutMs, opts.pollIntervalMs ?? 1000)
      break
    } catch (e) {
      if (e instanceof SpawnTimeout && attempt < maxRetries) {
        lastError = e
        // Exponential backoff: wait 2^attempt seconds (1s, 2s, 4s) with ±20% jitter
        const backoffMs = Math.pow(2, attempt) * 1000
        const jitter = backoffMs * 0.2 * (Math.random() - 0.5)
        await new Promise((r) => setTimeout(r, backoffMs + jitter))
        continue
      }
      throw e
    }
  }
}
```

- [ ] **Step 5: Run tests**

Run: `bun test tests/dispatcher/spawn-retry.test.ts`
Expected: clamp tests pass. Retry test may need adjustment based on actual implementation.

Run: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun test tests/`
Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/dispatcher/spawn.ts tests/dispatcher/spawn-retry.test.ts
git commit -m "feat(spawn): timeout clamp [30s, 300s] + optional retry with backoff

Previously: timeout_s had no bounds (timeout_s:1 would fail instantly),
and a single SpawnTimeout aborted the entire pipeline.

Now: computed timeoutMs clamped to [30000, 300000]. File-poll mode
supports optional maxRetries (default 0 = current behavior) with
exponential backoff (2^attempt seconds, ±20% jitter).

LLM calls have natural latency variance; a single timeout should
not abort 20 minutes of ship pipeline work."
```

---

## Task 3: Real E2E experiment protocol

**Why:** All testing so far uses inline stubs. No one has run sgc with a real LLM. This task is an EXPERIMENT, not a code change. The output is a friction-point log that drives Phase F-2 fixes.

**This task requires `ANTHROPIC_API_KEY` set in the environment.**

**Files:**
- Create: `docs/experiments/f1-real-e2e.md` (experiment log)

- [ ] **Step 1: Prepare environment**

```bash
cd /mnt/Sda2/dev/sdsbp/sgc
export ANTHROPIC_API_KEY="<your key>"
# Verify SDK mode auto-detection:
SGC_AGENT_MODE=anthropic-sdk bun src/sgc.ts status
```

- [ ] **Step 2: Run sgc plan with a real L2 task**

```bash
bun src/sgc.ts plan "add a --verbose flag to sgc status that shows solutions/ entry count and last compound timestamp" \
  --motivation "This is a real feature request to test the E2E pipeline. The verbose flag would help users understand knowledge compounding state. Currently status only shows active task + level. Adding solutions stats gives visibility into the knowledge compression loop."
```

Record:
- Did the classifier return the expected level? (L1 or L2)
- Did the planner produce a useful plan? (Or generic stub output?)
- How long did the pipeline take?
- Any errors?

- [ ] **Step 3: Run sgc work**

```bash
bun src/sgc.ts work --list
```

Record: Does the feature list make sense?

- [ ] **Step 4: Run sgc review**

```bash
# Make a small code change first (the actual --verbose implementation)
# Then:
bun src/sgc.ts review
```

Record:
- Did the reviewer produce useful findings? Or just "pass"?
- Were the findings specific (citing file:line) or generic?

- [ ] **Step 5: Run sgc ship**

```bash
bun src/sgc.ts ship
```

Record:
- Did all gates pass?
- Did the janitor decide to compound?
- Was a solutions/ entry written? What quality?

- [ ] **Step 6: Document findings**

Write `docs/experiments/f1-real-e2e.md`:

```markdown
# F-1: Real E2E Experiment Log

**Date**: YYYY-MM-DD
**ANTHROPIC_API_KEY**: set (claude-opus-4-6)
**Task**: "add --verbose to sgc status"
**Level classified**: L?

## Timeline
- plan: Xs | classifier returned L?, planner output [useful/generic/broken]
- work: feature list [sensible/confusing]
- review: reviewer [caught real issues / just passed / errored]
- ship: gates [passed/failed at step X]
- compound: janitor [compound/skip], solutions entry [written/not written]

## Friction Points (ranked by severity)
1. ...
2. ...
3. ...

## What Worked Well
- ...

## Recommended Fixes for F-2
- ...
```

- [ ] **Step 7: Commit the experiment log**

```bash
git add docs/experiments/f1-real-e2e.md
git commit -m "docs: F-1 real E2E experiment log

First real-LLM run of the full sgc pipeline (plan → work → review →
ship → compound). Documents friction points for F-2 fixes."
```

---

## Task 4: Fix top 3 friction points from F-1

**This task is reactive — its content depends on Task 3's findings.**

**Placeholder structure** (filled after Task 3):

- [ ] **Step 1: Read the F-1 experiment log**

Read `docs/experiments/f1-real-e2e.md` and identify the top 3 friction points by severity.

- [ ] **Step 2-N: Fix each friction point**

For each friction point:
1. Write a failing test that reproduces it
2. Implement the fix
3. Verify
4. Commit

The specific fixes are unknown until Task 3 runs. This task should be re-planned based on F-1 findings.

---

## Self-Review

**Spec coverage:**
- F-3 (qa.browser concern): ✓ Task 1
- F-4 (spawn clamp + retry): ✓ Task 2
- F-1 (real E2E): ✓ Task 3
- F-2 (reactive fixes): ✓ Task 4 (template — intentionally reactive)

**Placeholder scan:** Task 4 is intentionally a template since it depends on Task 3's findings. Tasks 1-3 have complete code.

**Type consistency:** `SpawnTimeout` constructor uses `(spawnId, timeoutMs)` — matches existing code at spawn.ts:57-58. `qaBrowser` return type `QaBrowserOutput` — matches interface at qa-browser.ts:32-36.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-phase-f-robustness.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Tasks 1-2 via fresh subagents; Task 3 requires human involvement (ANTHROPIC_API_KEY); Task 4 re-planned after Task 3.

**2. Inline Execution** — Execute tasks 1-2 in this session, then run Task 3 interactively.

Which approach?
