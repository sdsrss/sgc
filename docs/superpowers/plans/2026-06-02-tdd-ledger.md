# TDD-ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anchor `sgc work --done` to a recorded prior-RED (or `--waive-red`), capture the RED→GREEN pair as a `red-green/<slug>.md` record, and promote it into `solutions/` through the existing deterministic §3 dedup pipeline.

**Architecture:** Extend the existing `work.ts` close-gate (already gated on `--verify-command`) with a prior-red-pair-XOR-`--waive-red` requirement; persist ledger fields on the `Feature`; on a prior-red done, write a `red-green/` capture file mirroring `ship-failures/`; add `sgc compound --from-red-green <slug>` that mirrors `promoteShipFailure` (compound.context → compound.related dedup → writeSolution). sgc records the loop; it never executes tests.

**Tech Stack:** TypeScript, citty CLI, `bun test`, esbuild node bundle (`plugins/sgc/bin/sgc.mjs`).

**Spec:** `docs/superpowers/specs/2026-06-02-tdd-ledger-design.md`

**Refinement vs spec:** the spec said the promote `category` defaults to `other`; the actual ship-failure pattern derives `category`/`problem`/`symptoms`/`tags` from `compound.context` over the capture text. The plan follows the real pattern (derive via `compound.context`), which is strictly better and keeps §3 parity. Reversible if undesired.

---

## File Structure

- `src/dispatcher/types.ts` — add `Feature.prior_red?/red_output?/waived_red?`.
- `src/commands/work.ts` — gate logic + `WorkOptions` fields + persist ledger fields + call capture helper.
- `src/dispatcher/state.ts` — `RedGreenFrontmatter` type + `writeRedGreenCapture()` helper (slug + same-minute collision).
- `src/dispatcher/compound-promote.ts` — `promoteRedGreen()` mirroring `promoteShipFailure()`; extend `PromoteErrorCode`.
- `src/commands/compound.ts` — `runRedGreenPromote()` wrapper.
- `src/sgc.ts` — `work` command gains `--prior-red/--red-output/--waive-red`; `compound` command gains `--from-red-green`.
- `tests/dispatcher/sgc-work.test.ts` — update existing done-tests to pass the new gate; add gate + capture tests.
- `tests/dispatcher/compound-promote.test.ts` — add `--from-red-green` promote tests.
- `package.json` + `plugins/sgc/.claude-plugin/plugin.json` + `CHANGELOG.md` — release.

---

## Task 1: Feature ledger fields

**Files:**
- Modify: `src/dispatcher/types.ts` (the `Feature` interface, after `verify_command?`/`evidence?`)

- [ ] **Step 1: Add the fields**

In `src/dispatcher/types.ts`, inside `interface Feature`, after the existing `evidence?` field, add:

```typescript
  /**
   * TDD-ledger (Phase 2a). Set when `--done` records a prior-RED pair: the
   * failing test / repro identifier and the observed failure output. sgc
   * records the attestation; it does not execute the test. Absent on
   * features closed via --waive-red or before the gate existed.
   */
  prior_red?: string
  red_output?: string
  /** Reason a feature was closed without a prior-RED (e.g. "docs-only"). */
  waived_red?: string
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean (additive optional fields, no consumer breakage).

- [ ] **Step 3: Commit**

```bash
git add src/dispatcher/types.ts
git commit -m "feat(types): Feature TDD-ledger fields (prior_red/red_output/waived_red)"
```

---

## Task 2: work.ts close-gate + CLI flags

**Files:**
- Modify: `src/commands/work.ts` (`WorkOptions` + the `--done` branch)
- Modify: `src/sgc.ts` (the `work` command `args` + `run()`)
- Test: `tests/dispatcher/sgc-work.test.ts`

- [ ] **Step 1: Update existing done-tests to satisfy the new gate (RED setup)**

The existing tests call `runWork({ done, verifyCommand })` without a prior-RED — they will start failing once the gate lands. Update every existing `--done` call in `tests/dispatcher/sgc-work.test.ts` that is NOT specifically testing the verify-command gate to add `waiveRed: "test-fixture"`. Concretely, in the tests at lines ~50–74 (`--done marks feature done`, `--done on already-done feature is idempotent`), change each closing call:

```typescript
// before: runWork({ stateRoot: tmp, done: "f1", verifyCommand: "tests pass", log: () => {} })
// after:
runWork({ stateRoot: tmp, done: "f1", verifyCommand: "tests pass", waiveRed: "test-fixture", log: () => {} })
```

Leave the `verify-command`-gate tests (lines ~76–88) unchanged — they assert the verify-command refusal which fires before the prior-red gate.

- [ ] **Step 2: Write the failing tests for the new gate**

Append to `tests/dispatcher/sgc-work.test.ts` inside the `describe("runWork", ...)` block:

```typescript
test("--done without prior-red or waive-red is refused", async () => {
  await freshTask()
  await expect(
    runWork({ stateRoot: tmp, done: "f1", verifyCommand: "tests pass", log: () => {} }),
  ).rejects.toThrow(/prior-red|waive-red/)
})

