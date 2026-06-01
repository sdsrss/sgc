# sgc Install/Distribution (node bundle, dual-channel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/plugin install sgc` yield a fully working CLI on a clean machine (node only, no bun, no npm-global), while keeping `npx`/`npm i -g` as a first-class channel.

**Architecture:** Single source `src/` → one node ESM bundle `plugins/sgc/bin/sgc.mjs` with `contracts/` + `prompts/` inlined as text. The bundle ships through both the plugin payload (resolved via `$CLAUDE_PLUGIN_ROOT`, run with `node`) and npm (`bin.sgc` → same file). The only runtime-code change is replacing 15 `Bun.spawn`/`Bun.which` calls with a `node:child_process` adapter so the bundle runs under plain node.

**Tech Stack:** TypeScript, bun 1.3.5 (dev/test/build tool only), node ≥18 (ship runtime), citty CLI, `bun test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-06-01-sgc-install-bundle-distribution-design.md`

**Decisions locked (brainstorming):** dual-channel both first-class · plugin bundle wins precedence · data inlined into bundle + `SGC_CONTRACTS_DIR`/`SGC_PROMPTS_DIR` env escape hatch.

**Conventions:** Tests live in `tests/dispatcher/*.test.ts`, run with `SGC_FORCE_INLINE=1 bun test tests/dispatcher`. Full suite baseline at plan start: **1035 pass / 0 fail** (keep green after every task). `tsc --noEmit` must stay clean.

---

## File Structure

**New files:**
- `src/dispatcher/subprocess.ts` — node:child_process adapter: `spawnCapture` (async capture) + `whichSync` (PATH lookup). Replaces all `Bun.spawn`/`Bun.which`.
- `src/dispatcher/embedded-data.ts` — text-imports of `contracts/*` + `prompts/*`; exports `EMBEDDED_CONTRACTS`/`EMBEDDED_PROMPTS` maps + `readContract`/`readPrompt`/`listEmbeddedPromptKeys` (env-override → embedded → disk ladder).
- `tests/dispatcher/subprocess.test.ts`, `tests/dispatcher/embedded-data.test.ts`, `tests/dispatcher/doctor-bundle-parity.test.ts`
- `tests/e2e/clean-container.test.sh` — docker `node:20-slim` acceptance gate.
- `tests/e2e/npm-isolated-install.test.sh` — isolated `npm i -g` acceptance.

**Modified files:**
- `src/dispatcher/claude-cli-agent.ts:57-92` — port `defaultRunner` off `Bun.spawn`.
- `src/dispatcher/schema.ts:29-42` — `readContract` → embedded ladder.
- `src/dispatcher/spawn.ts:552-559` — `formatPrompt` prompt read → embedded ladder.
- `src/commands/doctor.ts` — prompts/contracts via embedded; graceful skip of source-only checks when source absent; new bundle-hash parity check.
- The 8 git/subprocess `Bun.spawn` sites (Task 3 enumerates) + `Bun.which` in `spawn.ts:456`.
- `plugins/sgc/commands/*.md` — 4-tier CLI resolver snippet.
- `package.json` — `build:cli` script, `bin`, `files`, `engines`.
- `.github/workflows/{test,publish}.yml` — build + verify bundle.

---

## Task 1: node subprocess adapter

**Files:**
- Create: `src/dispatcher/subprocess.ts`
- Test: `tests/dispatcher/subprocess.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/dispatcher/subprocess.test.ts
import { test, expect } from "bun:test"
import { spawnCapture, whichSync } from "../../src/dispatcher/subprocess"

test("spawnCapture captures stdout + exitCode 0", async () => {
  const r = await spawnCapture(["node", "-e", "process.stdout.write('hi')"])
  expect(r.stdout).toBe("hi")
  expect(r.exitCode).toBe(0)
})

test("spawnCapture captures stderr + nonzero exit", async () => {
  const r = await spawnCapture(["node", "-e", "process.stderr.write('boom');process.exit(3)"])
  expect(r.stderr).toBe("boom")
  expect(r.exitCode).toBe(3)
})

test("spawnCapture on missing binary resolves exitCode -1 (no throw)", async () => {
  const r = await spawnCapture(["sgc-no-such-binary-xyz"])
  expect(r.exitCode).toBe(-1)
})

test("whichSync finds node, returns null for nonexistent", () => {
  expect(whichSync("node")).toBeTruthy()
  expect(whichSync("sgc-no-such-binary-xyz")).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/subprocess.test.ts`
Expected: FAIL — `Cannot find module ".../subprocess"`.

- [ ] **Step 3: Write the adapter**

