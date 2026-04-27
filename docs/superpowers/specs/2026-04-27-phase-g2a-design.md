# Phase G.2.a — planner.eng LLM swap (Design Spec)

**Status**: Draft (pending execution)
**Date**: 2026-04-27
**Parent**: `docs/superpowers/specs/2026-04-24-phase-g-design.md` §6
**Depends on**: G.1.a (events.ndjson + Logger + Invariant §13 Tier 2) and G.1.b (`sgc tail`) — both merged at HEAD `0ae7c05`.
**Blocks**: G.2.b (compound.context LLM swap), G.3 (E2E + dogfooding).

---

## 1. Goal

Swap `planner.eng` from a length-check stub to a real LLM agent that produces substantive `structural_risks` from `intent_draft` alone. Mirror the LLM-swap pattern Phase F applied to `classifier.level` and `reviewer.correctness`. No `repo_map`, no tool-use loop — those are out of scope per parent §2 and §6.3.

This sub-spec exists because Phase G.2.a opens two design surfaces the parent spec sketched but did not nail down: the actual prompt text (parent §6.5 was a draft), and the drift/quality test harness (parent §6.7 set thresholds without committing to a verdict mechanism). Both are settled below.

## 2. Scope (in / out)

**In**:
- Drop `repo_map?: string` from `PlannerEngInput` (parent §6.3 resolution).
- Add `prompt_path: prompts/planner-eng.md` to manifest, drop `repo_map` from manifest `inputs:` to keep YAML+TS aligned.
- Rename `plannerEng` → `plannerEngHeuristic`; expose `export const plannerEng = plannerEngHeuristic` for backwards compat.
- Author `prompts/planner-eng.md` (zero-shot + `## Anti-patterns` section; full text in §4).
- Author `tests/dispatcher/planner-eng.test.ts` (NEW; current repo has no such file — parent §6.7 says "expand" but the file does not exist).
- Author `tests/eval/planner-eng-llm.test.ts` (NEW, CI-skipped via `describe.skipIf(!ANTHROPIC_API_KEY)`).

**Out**:
- `planner.adversarial.repo_map` — same field exists at `src/dispatcher/agents/planner-adversarial.ts:10` and `contracts/sgc-capabilities.yaml:285`; this sub-spec leaves both untouched.
- Heuristic body changes — `plannerEngHeuristic` keeps the current trivial body (length check + always `approve`). 500+ tests using `SGC_FORCE_INLINE=1` continue byte-identical.
- LLM tool-use loop (autonomous Read/Grep from inside `planner.eng`). Parent §6.3 already deferred this; if eval shows the no-context version underperforms in G.3 dogfooding, tool-use becomes its own design problem, not a G.2.a scope expansion.
- Few-shot examples in the prompt — explicitly rejected (see §8 decision log Q2).
- Real-LLM judge or snapshot scoring for the eval test — explicitly rejected (see §8 decision log Q1).

## 3. Mechanical layer

### 3.1 Contract change — `src/dispatcher/agents/planner-eng.ts`

```typescript
// before
export interface PlannerEngInput {
  intent_draft: string
  repo_map?: string
}

// after
export interface PlannerEngInput {
  intent_draft: string
}
```

`PlannerEngOutput` is unchanged.

### 3.2 Heuristic rename + alias

```typescript
export function plannerEngHeuristic(input: PlannerEngInput): PlannerEngOutput {
  const len = input.intent_draft.length
  return {
    verdict: "approve",
    concerns:
      len < 20
        ? ["intent_draft is very short; consider clarifying motivation"]
        : [],
    structural_risks: [],
  }
}

/** Backward-compat alias. */
export const plannerEng = plannerEngHeuristic
```

Behavior is byte-identical to pre-rename. Mirrors `classifier-level.ts` and `reviewer-correctness.ts` patterns (Phase F).

### 3.3 Manifest change — `contracts/sgc-capabilities.yaml`

Under `subagents.planner.eng` (currently lines 265-278):

```yaml
planner.eng:
  version: "0.1"
  source: gstack/plan-eng-review (re-authored)
  purpose: Architecture gate — "will this break later?"
  prompt_path: prompts/planner-eng.md          # NEW
  inputs:
    intent_draft: markdown
    # repo_map: string                         # REMOVED
  outputs:
    verdict: enum[approve, revise, reject]
    concerns: array[string]
    structural_risks: array[{area, risk, mitigation}]
  scope_tokens: ["read:decisions", "read:progress", "exec:git:read"]
  token_budget: 4000
  timeout_s: 120
```

`scope_tokens` retains `exec:git:read` for forward-compat with a future tool-use loop; agent does not use it in this phase.

### 3.4 `src/commands/plan.ts` — no-op