test("--done with --prior-red but no --red-output is refused", async () => {
  await freshTask()
  await expect(
    runWork({
      stateRoot: tmp, done: "f1", verifyCommand: "tests pass",
      priorRed: "tests/x.test.ts::t", log: () => {},
    }),
  ).rejects.toThrow(/red-output/)
})

test("--done with a prior-red pair AND --waive-red is refused (conflict)", async () => {
  await freshTask()
  await expect(
    runWork({
      stateRoot: tmp, done: "f1", verifyCommand: "tests pass",
      priorRed: "tests/x.test.ts::t", redOutput: "AssertionError", waiveRed: "x",
      log: () => {},
    }),
  ).rejects.toThrow(/not both|conflict/)
})

test("--done with a prior-red pair persists prior_red/red_output on the feature", async () => {
  await freshTask()
  await runWork({
    stateRoot: tmp, done: "f1", verifyCommand: "tests pass",
    priorRed: "tests/x.test.ts::t_pagination", redOutput: "expected 20 got 50",
    log: () => {},
  })
  const fl = readFeatureList(tmp)
  expect(fl?.list.features[0]?.prior_red).toBe("tests/x.test.ts::t_pagination")
  expect(fl?.list.features[0]?.red_output).toBe("expected 20 got 50")
  expect(fl?.list.features[0]?.waived_red).toBeUndefined()
})

test("--done with --waive-red persists waived_red and no prior_red", async () => {
  await freshTask()
  await runWork({
    stateRoot: tmp, done: "f1", verifyCommand: "tests pass", waiveRed: "docs-only",
    log: () => {},
  })
  const fl = readFeatureList(tmp)
  expect(fl?.list.features[0]?.waived_red).toBe("docs-only")
  expect(fl?.list.features[0]?.prior_red).toBeUndefined()
})
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/sgc-work.test.ts`
Expected: the 5 new tests FAIL (gate not implemented; `priorRed`/`redOutput`/`waiveRed` not on `WorkOptions`).

- [ ] **Step 4: Add the WorkOptions fields**

In `src/commands/work.ts`, add to `interface WorkOptions` (after `evidence?`):

```typescript
  /** TDD-ledger: prior-RED identifier (failing test / repro). Pairs with redOutput. */
  priorRed?: string
  /** TDD-ledger: observed failure output of the prior-RED. Pairs with priorRed. */
  redOutput?: string
  /** TDD-ledger: reason for closing without a prior-RED (escape hatch). */
  waiveRed?: string