```typescript
// src/dispatcher/subprocess.ts
//
// node:child_process subprocess adapter. Replaces all Bun.spawn / Bun.which
// so the shipped bundle runs under plain `node` (no bun runtime). Works
// identically under bun (dev/test) and node (bundle) — both implement
// node:child_process.
import { spawn, spawnSync } from "node:child_process"

export interface CaptureResult {
  stdout: string
  stderr: string
  exitCode: number
}

/** Async spawn + capture. Never rejects: a spawn error (e.g. missing binary)
 *  resolves exitCode -1 with the error text in stderr, matching the old
 *  Bun.spawn-based call sites that treated nonzero/failed as a soft null. */
export function spawnCapture(
  argv: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<CaptureResult> {
  return new Promise((resolveP) => {
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (c: Buffer) => (stdout += c.toString()))
    child.stderr?.on("data", (c: Buffer) => (stderr += c.toString()))
    child.on("error", (e) =>
      resolveP({ stdout, stderr: stderr + String(e), exitCode: -1 }),
    )
    child.on("close", (code) =>
      resolveP({ stdout, stderr, exitCode: code ?? -1 }),
    )
  })
}

/** Resolve an executable on PATH. Replaces Bun.which. */
export function whichSync(bin: string): string | null {
  const cmd = process.platform === "win32" ? "where" : "which"
  const r = spawnSync(cmd, [bin], { encoding: "utf8" })
  if (r.status !== 0) return null
  const line = (r.stdout || "").split("\n")[0]?.trim()
  return line && line.length > 0 ? line : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/subprocess.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/subprocess.ts tests/dispatcher/subprocess.test.ts
git commit -m "feat(subprocess): node:child_process adapter (spawnCapture + whichSync)"
```

---

## Task 2: Port claude-cli defaultRunner off Bun.spawn

**Files:**
- Modify: `src/dispatcher/claude-cli-agent.ts:57-92`
- Test: `tests/dispatcher/claude-cli-agent.test.ts` (existing — must stay green)

Preserve the `SubprocessRunner` contract exactly (`{stdout, stderr, exitCode, timedOut}`), the `onSpawn(kill)` STAB-2 hook, and AbortController timeout. See [[feedback_signal_handler_paired_events]] — the kill handle must still let a SIGINT/SIGTERM drain reap the child.

- [ ] **Step 1: Add a timeout test (failing if behavior breaks)**

```typescript
// append to tests/dispatcher/claude-cli-agent.test.ts
import { defaultRunner } from "../../src/dispatcher/claude-cli-agent"

test("defaultRunner times out and reports timedOut", async () => {
  const r = await defaultRunner(["node", "-e", "setTimeout(()=>{},5000)"], 200)
  expect(r.timedOut).toBe(true)
  expect(r.exitCode).toBe(-1)
})

test("defaultRunner captures normal output", async () => {
  const r = await defaultRunner(["node", "-e", "process.stdout.write('ok')"], 5000)
  expect(r.stdout).toBe("ok")
  expect(r.exitCode).toBe(0)
  expect(r.timedOut).toBe(false)
})

test("defaultRunner exposes a kill handle via onSpawn", async () => {
  let killed = false
  const p = defaultRunner(["node", "-e", "setTimeout(()=>{},5000)"], 5000, (kill) => {
    setTimeout(() => { killed = true; kill() }, 100)
  })
  const r = await p
  expect(killed).toBe(true)
  expect(r.exitCode).not.toBe(0)
})
```

- [ ] **Step 2: Run to verify the timeout test fails or runner needs porting**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/claude-cli-agent.test.ts`
Expected: existing tests pass on bun (still Bun.spawn); new tests pass on bun too. The point of porting is node-compat — proven in Task 13. Run now to capture the green baseline before editing.

- [ ] **Step 3: Replace the Bun.spawn body with node:child_process**

Replace lines 57-92 (the `defaultRunner` body) with:

```typescript
import { spawn } from "node:child_process"

/** Default runner: node:child_process.spawn. Split out so tests can inject a
 *  fake. Ported off Bun.spawn so the shipped bundle runs under node. */
export const defaultRunner: SubprocessRunner = async (argv, timeoutMs, onSpawn) => {
  return new Promise((resolveP) => {
    const controller = new AbortController()
    let timedOut = false
    controller.signal.addEventListener("abort", () => {
      timedOut = true
    })
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const child = spawn(argv[0]!, argv.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
      signal: controller.signal,
    })
    // STAB-2: expose a kill handle so a signal drain can SIGTERM this child.
    onSpawn?.(() => {
      try {
        child.kill()
      } catch {
        // already exited / not killable — nothing to reap.
      }
    })
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (c: Buffer) => (stdout += c.toString()))
    child.stderr?.on("data", (c: Buffer) => (stderr += c.toString()))
    child.on("error", (e) => {
      clearTimeout(timer)
      resolveP({
        stdout: timedOut ? "" : stdout,
        stderr: timedOut ? String(e) : stderr + String(e),
        exitCode: -1,
        timedOut,
      })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolveP({ stdout, stderr, exitCode: timedOut ? -1 : code ?? -1, timedOut })
    })
  })
}
```

Remove the now-unused `Bun.spawn` usage. Keep the existing top-of-file imports; add the `node:child_process` import if absent.

- [ ] **Step 4: Run tests to verify green**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/claude-cli-agent.test.ts`
Expected: PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/claude-cli-agent.ts tests/dispatcher/claude-cli-agent.test.ts
git commit -m "refactor(claude-cli): port defaultRunner Bun.spawn -> node:child_process (STAB-2 kill preserved)"
```

---

## Task 3: Convert remaining Bun.spawn / Bun.which call sites

**Files (every remaining `Bun.spawn` + the one `Bun.which`):**
- Modify: `src/commands/canary.ts:35`
- Modify: `src/commands/watch-ci-failure.ts:22`
- Modify: `src/dispatcher/canary.ts:135,168,198`
- Modify: `src/dispatcher/land.ts:304`
- Modify: `src/dispatcher/gh-runner.ts:71,111`
- Modify: `src/dispatcher/ship-failure.ts:114` (and any other Bun.spawn in that file)
- Modify: `src/dispatcher/spawn.ts:456` (`Bun.which`)
- Tests: existing `canary.test.ts`, `ship-failure.test.ts`, `gh-runner.test.ts`, `land.test.ts` must stay green.

Canonical transform — the recurring async git/subprocess shape:

```typescript
// BEFORE
const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" })
const [stdout, _stderr, exitCode] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
  proc.exited,
])
if (exitCode !== 0) return null