Already passes `{ intent_draft: taskDescription }` only at line 175 (L2/L3 cluster) and line 245 (L1 path). Zero diff.

### 3.5 `src/dispatcher/spawn.ts` — no-op

`resolveMode()` (line 148) auto-routes to `anthropic-sdk` / `openrouter` when `manifest.prompt_path` is set and the corresponding API key exists. Phase F validated this path. Zero diff.

## 4. Prompt template (`prompts/planner-eng.md`)

Full text. Cache-stable prefix terminates at the `## Input` heading (~70 lines, ~3 KB; well within `cache_control` budget). `<input_yaml/>` placeholder is mandatory — `spawn.ts:246-253` rejects templates missing it or `## Input`.

```markdown
# Purpose

Assess the intent_draft for structural risks before implementation begins.

Your job is NOT to write the implementation plan — that is the user's
job during /work. Your job IS to flag risks the user should know before
committing to this task.

## Scope

- Token scope: read:progress, read:decisions
- Forbidden: read:solutions (planner-adjacent isolation — do not
  consult past answers)
- Allowed outputs: verdict, concerns, structural_risks

## Your analysis

1. Reason from intent_draft alone. You do NOT have a repo map. Do not
   invent specific file paths, function names, or symbol names. Module-
   type names (e.g. "auth middleware", "migration runner") are fine;
   concrete `src/foo/bar.ts` paths are not.

2. Flag structural risks in terms of module types / patterns. Common
   shapes to look for:
   - Missing test coverage typical for changes of this shape (e.g.
     migrations usually lack rollback tests)
   - Cross-module coupling (auth + payment tasks usually touch ≥ 3
     boundaries; logging changes hit every command site)
   - Schema / API contract implications not mentioned in intent
   - Parallel paths needing matched updates: fallback arms, feature
     flags, SQL `ORDER BY` + `LIMIT` pairs, multi-dispatch tables,
     try/catch-and-rethrow chains

3. Return verdict:
   - `approve` — intent is well-scoped, risks are tractable, no
     blocking gap
   - `revise` — intent is missing motivation, scope, or success
     criteria the user should add before /work
   - `reject` — intent is fundamentally off-target (asks for the
     wrong thing, conflicts with stated constraints)

## Anti-patterns: do NOT output

1. **Design alternatives.** You are not brainstorming. Output that
   reads "here are 3 ways to approach this" has drifted into pre-spec
   territory and is wrong. Stay on RISKS, not solutions.

2. **L0 / L1 over-flagging.** If intent is a typo, comment edit,
   formatting change, or a single-file local fix with no contract
   touch, return `verdict: approve` with `structural_risks: []`.
   Inventing risks where none exist is itself a failure mode.

3. **Banned vocabulary in output strings.** `concerns`, `area`, `risk`,
   `mitigation` must NOT contain:
   - English: `could potentially`, `may break`, `might affect`, `various
     concerns`, `several issues`, `generally`, `overall`, `seems to`,
     `production-ready`, `comprehensive`, `robust`
   - 中文: `显著`, `大幅`, `基本上`, `大部分情况`, `相当不错`
   These mark vague output. Replace with concrete naming.

4. **Filename invention.** Do not output `src/foo/bar.ts` unless the
   intent literally names that path.

### Bad / good contrast

```yaml
# bad — vague, hedged, no specific failure mode
structural_risks:
  - area: auth
    risk: could potentially affect login
    mitigation: ensure tests are added

# good — names a concrete failure mode + concrete action
structural_risks:
  - area: rate-limit middleware
    risk: bypass via X-Forwarded-For when upstream proxy is unconfigured
    mitigation: pin to direct-peer IP unless allowlist set; add a unit
      test for spoofed-header path
```

## Reply format

```yaml
verdict: approve | revise | reject
concerns:
  - <concern 1, specific>
structural_risks:
  - area: <module type or subsystem>
    risk: <what could break or be missed, specific>
    mitigation: <concrete action the user should take>
```

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
```

**Design notes embedded in the template choice**:

- Anti-pattern #1 enforces parent §13 boundary (planner.eng vs `sp:brainstorming`) at the prompt level, not just the spec level.
- Anti-pattern #2 directly aligns with §5 fixture s1 (L1 typo); the prompt teaches the rule, the eval test enforces it.
- Anti-pattern #3 banned-vocab list is the ground truth for the eval test's `BANNED_VOCAB_RE` (§5.2). Sync rule below in §6.
- The bad/good contrast block is **not few-shot** (does not teach output shape mimicry); it is a negative anchor for specificity. One pair only — multiple examples would risk template overfitting.

## 5. Test harness