```

- [ ] **Step 5: Implement the gate + persistence**

In `src/commands/work.ts`, inside the `--done` branch, replace the existing `else { ... }` body (the non-grandfather path that currently checks verify-command) so that after the existing verify-command check it adds the prior-red gate. The full replacement block:

```typescript
    } else {
      // Verification close-gate (Tier 1, parity with `sgc debug close`): a new
      // done-transition MUST carry a verify_command. sgc records, never executes.
      const verifyCommand = opts.verifyCommand?.trim()
      if (!verifyCommand) {
        throw new Error(
          `done refused: --verify-command required to mark ${opts.done} done ` +
            `(operator responsibility; sgc does not execute it)`,
        )
      }
      // TDD-ledger close-gate (Phase 2a): require a recorded prior-RED pair
      // (--prior-red + --red-output) XOR --waive-red <reason>. sgc records the
      // attestation; it does not run the test.
      const priorRed = opts.priorRed?.trim()
      const redOutput = opts.redOutput?.trim()
      const waiveRed = opts.waiveRed?.trim()
      const hasPair = Boolean(priorRed) && Boolean(redOutput)
      if (Boolean(priorRed) !== Boolean(redOutput)) {
        throw new Error(
          `done refused: --prior-red and --red-output must be supplied together`,
        )
      }
      if (hasPair && waiveRed) {
        throw new Error(
          `done refused: supply a prior-RED pair OR --waive-red, not both (conflict)`,
        )
      }
      if (!hasPair && !waiveRed) {
        throw new Error(
          `done refused: record a prior-RED (--prior-red "<failing test>" ` +
            `--red-output "<observed failure>") or pass --waive-red "<reason>"`,
        )
      }
      const evidence = opts.evidence?.trim()
      list.features[idx] = {
        ...list.features[idx]!,
        status: "done",
        verify_command: verifyCommand,
        ...(evidence ? { evidence } : {}),
        ...(hasPair ? { prior_red: priorRed, red_output: redOutput } : {}),
        ...(waiveRed ? { waived_red: waiveRed } : {}),
      }
      writeFeatureList(list, "", stateRoot)
      log(`marked ${opts.done} done`)
    }
```

- [ ] **Step 6: Wire the CLI flags in sgc.ts**

In `src/sgc.ts`, in the `work` command `args`, after `evidence`, add:

```typescript
    "prior-red": {
      type: "string",
      required: false,
      description:
        "(with --done) failing test / repro that was RED before the fix (TDD-ledger). Pairs with --red-output.",
    },
    "red-output": {
      type: "string",
      required: false,
      description: "(with --done) the observed failure output of --prior-red.",
    },
    "waive-red": {
      type: "string",
      required: false,
      description:
        "(with --done) close without a prior-RED, giving a reason (e.g. \"docs-only\"). Escape hatch for the TDD-ledger gate.",
    },
```

And in the `work` command `run()`, add to the `runWork({...})` call:

```typescript
      priorRed: args["prior-red"] as string | undefined,
      redOutput: args["red-output"] as string | undefined,
      waiveRed: args["waive-red"] as string | undefined,
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/sgc-work.test.ts`
Expected: all PASS (existing updated tests + 5 new gate tests).

- [ ] **Step 8: Commit**

```bash
git add src/commands/work.ts src/sgc.ts tests/dispatcher/sgc-work.test.ts
git commit -m "feat(work): TDD-ledger close-gate (prior-red pair XOR --waive-red)"
```

---

## Task 3: red-green capture file

**Files:**
- Modify: `src/dispatcher/state.ts` (add `RedGreenFrontmatter` + `writeRedGreenCapture`)
- Modify: `src/commands/work.ts` (call the helper on a prior-red done)
- Test: `tests/dispatcher/sgc-work.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/dispatcher/sgc-work.test.ts`. Add `existsSync`, `readFileSync` and `readdirSync` imports at the top (`import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs"`), then:

```typescript
test("--done with a prior-red pair writes a red-green capture file", async () => {
  await freshTask()
  await runWork({
    stateRoot: tmp, done: "f1", verifyCommand: "bun test x",
    priorRed: "tests/x.test.ts::t_pagination", redOutput: "expected 20 got 50",
    evidence: "f1 green after lock", log: () => {},
  })
  const dir = join(tmp, "red-green")
  expect(existsSync(dir)).toBe(true)
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"))
  expect(files.length).toBe(1)
  const raw = readFileSync(join(dir, files[0]!), "utf8")
  expect(raw).toContain("kind: red-green")
  expect(raw).toContain("prior_red:")
  expect(raw).toContain("expected 20 got 50")
  expect(raw).toContain("prevention_seed:")
})

test("--done with --waive-red writes NO capture file", async () => {
  await freshTask()
  await runWork({
    stateRoot: tmp, done: "f1", verifyCommand: "n/a", waiveRed: "docs-only", log: () => {},
  })
  expect(existsSync(join(tmp, "red-green"))).toBe(false)
})

test("already-done feature is a grandfathered no-op (no capture)", async () => {
  await freshTask()
  await runWork({
    stateRoot: tmp, done: "f1", verifyCommand: "x",
    priorRed: "t", redOutput: "boom", log: () => {},
  })
  const dir = join(tmp, "red-green")
  const before = readdirSync(dir).length
  await runWork({ stateRoot: tmp, done: "f1", log: () => {} }) // re-done, no gate
  expect(readdirSync(dir).length).toBe(before)
})
```