// AFTER
import { spawnCapture } from "../dispatcher/subprocess"   // adjust relative depth per file
const { stdout, exitCode } = await spawnCapture(["git", ...args])
if (exitCode !== 0) return null
```

`Bun.which` transform:

```typescript
// BEFORE  (src/dispatcher/spawn.ts:456)
const hasCli = opts.hasClaudeCli ?? (() => Bun.which("claude") !== null)
// AFTER
import { whichSync } from "./subprocess"
const hasCli = opts.hasClaudeCli ?? (() => whichSync("claude") !== null)
```

- [ ] **Step 1: Apply the transform at every site listed above.** Preserve each call's surrounding logic (cwd, env, exitCode handling, trimming). Where a site passed `{ stdout, stderr, exitCode }` differently, map to `spawnCapture`'s `CaptureResult` fields.

- [ ] **Step 2: Verify ZERO Bun runtime calls remain (parallel-path completeness, §9)**

Run: `grep -rn "Bun\.\(spawn\|which\)" src/`
Expected: no matches (comments mentioning Bun are fine; code calls must be gone).

- [ ] **Step 3: Run the full suite + typecheck**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher && npm run typecheck`
Expected: PASS — 1035+ tests, 0 fail; tsc clean.

- [ ] **Step 4: Commit**

```bash
git add src/commands/canary.ts src/commands/watch-ci-failure.ts src/dispatcher/canary.ts src/dispatcher/land.ts src/dispatcher/gh-runner.ts src/dispatcher/ship-failure.ts src/dispatcher/spawn.ts
git commit -m "refactor: convert remaining Bun.spawn/Bun.which to node subprocess adapter"
```

---

## Task 4: Embedded-data module (inline contracts + prompts)

**Files:**
- Create: `src/dispatcher/embedded-data.ts`
- Test: `tests/dispatcher/embedded-data.test.ts`