### 5.1 Unit-branch — `tests/dispatcher/planner-eng.test.ts` (NEW)

Runs in CI without API keys. Five assertion classes:

| # | Assertion | Mechanism |
|---|---|---|
| U1 | Heuristic byte-compat | `SGC_FORCE_INLINE=1`; assert `plannerEngHeuristic` returns `verdict: "approve"` + length-conditional concerns + `structural_risks: []` for representative inputs |
| U2 | Alias identity | `expect(plannerEng).toBe(plannerEngHeuristic)` |
| U3 | Manifest LLM-routing readiness | `getSubagentManifest("planner.eng").prompt_path === "prompts/planner-eng.md"` |
| U4 | Prompt template structure | `prompts/planner-eng.md` contains `\n## Input\n`, `<input_yaml/>`, `## Anti-patterns`, `do NOT output`, and at least the first banned-vocab term (`could potentially`) |
| U5 | LLM-branch shape + schema-violation | Inject mock `anthropicClientFactory` via `SpawnOptions`; canned-YAML happy case asserts `PlannerEngOutput` shape; canned-YAML invalid `verdict` asserts `OutputShapeMismatch` (Invariant §9) |

U5 mock pattern: `SpawnOptions.anthropicClientFactory` is the documented test hook (`spawn.ts` ~line 100s). Two canned YAML strings inline in the test file — happy + violation. No real network.

`BANNED_VOCAB_RE` is **not** asserted at unit-branch level. Asserting that a hand-written canned YAML contains no banned vocab is a tautology; the regex's job is to catch real LLM output, which lives in the eval-branch.

### 5.2 Eval-branch — `tests/eval/planner-eng-llm.test.ts` (NEW, CI-skip)

Runs only when `ANTHROPIC_API_KEY` is set. Real `spawn()` calls — exercises the full pipeline including Invariant §13 Tier-2 `llm.request` / `llm.response` events landed in G.1.a.

```typescript
import { describe, test, expect } from "bun:test"
import { spawn } from "../../src/dispatcher/spawn"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PlannerEngOutput } from "../../src/dispatcher/agents/planner-eng"

const HAS_KEY = !!process.env["ANTHROPIC_API_KEY"]

const FIXTURES = [
  { id: "s1", level: "L1", lang: "en",
    intent: "fix typo in README.md plan section",
    expectEmpty: true },
  { id: "s2", level: "L2", lang: "en",
    intent: "add rate limiting middleware to public API endpoints",
    expectEmpty: false },
  { id: "s3", level: "L2", lang: "zh",
    intent: "给 dispatcher 的 spawn() 增加重试超时的结构化日志",
    expectEmpty: false },
  { id: "s4", level: "L3", lang: "en",
    intent: "migrate .sgc/state from YAML to SQLite",
    expectEmpty: false },
] as const

const MODULE_CATEGORY_RE =
  /\b(auth|data|infra|perf|runtime|api|schema|migration|test|coverage|concurrency|race|lock|cache|database|middleware|dispatcher|spawn|manifest|log|event|audit|dedup|payment|session|token|deploy|production)\b/i

const BANNED_VOCAB_RE =
  /(could potentially|may break|might affect|various concerns|several issues|generally|overall|seems to|production-ready|comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错)/i

describe.skipIf(!HAS_KEY)("planner.eng LLM eval", () => {
  for (const f of FIXTURES) {
    test(`${f.id} (${f.level} ${f.lang})`, async () => {
      const stateRoot = mkdtempSync(join(tmpdir(), "sgc-eval-"))
      try {
        const res = await spawn(
          "planner.eng",
          { intent_draft: f.intent },
          { stateRoot, taskId: f.id },
        )
        const out = res.output as PlannerEngOutput

        // Universal: shape + no banned vocab anywhere
        expect(["approve", "revise", "reject"]).toContain(out.verdict)
        expect(JSON.stringify(out)).not.toMatch(BANNED_VOCAB_RE)

        if (f.expectEmpty) {
          // s1 anti-over-flag
          expect(out.verdict).toBe("approve")
          expect(out.structural_risks).toHaveLength(0)
        } else {
          // s2/s3/s4: ≥1 risk + module-category hit
          expect(out.structural_risks.length).toBeGreaterThanOrEqual(1)
          const hit = out.structural_risks.some((r) =>
            MODULE_CATEGORY_RE.test(`${r.area} ${r.risk}`),
          )
          expect(hit).toBe(true)
        }
      } finally {
        rmSync(stateRoot, { recursive: true, force: true })
      }
    })
  }
})
```

**Cost / cadence**:

- CI: integral test count change is U1-U5 only (eval describe is skipped silently).
- Manual: `ANTHROPIC_API_KEY=… bun test tests/eval/planner-eng-llm.test.ts` ≈ 4 calls × ~700 in / ~200 out tokens × `claude-sonnet-4-6` ≈ a few cents per run.
- Required runs: once during G.2.a author's local validation, once during G.3 dogfooding. No periodic schedule.

**Why `describe.skipIf` and not subdir-segregation or `RUN_LLM_EVAL=1` opt-in**:

`describe.skipIf` is a one-line bun-native gate, makes the file discoverable in default `bun test`, prints "skipped" so reviewers know the suite exists, and keeps the eval co-located with peers in `tests/eval/`. Subdir segregation requires bunfig changes; opt-in env vars create one more knob future contributors must remember. `skipIf` wins on minimum-friction.

## 6. Drift / sync rule

`prompts/planner-eng.md` Anti-patterns #3 banned-vocab list and `tests/eval/planner-eng-llm.test.ts` `BANNED_VOCAB_RE` are dual sources of the same truth. Edit one without the other and drift compounds silently.

**Rule**: any change to either MUST update the other in the same commit. PR self-review checklist line:

```
grep -oE "could potentially|may break|might affect|various concerns|\
several issues|generally|overall|seems to|production-ready|\
comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错" \
  prompts/planner-eng.md tests/eval/planner-eng-llm.test.ts | sort -u
```

Output should list the same 16 terms from both files. Mismatch → drift.

Codify this as a pre-merge checklist item in the implementation plan, not an automated check (writing a sync-validator is a 50-LOC tool justified only after drift actually happens).

## 7. PR file scope

```
contracts/sgc-capabilities.yaml         (manifest: +prompt_path, -repo_map input)
prompts/planner-eng.md                  (NEW)
src/dispatcher/agents/planner-eng.ts    (rename + alias + drop repo_map field)
tests/dispatcher/planner-eng.test.ts    (NEW)
tests/eval/planner-eng-llm.test.ts      (NEW, CI-skip)
docs/superpowers/specs/2026-04-27-phase-g2a-design.md  (this doc)
```

Six files, ~250 LOC of source + test + prompt. Single PR.

## 8. Decision log

Locked during 2026-04-27 brainstorming session.

**Q1 — Drift verdict mechanism**: keyword-match + banned-vocab dual assertion. Rejected: LLM-as-judge (cost + flakiness; CI-skip already gates manual cost), snapshot+manual-review (G.3 dogfooding already covers this angle).

**Q2 — Prompt structure**: zero-shot + `## Anti-patterns` section. Rejected: pure zero-shot (insufficient for free-form structural_risks output specificity), few-shot examples (template overfitting risk; small example set biases toward example's domain).

**Q3 — Eval fixture set**: reuse parent §8.2 s1-s4, repurpose s1 as anti-over-flag negative test. Rejected: s1 ambiguity tolerance (lets typo override the per-scenario module-category assertion), replacing s1 with another L2 fixture (breaks G.3 alignment; loses anti-over-flag coverage).

**Q4 — Eval skip mechanism**: `describe.skipIf(!ANTHROPIC_API_KEY)`. Rejected: subdir segregation, `RUN_LLM_EVAL=1` opt-in. (Resolved during §5.2 design pass without a separate user gate.)

## 9. Open questions / assumptions

- **Bun `describe.skipIf` availability**: assumed available; if absent, fallback is per-test `test.skipIf(!HAS_KEY)` repeated 4 times. Trivial swap, not a blocker.
- **`SpawnOptions.anthropicClientFactory` injection signature**: U5 mock relies on this being a documented test hook. spawn.ts comments reference it; writing-plans step should confirm exact signature before drafting U5.
- **Module-category whitelist coverage**: list in §5.2 (`MODULE_CATEGORY_RE`) is initial; G.3 dogfooding may surface gaps where the LLM's output uses synonyms outside the regex. Tune iteratively, log additions to commit history rather than re-spec.
- **ICU-segmented Chinese in `s3`**: pre-Phase-G Unicode dedup hotfix landed already; planner.eng's prompt has no language-specific branch — relies on Claude's bilingual capability for `s3`. If `s3` returns English-only structural_risks for Chinese input, that's acceptable (the validation is risk substance, not output language).

## 10. Evidence gate (for G.2.a PR)

- All 521+ existing tests green (current HEAD `0ae7c05`).
- Five new unit tests (U1–U5) pass in CI.
- Manual `ANTHROPIC_API_KEY=…` eval run output pasted into PR description per parent §9 convention.
- `grep` sync-check output (§6) demonstrates banned-vocab parity.
- `SGC_FORCE_INLINE=1 bun test` byte-identical to pre-PR (heuristic untouched).
- PR description references this spec + parent §6 explicitly.