Path note (verified): `resolveStateRoot(stateRoot)` returns the passed dir directly — state lands at `<stateRoot>/red-green/`, NOT `<stateRoot>/.sgc/`. The `.sgc` segment only appears for the default state dir (no `stateRoot` arg).

- [ ] **Step 2: Run to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/sgc-work.test.ts -t "capture"`
Expected: FAIL (no capture file written).

- [ ] **Step 3: Add the frontmatter type + helper in state.ts**

In `src/dispatcher/state.ts`, add near the other capture helpers:

```typescript
export interface RedGreenFrontmatter {
  kind: "red-green"
  captured_at: string
  task_id: string
  feature_id: string
  level: string
  prior_red: string
  red_output: string
  verify_command: string
  evidence?: string
  prevention_seed: string
  promoted_to?: string
}

const RED_GREEN_PLACEHOLDER = "TODO: operator-fill the reusable prevention"

function redGreenSlug(title: string, taskId: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "feature"
  return `${base}-${taskId.slice(0, 8).toLowerCase()}`
}

/**
 * Write a red-green capture record under <stateRoot>/red-green/<slug>.md,
 * mirroring ship-failures. Same-minute collision appends -2, -3, … Uses
 * writeAtomic (STAB-4). Returns the relative slug actually written.
 */
export function writeRedGreenCapture(
  fm: Omit<RedGreenFrontmatter, "kind" | "captured_at" | "prevention_seed"> & {
    title: string
  },
  stateRoot?: string,
): string {
  const dir = resolve(root(stateRoot), "red-green")
  mkdirSync(dir, { recursive: true })
  let slug = redGreenSlug(fm.title, fm.task_id)
  let n = 1
  while (existsSync(resolve(dir, `${slug}.md`))) {
    n += 1
    slug = `${redGreenSlug(fm.title, fm.task_id)}-${n}`
    if (n > 50) throw new Error(`red-green slug collision overflow for ${fm.task_id}`)
  }
  const data: RedGreenFrontmatter = {
    kind: "red-green",
    captured_at: new Date().toISOString(),
    task_id: fm.task_id,
    feature_id: fm.feature_id,
    level: fm.level,
    prior_red: fm.prior_red,
    red_output: fm.red_output,
    verify_command: fm.verify_command,
    ...(fm.evidence ? { evidence: fm.evidence } : {}),
    prevention_seed: RED_GREEN_PLACEHOLDER,
  }
  const body = `## RED→GREEN\n\n- prior RED: ${fm.prior_red}\n- observed: ${fm.red_output}\n- verified by: ${fm.verify_command}\n\nFill \`prevention_seed:\` with the reusable safeguard, then run \`sgc compound --from-red-green ${slug}\`.\n`
  writeAtomic(resolve(dir, `${slug}.md`), serializeFrontmatter(data as unknown as Record<string, unknown>, body))
  return slug
}
```

Confirm `mkdirSync`, `resolve`, `root`, `existsSync`, `writeAtomic`, `serializeFrontmatter` are already imported/defined in `state.ts` (they are — `root()` is the private state-root resolver used by `solutionPath`). If `mkdirSync` is not imported, add it to the `node:fs` import.

- [ ] **Step 4: Call the helper from work.ts**

In `src/commands/work.ts`, import the helper:

```typescript
import {
  readCurrentTask,
  readFeatureList,
  writeCurrentTask,
  writeFeatureList,
  writeRedGreenCapture,
} from "../dispatcher/state"
```

Then in the `--done` branch, immediately after `writeFeatureList(list, "", stateRoot)` and `log(...)` inside the `else` block, before closing the block, add:

```typescript
      if (hasPair) {
        writeRedGreenCapture(
          {
            title: list.features[idx]!.title,
            task_id: ct.task.task_id,
            feature_id: opts.done,
            level: String(ct.task.level),
            prior_red: priorRed!,
            red_output: redOutput!,
            verify_command: verifyCommand,
            ...(evidence ? { evidence } : {}),
          },
          stateRoot,
        )
      }