Contracts to inline (from `contracts/`): `sgc-capabilities.yaml`, `sgc-state.schema.yaml`, `invariant-enforcement.yaml`, `vendored-components.yaml`, `sgc-invariants.md`. Prompts to inline: all 10 `prompts/*.md` (`clarifier-discover`, `classifier-level`, `compound-context`, `compound-prevention`, `compound-solution`, `planner-adversarial`, `planner-ceo`, `planner-eng`, `researcher-history`, `reviewer-correctness`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/dispatcher/embedded-data.test.ts
import { test, expect } from "bun:test"
import {
  EMBEDDED_CONTRACTS,
  EMBEDDED_PROMPTS,
  readContract,
  readPrompt,
  listEmbeddedPromptKeys,
} from "../../src/dispatcher/embedded-data"

test("contracts are inlined and non-empty", () => {
  expect(EMBEDDED_CONTRACTS["sgc-capabilities.yaml"]?.length).toBeGreaterThan(100)
  expect(EMBEDDED_CONTRACTS["sgc-state.schema.yaml"]?.length).toBeGreaterThan(100)
})

test("all 10 prompts are inlined", () => {
  expect(listEmbeddedPromptKeys().length).toBe(10)
  expect(EMBEDDED_PROMPTS["prompts/planner-eng.md"]?.length).toBeGreaterThan(50)
})

test("readContract returns embedded text by default", () => {
  expect(readContract("sgc-capabilities.yaml")).toBe(EMBEDDED_CONTRACTS["sgc-capabilities.yaml"])
})

test("readContract honors SGC_CONTRACTS_DIR override", () => {
  const prev = process.env["SGC_CONTRACTS_DIR"]
  process.env["SGC_CONTRACTS_DIR"] = process.cwd() + "/contracts"
  try {
    expect(readContract("sgc-capabilities.yaml").length).toBeGreaterThan(100)
  } finally {
    if (prev === undefined) delete process.env["SGC_CONTRACTS_DIR"]
    else process.env["SGC_CONTRACTS_DIR"] = prev
  }
})

test("readPrompt returns embedded text by default", () => {
  expect(readPrompt("prompts/planner-eng.md")).toBe(EMBEDDED_PROMPTS["prompts/planner-eng.md"])
})
```

(Note: follow [[feedback_bun_test_env_var_contamination]] — save/restore `SGC_CONTRACTS_DIR` as shown, never bare `delete`.)

- [ ] **Step 2: Run to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/embedded-data.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

```typescript
// src/dispatcher/embedded-data.ts
//
// Inlines contracts/ + prompts/ as text so the shipped node bundle is fully
// self-contained (no on-disk data files needed). Under bun (dev + bun build)
// the `with { type: "text" }` import attribute embeds the file text; bun build
// bakes it into plugins/sgc/bin/sgc.mjs. node only ever runs the bundled
// output, where the text is already inlined.
//
// Access ladder for every reader: SGC_*_DIR env override -> embedded -> disk
// fallback (dev source checkout without env). Env override keeps customization
// possible; disk fallback keeps a raw `bun src/sgc.ts` honest if a text import
// ever regresses.
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import capabilities from "../../contracts/sgc-capabilities.yaml" with { type: "text" }
import stateSchema from "../../contracts/sgc-state.schema.yaml" with { type: "text" }
import invariantEnforcement from "../../contracts/invariant-enforcement.yaml" with { type: "text" }
import vendoredComponents from "../../contracts/vendored-components.yaml" with { type: "text" }
import invariantsMd from "../../contracts/sgc-invariants.md" with { type: "text" }

import clarifierDiscover from "../../prompts/clarifier-discover.md" with { type: "text" }
import classifierLevel from "../../prompts/classifier-level.md" with { type: "text" }
import compoundContext from "../../prompts/compound-context.md" with { type: "text" }
import compoundPrevention from "../../prompts/compound-prevention.md" with { type: "text" }
import compoundSolution from "../../prompts/compound-solution.md" with { type: "text" }
import plannerAdversarial from "../../prompts/planner-adversarial.md" with { type: "text" }
import plannerCeo from "../../prompts/planner-ceo.md" with { type: "text" }
import plannerEng from "../../prompts/planner-eng.md" with { type: "text" }
import researcherHistory from "../../prompts/researcher-history.md" with { type: "text" }
import reviewerCorrectness from "../../prompts/reviewer-correctness.md" with { type: "text" }

export const EMBEDDED_CONTRACTS: Record<string, string> = {
  "sgc-capabilities.yaml": capabilities,
  "sgc-state.schema.yaml": stateSchema,
  "invariant-enforcement.yaml": invariantEnforcement,
  "vendored-components.yaml": vendoredComponents,
  "sgc-invariants.md": invariantsMd,
}

export const EMBEDDED_PROMPTS: Record<string, string> = {
  "prompts/clarifier-discover.md": clarifierDiscover,
  "prompts/classifier-level.md": classifierLevel,
  "prompts/compound-context.md": compoundContext,
  "prompts/compound-prevention.md": compoundPrevention,
  "prompts/compound-solution.md": compoundSolution,
  "prompts/planner-adversarial.md": plannerAdversarial,
  "prompts/planner-ceo.md": plannerCeo,
  "prompts/planner-eng.md": plannerEng,
  "prompts/researcher-history.md": researcherHistory,
  "prompts/reviewer-correctness.md": reviewerCorrectness,
}

const moduleDir = dirname(fileURLToPath(import.meta.url))
const diskContractsDir = resolve(moduleDir, "..", "..", "contracts")
const diskRepoRoot = resolve(moduleDir, "..", "..")

export function listEmbeddedPromptKeys(): string[] {
  return Object.keys(EMBEDDED_PROMPTS)
}

export function readContract(filename: string): string {
  const override = process.env["SGC_CONTRACTS_DIR"]
  if (override) return readDisk(resolve(override, filename), filename, "SGC_CONTRACTS_DIR")
  const embedded = EMBEDDED_CONTRACTS[filename]
  if (embedded !== undefined) return embedded
  return readDisk(resolve(diskContractsDir, filename), filename, "SGC_CONTRACTS_DIR")
}

export function readPrompt(relPath: string): string {
  const override = process.env["SGC_PROMPTS_DIR"]
  if (override) {
    const base = relPath.replace(/^prompts\//, "")
    return readDisk(resolve(override, base), relPath, "SGC_PROMPTS_DIR")
  }
  const embedded = EMBEDDED_PROMPTS[relPath]
  if (embedded !== undefined) return embedded
  return readDisk(resolve(diskRepoRoot, relPath), relPath, "SGC_PROMPTS_DIR")
}

function readDisk(path: string, label: string, envVar: string): string {
  try {
    return readFileSync(path, "utf8")
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === "ENOENT") {
      throw new Error(`sgc data not found: ${label} at ${path} — set ${envVar} if it lives elsewhere.`)
    }
    throw new Error(`sgc data unreadable: ${label} at ${path}: ${e.message}`)
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/embedded-data.test.ts`
Expected: PASS (5 tests). If the `with { type: "text" }` import errors under bun 1.3.5, fall back to `bun build --loader .yaml:text --loader .md:text` config (see Open Risks in the spec) — but verify the attribute syntax first: `bun -e 'import x from "./contracts/sgc-capabilities.yaml" with { type: "text" }; console.log(x.length)'`.

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/embedded-data.ts tests/dispatcher/embedded-data.test.ts
git commit -m "feat(embedded-data): inline contracts + prompts with env-override -> embedded -> disk ladder"
```

---

## Task 5: Route schema.ts contract reads through embedded ladder

**Files:**
- Modify: `src/dispatcher/schema.ts:18-42`
- Test: `tests/dispatcher/capabilities.test.ts` (existing — must stay green)

- [ ] **Step 1: Replace the local `readContract` with the embedded one**

In `src/dispatcher/schema.ts`, delete the local `moduleDir`/`defaultContractsDir`/`contractsDir`/`readContract` definitions (lines 18-42) and import from embedded-data instead:

```typescript
// remove the node:url import + moduleDir/defaultContractsDir/contractsDir/readContract block
import { readContract } from "./embedded-data"
```

Keep all `readContract("sgc-capabilities.yaml")` / `readContract("sgc-state.schema.yaml")` call sites unchanged — same signature. **Also drop any imports that become unused after deleting the block** (`readFileSync` from `node:fs`, `fileURLToPath` from `node:url`, and `resolve`/`dirname` from `node:path` if no other code in the file uses them) — `tsc --noEmit` runs with `noUnusedLocals` and will fail the CI gate otherwise.

- [ ] **Step 2: Run the capabilities + schema tests**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/capabilities.test.ts`
Expected: PASS — capabilities still load (now from embedded map).

- [ ] **Step 3: Run full suite + typecheck**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher && npm run typecheck`
Expected: PASS, 0 fail, tsc clean.

- [ ] **Step 4: Commit**

```bash
git add src/dispatcher/schema.ts
git commit -m "refactor(schema): load contracts via embedded-data ladder"
```

---

## Task 6: Route formatPrompt through embedded ladder

**Files:**
- Modify: `src/dispatcher/spawn.ts:552-559`
- Test: existing prompt-formatting tests (e.g. `tests/dispatcher/spawn*.test.ts`, `planner-eng` tests) stay green.

- [ ] **Step 1: Replace the disk read with `readPrompt`**

In `formatPrompt` (around line 552), replace:

```typescript
// BEFORE
if (manifest.prompt_path) {
  const templatePath = resolve(sgcRepoRoot, manifest.prompt_path)
  if (!existsSync(templatePath)) {
    throw new Error(`prompt_path declared (${manifest.prompt_path}) but file does not exist for agent ${manifest.name}`)
  }
  const template = readFileSync(templatePath, "utf8")
  ...
```

with:

```typescript
// AFTER
import { readPrompt } from "./embedded-data"
...
if (manifest.prompt_path) {
  const template = readPrompt(manifest.prompt_path)  // env -> embedded -> disk; throws a packaging-aware error if missing
  ...
```

Keep the downstream `<input_yaml/>` placeholder + `## Input` heading validations (lines ~562-569) unchanged.

- [ ] **Step 2: Run the dispatcher suite**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher && npm run typecheck`
Expected: PASS, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add src/dispatcher/spawn.ts
git commit -m "refactor(spawn): load prompt templates via embedded-data ladder"
```

---

## Task 7: doctor.ts — embedded data + graceful source-absent skip

**Files:**
- Modify: `src/commands/doctor.ts`
- Test: `tests/dispatcher/doctor.test.ts` (existing) + new assertions.

doctor's parity checks read source files (`prompts/` dir, `src/sgc.ts`). From a bundle these don't exist. Route data through embedded; skip source-only checks with a clear note when the source root is absent.

- [ ] **Step 1: Add a failing test for bundle-context behavior**

```typescript
// append to tests/dispatcher/doctor.test.ts
import { runDoctor } from "../../src/commands/doctor"

test("doctor (B) prompts check uses embedded keys, not readdirSync", async () => {
  const lines: string[] = []
  // point repoRoot at a dir with no prompts/ to prove it no longer depends on disk
  const report = await runDoctor({ log: (m) => lines.push(m), repoRoot: "/nonexistent-root-xyz" })
  // prompt_path <-> manifest parity must still resolve from embedded data
  expect(lines.some((l) => l.includes("planner-eng.md"))).toBe(true)
  expect(report.fail).toBe(0)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/doctor.test.ts`
Expected: FAIL — current doctor uses `existsSync(resolve(root, m.prompt_path))` + `readdirSync(promptsDir)`, so a bogus root yields failures/empty.

- [ ] **Step 3: Switch (A) and (B) to embedded data**

In `src/commands/doctor.ts`:
- Replace check (A)'s `existsSync(resolve(root, m.prompt_path))` with membership in embedded prompts: `EMBEDDED_PROMPTS[m.prompt_path] !== undefined`.
- Replace check (B)'s `readdirSync(promptsDir)` loop with iteration over `listEmbeddedPromptKeys()`.

```typescript
import { EMBEDDED_PROMPTS, listEmbeddedPromptKeys } from "../dispatcher/embedded-data"
...
// (A)
const present = EMBEDDED_PROMPTS[m.prompt_path] !== undefined
if (present) emit({ severity: "ok", msg: `  ✓ ${name} → ${m.prompt_path}` })
else emit({ severity: "fail", msg: `  ✗ ${name} → ${m.prompt_path} (NOT EMBEDDED)` })
...
// (B)
for (const rel of listEmbeddedPromptKeys().sort()) {
  if (declaredPrompts.has(rel)) emit({ severity: "ok", msg: `  ✓ ${rel}` })
  else emit({ severity: "warn", msg: `  ⚠ ${rel} (orphan — embedded but unreferenced)` })
}
```

- [ ] **Step 4: Guard the source-only checks (slash↔CLI parity reads src/sgc.ts)**

For the check that reads `src/sgc.ts` via `extractCliSubcommands` (and any invariant-source parity that reads files under `root`): wrap in an existence guard so a bundle context skips cleanly rather than failing.

```typescript
import { existsSync } from "node:fs"
const sgcSrc = resolve(root, "src", "sgc.ts")
if (!existsSync(sgcSrc)) {
  emit({ severity: "ok", msg: "  ⓘ slash↔CLI parity skipped (no source checkout — dev/CI-only check)" })
} else {
  // ...existing parity check...
}
```

- [ ] **Step 5: Run to verify pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/doctor.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/doctor.ts tests/dispatcher/doctor.test.ts
git commit -m "refactor(doctor): prompts/contracts via embedded data; skip source-only checks in bundle context"
```

---

## Task 8: build:cli script → node bundle with shebang

**Files:**
- Modify: `package.json` (scripts)
- Create (build output): `plugins/sgc/bin/sgc.mjs`

- [ ] **Step 1: Add the build script**

In `package.json` `scripts`, add:

```json
"build:cli": "bun build src/sgc.ts --target=node --format=esm --external playwright --outfile plugins/sgc/bin/sgc.mjs && node -e \"const f='plugins/sgc/bin/sgc.mjs';const fs=require('fs');let s=fs.readFileSync(f,'utf8');if(!s.startsWith('#!'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+s);else fs.writeFileSync(f,s.replace(/^#![^\\n]*\\n/,'#!/usr/bin/env node\\n'));fs.chmodSync(f,0o755)\""
```

(Builds the bundle, normalizes the shebang to `#!/usr/bin/env node`, makes it executable.)

- [ ] **Step 2: Build and smoke-run under node**

Run:
```bash
npm run build:cli
node plugins/sgc/bin/sgc.mjs --help
```
Expected: the bundle builds; `node` (NOT bun) prints sgc help with the subcommand list. No "Bun is not defined" / no missing-contract errors.

- [ ] **Step 3: Verify a data-dependent command works from the bundle**

Run: `cd /tmp && rm -rf sgc-bundle-smoke && mkdir sgc-bundle-smoke && cd sgc-bundle-smoke && node "$OLDPWD"/plugins/sgc/bin/sgc.mjs doctor`
Expected: doctor runs from a dir with no `contracts/`/`prompts/` on disk and no source — embedded data resolves, exit code 0. (Replace `$OLDPWD` with the repo path if the shell doesn't carry it.)

- [ ] **Step 4: Commit**

```bash
git add package.json plugins/sgc/bin/sgc.mjs
git commit -m "build(cli): bun build -> node ESM bundle plugins/sgc/bin/sgc.mjs (node shebang, contracts/prompts inlined)"
```

---

## Task 9: 4-tier CLI resolver across plugin commands

**Files:**
- Modify: every `plugins/sgc/commands/*.md` that contains the CLI resolver snippet.

- [ ] **Step 1: Enumerate the command files carrying a resolver**

Run: `grep -ln 'bun src/sgc.ts' plugins/sgc/commands/*.md`
Expected: a list (~16 files). These all carry the old 2/3-tier resolver.

- [ ] **Step 2: Replace each resolver block with the 4-tier snippet**

Old block (varies slightly per file) → new canonical block (bundle first per the locked precedence decision):

```bash
if   [ -f "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" ]; then SGC="node $CLAUDE_PLUGIN_ROOT/bin/sgc.mjs"
elif command -v sgc >/dev/null 2>&1;          then SGC=sgc
elif test -f src/sgc.ts;                      then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi
```

Apply to all files from Step 1. Keep each file's `$SGC <subcommand> ...` invocation lines unchanged.

- [ ] **Step 3: Verify every command file resolves bundle-first**

Run: `grep -L 'CLAUDE_PLUGIN_ROOT/bin/sgc.mjs' plugins/sgc/commands/*.md`
Expected: empty (every command file now has the bundle-first tier).

- [ ] **Step 4: Commit**

```bash
git add plugins/sgc/commands/
git commit -m "feat(commands): 4-tier CLI resolver, plugin-bundle first (\$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs)"
```

---

## Task 10: package.json npm packaging

**Files:**
- Modify: `package.json` (`bin`, `files`, `engines`)

- [ ] **Step 1: Point bin at the bundle, ship it, relax the runtime engine**

```json
"bin": { "sgc": "./plugins/sgc/bin/sgc.mjs" },
"files": [
  "plugins/sgc/bin/sgc.mjs",
  "src/",
  "contracts/",
  "prompts/",
  "README.md",
  "LICENSE",
  "CHANGELOG.md"
],
"engines": { "node": ">=18" }
```

(Remove `"bun": ">=1.3"` from `engines` — bun is now a dev/build tool only. `src/`+`contracts/`+`prompts/` stay in `files` so a source-level `npm i` still works and the disk fallback ladder stays honest.)

- [ ] **Step 2: Verify the npm tarball contents include the bundle**

Run: `npm pack --dry-run 2>&1 | grep -E 'sgc.mjs|contracts|prompts'`
Expected: `plugins/sgc/bin/sgc.mjs` listed, plus contracts/ + prompts/.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build(npm): bin -> bundle, ship bundle in files, engines node>=18 (drop bun runtime req)"
```

---

## Task 11: doctor bundle-hash parity check (dev/CI)

**Files:**
- Modify: `src/commands/doctor.ts`
- Test: `tests/dispatcher/doctor-bundle-parity.test.ts`

Guards against a stale committed bundle: when a source checkout is present, rebuild to a temp file and compare its sha256 against the committed `plugins/sgc/bin/sgc.mjs`. Skip when source absent (end-user bundle context).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/dispatcher/doctor-bundle-parity.test.ts
import { test, expect } from "bun:test"
import { bundleParityCheck } from "../../src/commands/doctor"

test("bundleParityCheck skips cleanly when source absent", async () => {
  const r = await bundleParityCheck("/nonexistent-root-xyz")
  expect(r.severity).toBe("ok")
  expect(r.msg).toMatch(/skipped/i)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/doctor-bundle-parity.test.ts`
Expected: FAIL — `bundleParityCheck` not exported.

- [ ] **Step 3: Implement the check**

```typescript
// src/commands/doctor.ts
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import { spawnCapture } from "../dispatcher/subprocess"

export async function bundleParityCheck(root: string): Promise<CheckRow> {
  const srcEntry = resolve(root, "src", "sgc.ts")
  const committed = resolve(root, "plugins", "sgc", "bin", "sgc.mjs")
  if (!existsSync(srcEntry) || !existsSync(committed)) {
    return { severity: "ok", msg: "  ⓘ bundle-hash parity skipped (no source checkout — dev/CI-only check)" }
  }
  const tmp = mkdtempSync(resolve(tmpdir(), "sgc-bundle-"))
  const out = resolve(tmp, "sgc.mjs")
  try {
    const r = await spawnCapture(
      ["bun", "build", srcEntry, "--target=node", "--format=esm", "--external", "playwright", "--outfile", out],
      { cwd: root },
    )
    if (r.exitCode !== 0) return { severity: "warn", msg: `  ⚠ bundle-hash parity: rebuild failed (${r.stderr.slice(0, 120)})` }
    const sha = (buf: Buffer) => createHash("sha256").update(buf).digest("hex")
    // strip shebang line from both before hashing (build:cli normalizes it post-build)
    const strip = (b: Buffer) => Buffer.from(b.toString("utf8").replace(/^#![^\n]*\n/, ""))
    const a = sha(strip(readFileSync(out)))
    const b = sha(strip(readFileSync(committed)))
    return a === b
      ? { severity: "ok", msg: "  ✓ committed bundle matches source rebuild" }
      : { severity: "fail", msg: "  ✗ committed bundle STALE — run `npm run build:cli` and commit" }
  } finally {
    rmSync(tmp, { recursive: true, force: true })   // §8.V4 sandbox disposal
  }
}
```

Wire it into `runDoctor`: `emit(await bundleParityCheck(root))` under a new `=== bundle parity ===` section.

- [ ] **Step 4: Run to verify pass + full doctor suite**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/doctor-bundle-parity.test.ts tests/dispatcher/doctor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/doctor.ts tests/dispatcher/doctor-bundle-parity.test.ts
git commit -m "feat(doctor): bundle-hash parity check (dev/CI; skips in bundle context)"
```

---

## Task 12: CI — build + verify bundle

**Files:**
- Modify: `.github/workflows/test.yml`
- Modify: `.github/workflows/publish.yml`

- [ ] **Step 1: test.yml — build the bundle and fail on staleness**

After the `Typecheck` step and before/after tests, add:

```yaml
      - name: Build CLI bundle
        run: npm run build:cli

      - name: Bundle parity (committed == rebuild)
        run: |
          git diff --exit-code plugins/sgc/bin/sgc.mjs \
            || (echo "ERROR: committed bundle is stale — run 'npm run build:cli' and commit" >&2; exit 1)
```

(The `build:cli` step rebuilds; `git diff --exit-code` fails the build if the committed bundle differs from the rebuild — the CI form of the doctor parity check.)

- [ ] **Step 2: publish.yml — build bundle before the publish gate**

In `publish.yml`, after `Install dependencies` and before `Run dispatcher tests`, add:

```yaml
      - name: Build CLI bundle
        run: npm run build:cli

      - name: Bundle parity (committed == rebuild)
        run: git diff --exit-code plugins/sgc/bin/sgc.mjs || (echo "stale bundle — rebuild + commit before tagging" >&2; exit 1)
```

Leave `npm publish --provenance` as-is (the bundle is now in `files`). Note [[feedback_npm_publish_provenance_403_false_negative]]: if publish goes red, verify `npm view @sdsrs/sgc@<ver> dist.shasum` before re-running.

- [ ] **Step 3: Verify workflow YAML is valid**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/test.yml','utf8')); require('js-yaml').load(require('fs').readFileSync('.github/workflows/publish.yml','utf8')); console.log('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test.yml .github/workflows/publish.yml
git commit -m "ci: build CLI bundle + fail on stale committed bundle (test + publish gates)"
```

---

## Task 13: Clean-container e2e (acceptance gate)

**Files:**
- Create: `tests/e2e/clean-container.test.sh`

The core acceptance: node-only container, no bun, no npm-global → simulate `/plugin install` (copy `plugins/sgc/`) → commands work.

- [ ] **Step 1: Write the e2e script**

```bash
#!/usr/bin/env bash
# tests/e2e/clean-container.test.sh
# Acceptance: plugin payload runs on node-only (no bun, no npm-global).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"

docker run --rm -v "$REPO":/repo:ro node:20-slim bash -c '
  set -euo pipefail
  command -v bun && { echo "FAIL: bun present, not a clean env" >&2; exit 1; } || true
  # Simulate /plugin install: copy payload to a CLAUDE_PLUGIN_ROOT.
  mkdir -p /plug && cp -r /repo/plugins/sgc/* /plug/
  export CLAUDE_PLUGIN_ROOT=/plug
  cd /tmp && mkdir proj && cd proj
  echo "--- sgc --help ---";   node "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" --help   | head -5
  echo "--- sgc doctor ---";   node "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" doctor   | tail -5
  echo "--- sgc plan (L0) ---";node "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" plan "fix a typo in README" --motivation "trivial copy fix, no logic, restores intended wording" || true
  echo "CLEAN-CONTAINER OK"
'
```

- [ ] **Step 2: Run it**

Run: `chmod +x tests/e2e/clean-container.test.sh && ./tests/e2e/clean-container.test.sh`
Expected: ends with `CLEAN-CONTAINER OK`; help/doctor/plan all run under node with bun absent. (If docker is unavailable, run the inner script under a local `node` with `PATH` stripped of bun + `CLAUDE_PLUGIN_ROOT` set to a copied payload dir.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/clean-container.test.sh
git commit -m "test(e2e): clean node-only container acceptance for plugin payload"
```

---

## Task 14: npm isolated-install e2e

**Files:**
- Create: `tests/e2e/npm-isolated-install.test.sh`

Uses the isolated-install pattern from [[feedback_npx_path_shadow]] — `npm i` into a mkdtemp prefix and invoke the resolved `.bin/sgc` directly (never bare `npx`, which PATH-shadows).

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# tests/e2e/npm-isolated-install.test.sh
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"
npm run build:cli
TARBALL="$(npm pack 2>/dev/null | tail -1)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK" "$REPO/$TARBALL"' EXIT     # §8.V4 disposal
cd "$WORK"
npm init -y >/dev/null 2>&1
npm install --no-save "$REPO/$TARBALL" >/dev/null 2>&1
BIN="$WORK/node_modules/.bin/sgc"
[ -x "$BIN" ] || { echo "FAIL: $BIN not executable" >&2; exit 1; }
echo "--- version ---"; node "$BIN" --version 2>/dev/null || node "$BIN" --help | head -1
echo "--- doctor ---";  node "$BIN" doctor | tail -3
echo "NPM-ISOLATED OK"
```

- [ ] **Step 2: Run it**

Run: `chmod +x tests/e2e/npm-isolated-install.test.sh && ./tests/e2e/npm-isolated-install.test.sh`
Expected: ends with `NPM-ISOLATED OK`; the packed tarball installs and `.bin/sgc` runs under node.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/npm-isolated-install.test.sh
git commit -m "test(e2e): isolated npm install acceptance (no PATH-shadow)"
```

---

## Final verification (run after all tasks)

- [ ] `grep -rn "Bun\.\(spawn\|which\)" src/` → no code matches.
- [ ] `SGC_FORCE_INLINE=1 bun test tests/dispatcher` → ≥1035 pass, 0 fail.
- [ ] `npm run typecheck` → clean.
- [ ] `npm run build:cli && git diff --exit-code plugins/sgc/bin/sgc.mjs` → no diff (committed bundle fresh).
- [ ] `./tests/e2e/clean-container.test.sh` → `CLEAN-CONTAINER OK`.
- [ ] `./tests/e2e/npm-isolated-install.test.sh` → `NPM-ISOLATED OK`.

## Out of scope (later phases)

POSITIONING coexist→self-contained rewrite (Phase 1); native capability closure — TDD-ledger / deep-planning / rich-review (Phase 2); browse binary full support on the npm channel (graceful degradation only here).