```

- [ ] **Step 5: Run to verify pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/sgc-work.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/dispatcher/state.ts src/commands/work.ts tests/dispatcher/sgc-work.test.ts
git commit -m "feat(work): write red-green capture record on prior-red done"
```

---

## Task 4: `sgc compound --from-red-green` promote

**Files:**
- Modify: `src/dispatcher/compound-promote.ts` (`promoteRedGreen` + extend `PromoteErrorCode`)
- Modify: `src/commands/compound.ts` (`runRedGreenPromote` wrapper)
- Modify: `src/sgc.ts` (`compound` command `--from-red-green` flag + routing)
- Test: `tests/dispatcher/compound-promote.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/dispatcher/compound-promote.test.ts`. This file uses `describe`/`it` + an `ensureSgcStructure(stateRoot)` beforeEach — match that. Self-contained per-test dirs are fine. Add a helper at file scope and three `it(...)` cases:

```typescript
function writeRedGreenFixture(root: string, slug: string, seed: string): void {
  ensureSgcStructure(root)
  const dir = join(root, "red-green")
  mkdirSync(dir, { recursive: true })
  const fm = [
    "---",
    "kind: red-green",
    "captured_at: 2026-06-02T00:00:00.000Z",
    "task_id: T-ABCD1234",
    "feature_id: f1",
    "level: 2",
    "prior_red: tests/orders.test.ts::coupon_once",
    "red_output: expected 90.00 got 100.00",
    "verify_command: bun test orders",
    `prevention_seed: ${seed}`,
    "---",
    "## RED→GREEN",
    "",
  ].join("\n")
  writeFileSync(join(dir, `${slug}.md`), fm, "utf8")
}

it("--from-red-green promotes a filled capture into a solution", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-rg-promote-"))
  writeRedGreenFixture(root, "coupon-bug-t-abcd1", "Apply coupon exactly once; assert idempotent subtract.")
  const { runRedGreenPromote } = await import("../../src/commands/compound")
  const res = await runRedGreenPromote({ slug: "coupon-bug-t-abcd1", stateRoot: root })
  expect(res.solutionPath).toContain("solutions")
  expect(existsSync(res.solutionPath)).toBe(true)
  const after = readFileSync(join(root, "red-green", "coupon-bug-t-abcd1.md"), "utf8")
  expect(after).toContain("promoted_to:")
  rmSync(root, { recursive: true, force: true })
})

it("--from-red-green refuses an unfilled prevention_seed placeholder", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-rg-ph-"))
  writeRedGreenFixture(root, "ph-t-abcd1", "TODO: operator-fill the reusable prevention")
  const { runRedGreenPromote } = await import("../../src/commands/compound")
  await expect(runRedGreenPromote({ slug: "ph-t-abcd1", stateRoot: root })).rejects.toThrow(/placeholder|prevention_seed/i)
  rmSync(root, { recursive: true, force: true })
})

it("--from-red-green is idempotent — re-promote refuses (AlreadyPromoted)", async () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-rg-rerun-"))
  writeRedGreenFixture(root, "rerun-t-abcd1", "Lock the row before the coupon subtract.")
  const { runRedGreenPromote } = await import("../../src/commands/compound")
  await runRedGreenPromote({ slug: "rerun-t-abcd1", stateRoot: root })
  await expect(runRedGreenPromote({ slug: "rerun-t-abcd1", stateRoot: root })).rejects.toThrow(/already|promoted_to/i)
  rmSync(root, { recursive: true, force: true })
})
```

Match the file's existing imports — add any of `mkdirSync`, `existsSync`, `readFileSync` not already imported. `ensureSgcStructure` is already imported by this test file.

**Dedup-hit coverage note:** the merge-on-duplicate behavior (spec criterion 6 "merges on a hit") runs through the SAME `compound.related` + `writeSolution` machinery already covered by this file's `--from-ship-failure` dedup tests — `promoteRedGreen` shares those functions verbatim, so a red-green-specific dedup-hit test would only re-exercise shared code. Not duplicated here by design.

- [ ] **Step 2: Run to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/compound-promote.test.ts -t "red-green"`
Expected: FAIL (`runRedGreenPromote` not exported).

- [ ] **Step 3: Implement `promoteRedGreen` in compound-promote.ts**

Extend `PromoteErrorCode`:

```typescript
export type PromoteErrorCode =
  | "MissingShipFailure"
  | "PlaceholderPreventionSeed"
  | "AlreadyPromoted"
  | "DuplicateMatch"
  | "MissingRedGreen"
```

Add the function (mirror of `promoteShipFailure`; reuse `RedGreenFrontmatter` from state.ts — add it to the existing `./state` import):

```typescript
export async function promoteRedGreen(
  opts: PromoteOptions,
): Promise<PromoteResult> {
  const stateRoot = opts.stateRoot
  const root = resolveStateRoot(stateRoot)
  const capturePath = resolve(root, "red-green", `${opts.slug}.md`)

  if (!existsSync(capturePath)) {
    throw new PromoteError(
      "MissingRedGreen",
      `red-green/${opts.slug}.md does not exist under ${root}. ` +
        `Run \`ls ${root}/red-green/\` to see available slugs.`,
      { slug: opts.slug, stateRoot: root },
    )
  }

  const raw = readFileSync(capturePath, "utf8")
  const parsed = parseFrontmatter<RedGreenFrontmatter>(raw)
  const fm = parsed.data

  if (typeof fm.promoted_to === "string" && fm.promoted_to.length > 0) {
    throw new PromoteError(
      "AlreadyPromoted",
      `red-green/${opts.slug}.md already carries promoted_to: ${fm.promoted_to}. ` +
        `Remove the field manually to re-promote; --force does NOT override.`,
      { promoted_to: fm.promoted_to },
    )
  }

  const seed = String(fm.prevention_seed ?? "").trim()
  if (seed.length === 0 || seed.startsWith(PLACEHOLDER_PREFIX)) {
    throw new PromoteError(
      "PlaceholderPreventionSeed",
      `red-green/${opts.slug}.md still carries the capture-time prevention_seed ` +
        `placeholder (or empty). Edit \`prevention_seed:\` into the actual ` +
        `safeguard before re-running promote.`,
      { prevention_seed: seed.slice(0, 80) },
    )
  }

  // Heuristic input: the observed RED is the problem text; the prior-RED id
  // routes into tag candidates. compound.context derives category/tags/problem.
  const intentText = `${fm.red_output}\n\n${fm.prior_red}`
  const logger = opts.logger ?? createLogger({ stateRoot })

  const ctxRes = await spawn<unknown, CompoundContextOutput>(
    "compound.context",
    { task_id: fm.task_id, intent: intentText },
    {
      stateRoot,
      inlineStub: (i) =>
        compoundContext(i as { task_id: string; intent: string; diff?: string }),
      logger,
    },
  )
  const context = ctxRes.output

  const signature = computeSignature(context.problem_summary)
  const existing = listSolutions(stateRoot)

  const relRes = await spawn<unknown, CompoundRelatedOutput>(
    "compound.related",
    { context, signature, existing_solutions: existing },
    {
      stateRoot,
      inlineStub: (i) =>
        compoundRelated(
          i as {
            context: CompoundContextOutput
            signature: string
            existing_solutions: typeof existing
          },
        ),
      logger,
    },
  )
  const related = relRes.output

  if (related.duplicate_match && !opts.force) {
    throw new PromoteError(
      "DuplicateMatch",
      `compound.related found a duplicate at ${related.duplicate_match.ref} ` +
        `(similarity ${related.duplicate_match.similarity.toFixed(3)} ≥ ` +
        `${related.dedup_stamp.threshold}). Pass --force to write anyway, ` +
        `or edit prevention_seed: to differentiate.`,
      {
        duplicate_ref: related.duplicate_match.ref,
        similarity: related.duplicate_match.similarity,
      },
    )
  }

  const now = nowIso()
  const entry: SolutionEntry = {
    id: generateUlid(),
    signature,
    category: context.category,
    problem: context.problem_summary,
    symptoms:
      context.symptoms.length > 0
        ? context.symptoms
        : [`RED→GREEN of ${fm.feature_id} (${fm.prior_red})`],
    what_didnt_work: [],
    solution:
      `RED→GREEN for ${fm.feature_id} in task ${fm.task_id} (level ${fm.level}): ` +
      `prior-RED ${fm.prior_red} → green via ${fm.verify_command}` +
      (fm.evidence ? `; evidence: ${fm.evidence}` : "") +
      `. See body + operator's prevention_seed.`,
    prevention: seed,
    tags:
      context.tags.length > 0
        ? Array.from(new Set([...context.tags, "tdd", "red-green"]))
        : ["tdd", "red-green"],
    first_seen: now,
    last_updated: now,
    times_referenced: 0,
    source_task_ids: [fm.task_id],
    related_entries:
      related.related_entries.length > 0 ? related.related_entries : undefined,
    confidence: "provisional",
  }

  const solutionSlug =
    opts.solutionSlug ?? `red-green-${fm.task_id.slice(0, 8).toLowerCase()}-${fm.feature_id}`
  const dedupAction: "new_entry" | "user_forced" =
    opts.force && related.duplicate_match ? "user_forced" : "new_entry"
  const stamp: DedupStamp = {
    compound_related_spawn_id: relRes.spawnId,
    threshold_met_or_forced: true,
    reason: dedupAction,
  }

  const written = writeSolution(entry, solutionSlug, stamp, "", stateRoot)
  const promotedRef = `${entry.category}/${solutionSlug}`

  const updatedFm: RedGreenFrontmatter = { ...fm, promoted_to: promotedRef }
  writeFileSync(
    capturePath,
    serializeFrontmatter(updatedFm as unknown as Record<string, unknown>, parsed.body),
    "utf8",
  )

  return {
    shipFailurePath: capturePath,
    solutionPath: written.path,
    dedupAction,
    relatedRefs: related.related_entries,
  }
}
```

Add `RedGreenFrontmatter` to the existing `import { ... } from "./state"` line.

- [ ] **Step 4: Add the wrapper in commands/compound.ts**

In `src/commands/compound.ts`, add to the `import { ... promoteShipFailure ... }` line `promoteRedGreen`, then:

```typescript
/**
 * TDD-ledger promote entry point — operator/janitor path for red-green
 * capture records. Sibling to runCompoundPromote; wraps promoteRedGreen.
 * The CLI in sgc.ts routes `--from-red-green <slug>` here.
 */
export async function runRedGreenPromote(
  opts: PromoteOptions,
): Promise<PromoteResult> {
  return promoteRedGreen(opts)
}
```

- [ ] **Step 5: Wire the CLI flag in sgc.ts**

In `src/sgc.ts`, in the `compound` command `args`, after `from-canary`, add:

```typescript
    "from-red-green": {
      type: "string",
      required: false,
      description:
        "TDD-ledger promote: convert a captured red-green record into a solutions/ entry. Pass the slug under <stateRoot>/red-green/<slug>.md.",
    },
```

In the `compound` `run()`, after the `from-canary` branch and before the `from-ship-failure` branch (mirror the same shape), add:

```typescript
    const fromRedGreen = args["from-red-green"] as string | undefined
    if (fromRedGreen) {
      const { runRedGreenPromote } = await import("./commands/compound")
      const result = await runRedGreenPromote({
        slug: fromRedGreen,
        force: args.force as boolean | undefined,
        solutionSlug: args["solution-slug"] as string | undefined,
        stateRoot: args["state-root"] as string | undefined,
      })
      process.stderr.write(`promoted red-green/${fromRedGreen} → ${result.solutionPath}\n`)
      return
    }
```

Match the exact `stateRoot`/logging shape of the adjacent `from-canary`/`from-ship-failure` branches (copy their `state-root` arg access and stderr/return idiom verbatim — they are the source of truth).

- [ ] **Step 6: Run to verify pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/compound-promote.test.ts`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/dispatcher/compound-promote.ts src/commands/compound.ts src/sgc.ts tests/dispatcher/compound-promote.test.ts
git commit -m "feat(compound): sgc compound --from-red-green promote (§3 dedup parity)"
```

---

## Task 5: Full-suite gate, bundle rebuild, doctor

**Files:**
- Modify: `plugins/sgc/bin/sgc.mjs` (rebuilt artifact)

- [ ] **Step 1: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Full dispatcher suite**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher`
Expected: all PASS, count ≥ prior baseline (1051) + new tests.

- [ ] **Step 3: Rebuild the node bundle**

Run: `npm run build:cli`
Expected: "Bundled N modules". The bundle inlines `src/`.

- [ ] **Step 4: Doctor (source mode — parity gates active)**

Run: `bun src/sgc.ts doctor`
Expected: `bundle parity ✓` (committed bundle matches rebuild — so commit the bundle in this step), slash↔CLI parity ✓ (the new `work`/`compound` flags do not add subcommands), Summary `0 fail`.

- [ ] **Step 5: Commit (bundle with exec bit)**

```bash
git add --chmod=+x plugins/sgc/bin/sgc.mjs
git commit -m "build(cli): rebuild bundle with TDD-ledger"
```

---

## Task 6: Release v1.25.0

**Files:**
- Modify: `package.json`, `plugins/sgc/.claude-plugin/plugin.json` (lockstep version)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: CHANGELOG migration note**

Prepend to `CHANGELOG.md` (above the latest entry):

```markdown
## v1.25.0 — TDD-ledger (Phase 2a)

**MIGRATION:** `sgc work --done <id>` now requires a recorded prior-RED in
addition to `--verify-command`. Supply either a prior-RED pair or waive it:

    # with a recorded RED:
    sgc work --done f1 --verify-command "bun test x" \
      --prior-red "tests/x.test.ts::t" --red-output "expected 20 got 50"

    # waive (docs-only / additive, no prior failing path):
    sgc work --done f1 --verify-command "n/a" --waive-red "docs-only"

Already-done features remain a no-op (grandfathered). A prior-RED done writes a
`red-green/<slug>.md` capture; promote it with `sgc compound --from-red-green <slug>`
after filling its `prevention_seed:`.
```

- [ ] **Step 2: Lockstep version bump**

Set `"version": "1.25.0"` in both `package.json` and `plugins/sgc/.claude-plugin/plugin.json`.

- [ ] **Step 3: Rebuild bundle (version is inlined)**

Run: `npm run build:cli`
Expected: bundle re-inlines the new `package.json` version.

- [ ] **Step 4: Final doctor + suite**

Run: `bun src/sgc.ts doctor && SGC_FORCE_INLINE=1 bun test tests/dispatcher`
Expected: doctor `0 fail` (bundle parity ✓); suite all PASS.

- [ ] **Step 5: Commit + tag (ship gate — gs:/ship or manual per §12)**

```bash
git add package.json plugins/sgc/.claude-plugin/plugin.json CHANGELOG.md
git add --chmod=+x plugins/sgc/bin/sgc.mjs
git commit -m "chore(release): v1.25.0 — TDD-ledger (Phase 2a)"
git tag v1.25.0
```

Push + tag fires `publish.yml`. **AUTH-gated** — do not push without explicit ship approval. Post-publish, verify `npm view @sdsrs/sgc@1.25.0 dist.shasum` against the CI tarball (provenance-403 false-negative guard).

- [ ] **Step 6: Update POSITIONING + roadmap + memory**

Update `docs/POSITIONING.md` "Optional interop" TDD row from gap → native; tick Phase 2a in `docs/ROADMAP.md`; refresh `project_sgc.md` memory with the v1.25.0 ship line.
