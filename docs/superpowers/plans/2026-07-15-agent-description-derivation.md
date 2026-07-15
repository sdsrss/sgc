# Agent Description Derivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive the `Separate fact for sgc CLI users: …` half of 9 agent descriptions from code, and make `doctor` fail when a file disagrees with the derivation.

**Architecture:** Matcher term lists become data (`{display, re, wordBounded}` triples); both the matcher regex and the spawn trigger are built from that one list. A new `agent-facts.ts` composes the canonical CLI-fact clause from the manifest (`prompt_path`, `status`) plus those facts. `doctor` check (O) asserts each description ends with exactly that clause and fails otherwise; `sgc doctor --write-descriptions` regenerates it. The hand-written capability sentence is never touched by any of this.

**Tech Stack:** TypeScript, bun test, js-yaml. No new dependencies.

## Global Constraints

- **Iron Law #1 — every task is RED first.** A test that has never failed proves nothing.
- **`SGC_FORCE_INLINE=1 bun test tests/` is the ONLY correct test invocation.** A bare `bun test` reaches a real LLM and hangs. This applies to every Run step below.
- **Baseline to beat (measured at `95d0421`):** 1499 pass / 38 skip / 0 fail · `npm run typecheck` exit 0 · `SGC_FORCE_INLINE=1 bun run src/sgc.ts doctor` → 70 OK / 0 warn / 0 fail · `npm audit` 0 vulnerabilities.
- **Scope is exactly 9 files.** `plugins/sgc/agents/reviewer/{security,tests,performance,maintainability,migration,infra,adversarial,spec}.md` and `plugins/sgc/agents/janitor/archive.md`. The other 10 agents are recorded debt in the spec; do not touch them.
- **No behaviour change to `sgc review`.** Every regex this plan rebuilds must match exactly what it matched before. Task 2 and Task 3 each pin this with an equivalence test.
- **`npm run build:cli` must use bun 1.3.5, not the local 1.3.11.** bun's output is not byte-stable across versions: a bundle built with 1.3.11 passes `doctor` locally (it rebuilds with the same bun) and fails CI (which rebuilds with 1.3.5). See Task 9.
- **§2 L3.** These files are LLM-visible metadata steering Claude Code routing. Implementation needs hard AUTH; ships as **v1.36.0**, non-patch, with a §2-EXT migration note.
- Commit after every task. `git commit` messages end with the repo's `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/dispatcher/agents/terms.ts` **(new)** | The `Term` triple and `buildPattern()`. Knows nothing about agents — pure regex construction. |
| `src/dispatcher/agents/reviewer-specialists.ts` (modify) | The 4 matcher defs become term lists; matcher + trigger both built from them. |
| `src/dispatcher/agents/reviewer-quality.ts` (modify) | Exports `tests` / `maintainability` facts as data (they have no `SpecialistDef` today — severities are inline literals). |
| `src/dispatcher/agent-facts.ts` **(new)** | `deriveCliFact(agentId)` — the single source for the clause. Composes manifest facts + matcher facts into the 4 clause shapes. |
| `src/commands/doctor.ts` (modify) | Check (O): assert + fail. `--write-descriptions`: regenerate. |
| `tests/dispatcher/terms.test.ts` **(new)** | `buildPattern` unit tests. |
| `tests/dispatcher/agent-facts.test.ts` **(new)** | `deriveCliFact` per-shape tests + the defect-reproduction suite. |
| `tests/dispatcher/reviewer-specialists.test.ts` (modify) | Keep M5's reachability test verbatim; add regex-equivalence pins. |

---

### Task 1: The `Term` triple and `buildPattern()`

**Files:**
- Create: `src/dispatcher/agents/terms.ts`
- Test: `tests/dispatcher/terms.test.ts`

**Interfaces:**
- Produces: `type Term = { display: string; re: string; wordBounded: boolean }`, `buildPattern(terms: readonly Term[], flags?: string): RegExp`, `displayList(terms: readonly Term[]): string`

- [ ] **Step 1: Write the failing test**

Create `tests/dispatcher/terms.test.ts`:

```ts
import { describe, expect, test } from "bun:test"
import { buildPattern, displayList, type Term } from "../../src/dispatcher/agents/terms"

describe("buildPattern", () => {
  test("word-bounded terms are wrapped in a single \\b(...)\\b group", () => {
    const terms: Term[] = [
      { display: "cache", re: "cache", wordBounded: true },
      { display: "index", re: "index", wordBounded: true },
    ]
    expect(buildPattern(terms).source).toBe("\\b(cache|index)\\b")
  })

  test("unbounded terms alternate OUTSIDE the group", () => {
    // This is the M5 shape. A \b after a literal ')' only matches when the next
    // char is a word char, so "O(n)" never matched while being advertised.
    const terms: Term[] = [
      { display: "cache", re: "cache", wordBounded: true },
      { display: "O(n…)", re: String.raw`O\(n\^?\d*\)`, wordBounded: false },
    ]
    const re = buildPattern(terms)
    expect(re.source).toBe("\\b(cache)\\b|O\\(n\\^?\\d*\\)")
    expect(re.test("// O(n^2) hot loop")).toBe(true)
    expect(re.test("const x = O(n)")).toBe(true)
    expect(re.test("indexOf(y)")).toBe(false)
  })

  test("all-unbounded produces no \\b group at all", () => {
    const terms: Term[] = [
      { display: "Dockerfile", re: "Dockerfile", wordBounded: false },
      { display: "FROM <x>", re: String.raw`FROM\s+\w`, wordBounded: false },
    ]
    expect(buildPattern(terms).source).toBe("Dockerfile|FROM\\s+\\w")
  })

  test("is case-insensitive by default and honours an explicit flag string", () => {
    const terms: Term[] = [{ display: "auth", re: "auth", wordBounded: false }]
    expect(buildPattern(terms).flags).toBe("i")
    expect(buildPattern(terms, "gi").flags).toBe("gi")
  })

  test("displayList joins the display names, not the regex sources", () => {
    const terms: Term[] = [
      { display: "O(n…)", re: String.raw`O\(n\^?\d*\)`, wordBounded: false },
      { display: "n+1", re: String.raw`n\+1`, wordBounded: true },
    ]
    expect(displayList(terms)).toBe("O(n…)|n+1")
  })

  test("an empty term list throws rather than building a regex matching everything", () => {
    expect(() => buildPattern([])).toThrow(/at least one term/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/terms.test.ts`
Expected: FAIL — `Cannot find module '../../src/dispatcher/agents/terms'`

- [ ] **Step 3: Write minimal implementation**

Create `src/dispatcher/agents/terms.ts`:

```ts
// Term lists as data — the source both the matcher regex and the advertised
// term list in an agent's description are built from.
//
// Why this exists: through v1.35.0 the term list lived hand-written in
// plugins/sgc/agents/reviewer/*.md while the regex lived here, three files away.
// They disagreed twice — the description omitted signature|encrypt|decrypt, and
// advertised an O(n) term the regex could not match in any natural context.
// Inverting the dependency makes that class of defect unrepresentable.

/**
 * `display` is what a human sees advertised; `re` is what actually matches;
 * `wordBounded` decides which side of the \b(...)\b group it lands on.
 *
 * The split matters: a \b after a literal ')' requires a word character next, so
 * `O\(n\)` inside \b(...)\b matched "O(n)x" and nothing a human would ever write.
 */
export type Term = { display: string; re: string; wordBounded: boolean }

/** Build the matcher: \b(bounded|terms)\b|unbounded|terms */
export function buildPattern(terms: readonly Term[], flags = "i"): RegExp {
  if (terms.length === 0) {
    throw new Error("buildPattern needs at least one term — an empty alternation matches everything")
  }
  const bounded = terms.filter((t) => t.wordBounded).map((t) => t.re)
  const free = terms.filter((t) => !t.wordBounded).map((t) => t.re)
  const parts: string[] = []
  if (bounded.length > 0) parts.push(`\\b(${bounded.join("|")})\\b`)
  if (free.length > 0) parts.push(free.join("|"))
  return new RegExp(parts.join("|"), flags)
}

/** The advertised list, e.g. "auth|jwt|token". Display names, never `re`. */
export function displayList(terms: readonly Term[]): string {
  return terms.map((t) => t.display).join("|")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/terms.test.ts`
Expected: PASS — 6 pass, 0 fail

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck   # expect exit 0
git add src/dispatcher/agents/terms.ts tests/dispatcher/terms.test.ts
git commit -m "feat(agents): Term triple + buildPattern — term lists become data

The \\b-after-')' trap that killed big-O detection through v1.35.0 is now a
property of the data (wordBounded: false), not something each matcher has to
remember.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: The 4 specialist matchers build from term lists

**Files:**
- Modify: `src/dispatcher/agents/reviewer-specialists.ts`
- Test: `tests/dispatcher/reviewer-specialists.test.ts` (add to; keep every existing test)

**Interfaces:**
- Consumes: `Term`, `buildPattern`, `displayList` from Task 1.
- Produces: each `SpecialistDef` gains `terms: readonly Term[]`; `DIFF_CONDITIONAL_SPECIALISTS[n]` gains `triggerOnly: readonly Term[]` (terms that spawn but never report — `perf`, `performance`). Exported: `SECURITY`, `MIGRATION`, `PERFORMANCE`, `INFRA`.

**Critical:** the rebuilt regexes MUST match exactly what they matched at `95d0421`. Step 1 pins that before anything moves.

- [ ] **Step 1: Write the failing equivalence test**

Add to `tests/dispatcher/reviewer-specialists.test.ts`:

```ts
import { buildPattern, displayList } from "../../src/dispatcher/agents/terms"
import {
  SECURITY, MIGRATION, PERFORMANCE, INFRA,
} from "../../src/dispatcher/agents/reviewer-specialists"

describe("Task 2 — rebuilt patterns are equivalent to the v1.35.0 hand-written ones", () => {
  // Frozen copies of the exact sources at 95d0421. If a rebuild changes what is
  // matched, this fails — the refactor is not allowed to alter behaviour.
  const FROZEN: Record<string, RegExp> = {
    "reviewer.security": /(auth|jwt|token|session|crypto|password|secret|signature|encrypt|decrypt|verifyAuth|signJwt|signToken)/i,
    "reviewer.migration": /\b(ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+TABLE|ALTER\s+COLUMN|RENAME\s+COLUMN|migration|backfill)\b/i,
    "reviewer.performance": /\b(cache|cach(ed|ing)|index|memoi[sz]e|debounce|throttle|n\+1|benchmark|p9[59])\b|O\(n\^?\d*\)/i,
    "reviewer.infra": /(Dockerfile|FROM\s+\w|kubectl|k8s\b|terraform|helm|argo|fly\.toml|render\.yaml|vercel\.json|github\/workflows)/i,
  }
  const PROBES = [
    "auth", "jwt", "verifyAuthToken(x)", "signature", "encryptPayload(y)",
    "ALTER TABLE users", "migration", "backfill", "ALTERTABLE",
    "cache", "cached", "caching", "index", "indexOf(z)", "reindexed", "memoize(f)",
    "memoise(f)", "debounce(fn,300)", "throttle(x)", "O(n)", "O(n^2)",
    "// O(n) scan", "O(n)x", "n+1", "benchmark", "p95", "p99", "p97",
    "Dockerfile", "FROM node:20-alpine", "kubectl", "k8s ", "terraform", "helm",
    "argo", "fly.toml", "render.yaml", "vercel.json", "github/workflows",
    "const x = 1", "", "  ",
  ]
  for (const def of [SECURITY, MIGRATION, PERFORMANCE, INFRA]) {
    test(`${def.name} — built pattern agrees with the frozen one on every probe`, () => {
      const frozen = FROZEN[def.name]!
      for (const p of PROBES) {
        expect(`${def.name} ${JSON.stringify(p)} → ${def.pattern.test(p)}`)
          .toBe(`${def.name} ${JSON.stringify(p)} → ${frozen.test(p)}`)
      }
    })
    test(`${def.name} — pattern is literally built from its terms`, () => {
      expect(def.pattern.source).toBe(buildPattern(def.terms).source)
    })
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/reviewer-specialists.test.ts`
Expected: FAIL — `SECURITY` etc. are not exported; `def.terms` is undefined.

- [ ] **Step 3: Convert the defs**

In `src/dispatcher/agents/reviewer-specialists.ts`, add to the imports:

```ts
import { buildPattern, displayList, type Term } from "./terms"
```

Extend the interface:

```ts
interface SpecialistDef {
  name: string
  terms: readonly Term[]
  pattern: RegExp
  severity: Severity
  describe: (line: string) => string
}
```

Replace the four defs. `security` (note `verifyAuth|signJwt|signToken` are redundant with `auth|jwt|token` but are kept so the frozen-equivalence test holds — removing them is a separate decision):

```ts
export const SECURITY_TERMS: readonly Term[] = [
  { display: "auth", re: "auth", wordBounded: false },
  { display: "jwt", re: "jwt", wordBounded: false },
  { display: "token", re: "token", wordBounded: false },
  { display: "session", re: "session", wordBounded: false },
  { display: "crypto", re: "crypto", wordBounded: false },
  { display: "password", re: "password", wordBounded: false },
  { display: "secret", re: "secret", wordBounded: false },
  { display: "signature", re: "signature", wordBounded: false },
  { display: "encrypt", re: "encrypt", wordBounded: false },
  { display: "decrypt", re: "decrypt", wordBounded: false },
  { display: "verifyAuth", re: "verifyAuth", wordBounded: false },
  { display: "signJwt", re: "signJwt", wordBounded: false },
  { display: "signToken", re: "signToken", wordBounded: false },
]
export const SECURITY: SpecialistDef = {
  name: "reviewer.security",
  terms: SECURITY_TERMS,
  pattern: buildPattern(SECURITY_TERMS),
  severity: "medium",
  describe: (line) => `security-sensitive change in added line: ${line}`,
}

export const MIGRATION_TERMS: readonly Term[] = [
  { display: "ALTER TABLE", re: String.raw`ALTER\s+TABLE`, wordBounded: true },
  { display: "DROP TABLE", re: String.raw`DROP\s+TABLE`, wordBounded: true },
  { display: "CREATE TABLE", re: String.raw`CREATE\s+TABLE`, wordBounded: true },
  { display: "ALTER COLUMN", re: String.raw`ALTER\s+COLUMN`, wordBounded: true },
  { display: "RENAME COLUMN", re: String.raw`RENAME\s+COLUMN`, wordBounded: true },
  { display: "migration", re: "migration", wordBounded: true },
  { display: "backfill", re: "backfill", wordBounded: true },
]
export const MIGRATION: SpecialistDef = {
  name: "reviewer.migration",
  terms: MIGRATION_TERMS,
  pattern: buildPattern(MIGRATION_TERMS),
  severity: "high",
  describe: (line) => `migration-shaped change requires explicit rollback + concurrency review: ${line}`,
}

export const PERFORMANCE_TERMS: readonly Term[] = [
  { display: "cache", re: "cache", wordBounded: true },
  { display: "cached/caching", re: "cach(ed|ing)", wordBounded: true },
  { display: "index", re: "index", wordBounded: true },
  { display: "memoize", re: "memoi[sz]e", wordBounded: true },
  { display: "debounce", re: "debounce", wordBounded: true },
  { display: "throttle", re: "throttle", wordBounded: true },
  { display: "n+1", re: String.raw`n\+1`, wordBounded: true },
  { display: "benchmark", re: "benchmark", wordBounded: true },
  { display: "p95/p99", re: "p9[59]", wordBounded: true },
  // NOT word-bounded — a trailing \b after the literal ')' is what made big-O
  // detection dead through v1.35.0.
  { display: "O(n…)", re: String.raw`O\(n\^?\d*\)`, wordBounded: false },
]
export const PERFORMANCE: SpecialistDef = {
  name: "reviewer.performance",
  terms: PERFORMANCE_TERMS,
  pattern: buildPattern(PERFORMANCE_TERMS),
  severity: "medium",
  describe: (line) => `performance-touching change in added line: ${line}`,
}

export const INFRA_TERMS: readonly Term[] = [
  { display: "Dockerfile", re: "Dockerfile", wordBounded: false },
  { display: "FROM <image>", re: String.raw`FROM\s+\w`, wordBounded: false },
  { display: "kubectl", re: "kubectl", wordBounded: false },
  { display: "k8s", re: String.raw`k8s\b`, wordBounded: false },
  { display: "terraform", re: "terraform", wordBounded: false },
  { display: "helm", re: "helm", wordBounded: false },
  { display: "argo", re: "argo", wordBounded: false },
  { display: "fly.toml", re: String.raw`fly\.toml`, wordBounded: false },
  { display: "render.yaml", re: String.raw`render\.yaml`, wordBounded: false },
  { display: "vercel.json", re: String.raw`vercel\.json`, wordBounded: false },
  { display: "github/workflows", re: String.raw`github\/workflows`, wordBounded: false },
]
export const INFRA: SpecialistDef = {
  name: "reviewer.infra",
  terms: INFRA_TERMS,
  pattern: buildPattern(INFRA_TERMS),
  severity: "high",
  describe: (line) => `infra-shaped change requires deploy + rollback review: ${line}`,
}
```

**Note on ordering:** `buildPattern` emits bounded terms first, then unbounded. `PERFORMANCE`'s frozen source has the same order (bounded group, then `O\(n…\)`), and for the others every term is on one side, so all four sources reproduce exactly. `INFRA_TERMS` order matches the frozen source's order.

- [ ] **Step 4: Rebuild the triggers from the same lists**

Replace the `DIFF_CONDITIONAL_SPECIALISTS` entries. Triggers = the matcher's terms **plus** trigger-only terms, all unbounded (a trigger tests the whole diff, including file headers, by design — see the docblock above the table):

```ts
/** Terms that SPAWN a specialist but that its matcher never reports on. */
const PERFORMANCE_TRIGGER_ONLY: readonly Term[] = [
  { display: "perf", re: "perf", wordBounded: false },
  { display: "performance", re: "performance", wordBounded: false },
]

const unbound = (ts: readonly Term[]): Term[] => ts.map((t) => ({ ...t, wordBounded: false }))

export const DIFF_CONDITIONAL_SPECIALISTS: readonly SpecialistDescriptor[] = [
  { name: "reviewer.security", trigger: buildPattern(unbound(SECURITY_TERMS)), agent: reviewerSecurity },
  { name: "reviewer.migration", trigger: buildPattern(unbound(MIGRATION_TERMS)), agent: reviewerMigration },
  {
    name: "reviewer.performance",
    trigger: buildPattern(unbound([...PERFORMANCE_TERMS, ...PERFORMANCE_TRIGGER_ONLY])),
    agent: reviewerPerformance,
  },
  { name: "reviewer.infra", trigger: buildPattern(unbound(INFRA_TERMS)), agent: reviewerInfra },
] as const
```

Building triggers from the matcher's own list is what makes M5's reachability invariant structural: an unreachable term (`debounce`, `throttle`, `argo` were all matcher-only) can no longer be written.

Delete the now-stale M5 pin block `describe("M5 — regex-source pins (edit a pattern → update the probes above)")` from `tests/dispatcher/reviewer-specialists.test.ts` — it pinned hand-written trigger sources that no longer exist. **Keep** `describe("M5 — every matcher term is reachable through its trigger")` exactly as-is; construction now guarantees it, and its job from here is to fail on the refactor that stops.

- [ ] **Step 5: Run the full specialists suite**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/reviewer-specialists.test.ts`
Expected: PASS, 0 fail. The M5 reachability tests must still pass unchanged.

- [ ] **Step 6: Run the full suite — this refactor touches `sgc review`**

Run: `SGC_FORCE_INLINE=1 bun test tests/`
Expected: 0 fail. Pass count ≥ 1499 + the new tests.

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck   # expect exit 0
git add src/dispatcher/agents/reviewer-specialists.ts tests/dispatcher/reviewer-specialists.test.ts
git commit -m "refactor(agents): the 4 specialist matchers build from term lists

Matcher AND trigger are now built from one list per specialist, so a
matcher-only term — debounce, throttle, argo, all shipped unreachable — can no
longer be written. Frozen-equivalence probes pin that no match changed.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: The quality reviewers expose their facts as data

**Files:**
- Modify: `src/dispatcher/agents/reviewer-quality.ts`
- Test: `tests/dispatcher/reviewer-quality.test.ts` (add to)

**Interfaces:**
- Consumes: `Term`, `buildPattern` from Task 1.
- Produces: `MAINT_MARKER_TERMS: readonly Term[]`, `MAX_LINE: number` (already exists; export it), `MAINTAINABILITY_SEVERITY: Severity`, `TESTS_SEVERITY: Severity`, `TESTS_MECHANISM: string`.

`reviewerTests` and `reviewerMaintainability` have **no `SpecialistDef`** — they are hand-rolled functions whose severities are inline literals (`"medium"` and `"low"`). They need their facts lifted out before `agent-facts.ts` can read them.

- [ ] **Step 1: Write the failing test**

Add to `tests/dispatcher/reviewer-quality.test.ts`:

```ts
import {
  MAINT_MARKER_TERMS, MAX_LINE, MAINTAINABILITY_SEVERITY,
  TESTS_SEVERITY, TESTS_MECHANISM,
} from "../../src/dispatcher/agents/reviewer-quality"
import { buildPattern } from "../../src/dispatcher/agents/terms"

describe("Task 3 — quality reviewer facts are data", () => {
  test("the marker regex is built from MAINT_MARKER_TERMS and is unchanged", () => {
    const FROZEN = /(TODO|FIXME|@ts-ignore|@ts-nocheck|eslint-disable|\bas any\b)/
    const built = buildPattern(MAINT_MARKER_TERMS, "")
    for (const p of ["TODO", "FIXME", "@ts-ignore", "@ts-nocheck", "eslint-disable",
                     "x as any", "asany", "as anything", "const x = 1"]) {
      expect(`${JSON.stringify(p)} → ${built.test(p)}`).toBe(`${JSON.stringify(p)} → ${FROZEN.test(p)}`)
    }
  })

  test("severities match what the functions actually return", () => {
    expect(MAX_LINE).toBe(120)
    expect(MAINTAINABILITY_SEVERITY).toBe("low")
    expect(TESTS_SEVERITY).toBe("medium")
  })

  test("TESTS_MECHANISM names a file-path check, not a keyword match", () => {
    // M4 called this a "keyword matcher". It is a path regex over `+++ b/<path>`
    // headers and reads no line content — and "keyword match" was, precisely, the
    // phrase that satisfied doctor's honesty gate.
    expect(TESTS_MECHANISM).toMatch(/file-path/i)
    expect(TESTS_MECHANISM).not.toMatch(/keyword/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/reviewer-quality.test.ts`
Expected: FAIL — none of those symbols are exported.

- [ ] **Step 3: Lift the facts out**

In `src/dispatcher/agents/reviewer-quality.ts`, add the import and replace the two constants:

```ts
import { buildPattern, type Term } from "./terms"

/** Suppression / escape-hatch markers. `as any` is word-bounded; the rest are not. */
export const MAINT_MARKER_TERMS: readonly Term[] = [
  { display: "TODO", re: "TODO", wordBounded: false },
  { display: "FIXME", re: "FIXME", wordBounded: false },
  { display: "@ts-ignore", re: "@ts-ignore", wordBounded: false },
  { display: "@ts-nocheck", re: "@ts-nocheck", wordBounded: false },
  { display: "eslint-disable", re: "eslint-disable", wordBounded: false },
  { display: "as any", re: "as any", wordBounded: true },
]
const MAINT_MARKERS = buildPattern(MAINT_MARKER_TERMS, "")   // case-SENSITIVE, as before
export const MAX_LINE = 120
export const MAINTAINABILITY_SEVERITY: Severity = "low"
export const TESTS_SEVERITY: Severity = "medium"
export const TESTS_MECHANISM =
  "a file-path check over the diff's `+++ b/<path>` headers"
```

**Careful — the frozen `MAINT_MARKERS` has NO `i` flag.** `buildPattern` defaults to `"i"`; pass `""` explicitly or `todo` starts matching `TODO`.

Then replace the inline severity literals so the exported constants are the only source:

```ts
// in reviewerTests:
    return { verdict: "concern", severity: TESTS_SEVERITY, findings }
// in reviewerMaintainability:
  const severity: Severity = findings.length > 0 ? MAINTAINABILITY_SEVERITY : "none"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/reviewer-quality.test.ts`
Expected: PASS, 0 fail

- [ ] **Step 5: Full suite, typecheck, commit**

```bash
SGC_FORCE_INLINE=1 bun test tests/   # expect 0 fail
npm run typecheck                    # expect exit 0
git add src/dispatcher/agents/reviewer-quality.ts tests/dispatcher/reviewer-quality.test.ts
git commit -m "refactor(agents): lift the quality reviewers' facts out as data

Their severities were inline literals and their mechanism existed only as prose
in a .md three files away — which is how 'file-path check' got shipped as
'keyword matcher', the one phrase that happened to satisfy the honesty gate.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `deriveCliFact()` — the single source for the clause

**Files:**
- Create: `src/dispatcher/agent-facts.ts`
- Test: `tests/dispatcher/agent-facts.test.ts`

**Interfaces:**
- Consumes: `displayList` (Task 1); `SECURITY|MIGRATION|PERFORMANCE|INFRA` (Task 2); `MAINT_MARKER_TERMS|MAX_LINE|MAINTAINABILITY_SEVERITY|TESTS_SEVERITY|TESTS_MECHANISM` (Task 3); `getSubagentManifest` from `src/dispatcher/schema`.
- Produces: `CLI_FACT_MARKER: string`, `deriveCliFact(agentId: string): string`, `DERIVED_AGENT_IDS: readonly string[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/dispatcher/agent-facts.test.ts`:

```ts
import { describe, expect, test } from "bun:test"
import { deriveCliFact, DERIVED_AGENT_IDS, CLI_FACT_MARKER } from "../../src/dispatcher/agent-facts"

describe("deriveCliFact — the four shapes", () => {
  test("covers exactly the 9 in-scope ids", () => {
    expect([...DERIVED_AGENT_IDS].sort()).toEqual([
      "janitor.archive", "reviewer.adversarial", "reviewer.infra",
      "reviewer.maintainability", "reviewer.migration", "reviewer.performance",
      "reviewer.security", "reviewer.spec", "reviewer.tests",
    ])
  })

  test("every clause starts with the marker", () => {
    for (const id of DERIVED_AGENT_IDS) {
      expect(deriveCliFact(id).startsWith(CLI_FACT_MARKER)).toBe(true)
    }
  })

  test("LLM-backed with fallback (security) names the prompt AND the fallback terms", () => {
    const f = deriveCliFact("reviewer.security")
    expect(f).toContain("prompts/reviewer-security.md")
    expect(f).toContain("auth|jwt|token")
    expect(f).toContain("signature|encrypt|decrypt")   // the M4 omission
    expect(f).toContain("medium severity")
  })

  test("term-list matcher (performance) advertises exactly its terms, incl. O(n…)", () => {
    const f = deriveCliFact("reviewer.performance")
    expect(f).toContain("O(n…)")
    expect(f).toContain("debounce|throttle")
    expect(f).not.toContain("prompts/")   // no LLM path
  })

  test("threshold + marker list (maintainability) carries BOTH facts", () => {
    const f = deriveCliFact("reviewer.maintainability")
    expect(f).toContain("120")
    expect(f).toContain("@ts-ignore")
    expect(f).toContain("low severity")
  })

  test("tests names a file-path check, never a keyword matcher", () => {
    const f = deriveCliFact("reviewer.tests")
    expect(f).toContain("file-path")
    expect(f).not.toMatch(/keyword/i)
  })

  test("CLI-never-runs (adversarial, spec, archive) says so and names no matcher", () => {
    for (const id of ["reviewer.adversarial", "reviewer.spec", "janitor.archive"]) {
      const f = deriveCliFact(id)
      expect(f).toMatch(/never (runs|produces)/i)
      expect(f).not.toContain("severity")
    }
  })

  test("an out-of-scope id throws rather than inventing a clause", () => {
    expect(() => deriveCliFact("planner.ceo")).toThrow(/not in the derived set/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/agent-facts.test.ts`
Expected: FAIL — `Cannot find module '../../src/dispatcher/agent-facts'`

- [ ] **Step 3: Write the implementation**

Create `src/dispatcher/agent-facts.ts`:

```ts
// The derived half of an agent description.
//
// Every one of the 9 descriptions is two parts: a hand-written capability
// sentence (judgement — humans own it) and this clause (fact — the machine owns
// it). 8 of the 9 defects the M4+M5 reviews found lived in this half; none lived
// in the other. So this half is no longer written by hand.
//
// See docs/superpowers/specs/2026-07-15-agent-description-derivation-design.md

import { getSubagentManifest } from "./schema"
import { displayList } from "./agents/terms"
import { SECURITY, MIGRATION, PERFORMANCE, INFRA } from "./agents/reviewer-specialists"
import {
  MAINT_MARKER_TERMS, MAX_LINE, MAINTAINABILITY_SEVERITY,
  TESTS_SEVERITY, TESTS_MECHANISM,
} from "./agents/reviewer-quality"

/** Everything from here to the end of a description is machine-owned. */
export const CLI_FACT_MARKER = "Separate fact for sgc CLI users:"

export const DERIVED_AGENT_IDS: readonly string[] = [
  "reviewer.security", "reviewer.tests", "reviewer.performance",
  "reviewer.maintainability", "reviewer.migration", "reviewer.infra",
  "reviewer.adversarial", "reviewer.spec", "janitor.archive",
]

const NO_BODY = "`sgc review` does not run this file's body"

function fallbackTerms(id: string): string {
  switch (id) {
    case "reviewer.security": return displayList(SECURITY.terms)
    case "reviewer.migration": return displayList(MIGRATION.terms)
    case "reviewer.performance": return displayList(PERFORMANCE.terms)
    case "reviewer.infra": return displayList(INFRA.terms)
    default: throw new Error(`${id} has no term list`)
  }
}

function severityOf(id: string): string {
  switch (id) {
    case "reviewer.security": return SECURITY.severity
    case "reviewer.migration": return MIGRATION.severity
    case "reviewer.performance": return PERFORMANCE.severity
    case "reviewer.infra": return INFRA.severity
    case "reviewer.tests": return TESTS_SEVERITY
    case "reviewer.maintainability": return MAINTAINABILITY_SEVERITY
    default: throw new Error(`${id} has no severity`)
  }
}

export function deriveCliFact(agentId: string): string {
  if (!DERIVED_AGENT_IDS.includes(agentId)) {
    throw new Error(`${agentId} is not in the derived set — see DERIVED_AGENT_IDS`)
  }
  const m = getSubagentManifest(agentId)
  if (!m) throw new Error(`${agentId} has no manifest entry`)

  // Shape 4 — the CLI never runs it at all.
  if (m.status === "slot-only" || m.status === "manual-only") {
    const why =
      agentId === "janitor.archive"
        ? "there is no archive command and no janitor-archive module"
        : "this id is not wired into the CLI"
    return `${CLI_FACT_MARKER} ${why} (manifest status: ${m.status}), so \`sgc review\` never produces a result for it — Claude Code dispatch is the only executor.`
  }

  // Shape 2 — LLM-backed, with the heuristic as fallback.
  if (m.prompt_path) {
    const fb =
      agentId === "reviewer.tests"
        ? `${TESTS_MECHANISM} that only asks whether test files were touched`
        : `a keyword matcher (${fallbackTerms(agentId)}) at ${severityOf(agentId)} severity`
    return `${CLI_FACT_MARKER} ${NO_BODY} — with an API key it runs ${m.prompt_path}; without one it falls back to ${fb}.`
  }

  // Shape 3 — threshold + marker list.
  if (agentId === "reviewer.maintainability") {
    return `${CLI_FACT_MARKER} ${NO_BODY} — reviewer.maintainability there is a heuristic matcher over added lines: longer than ${MAX_LINE} characters, or carrying a suppression marker (${displayList(MAINT_MARKER_TERMS)}), at ${MAINTAINABILITY_SEVERITY} severity. That is the whole of it.`
  }

  // Shape 1 — term-list matcher, no LLM path.
  return `${CLI_FACT_MARKER} ${NO_BODY} — ${agentId} there is a heuristic keyword matcher over added lines (${fallbackTerms(agentId)}) at ${severityOf(agentId)} severity, which matches words about the problem rather than detecting it. Its spawn trigger is deliberately wider than that matcher, so a spawned reviewer reporting zero findings is not evidence of a clean diff.`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/agent-facts.test.ts`
Expected: PASS, 0 fail

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck   # expect exit 0
git add src/dispatcher/agent-facts.ts tests/dispatcher/agent-facts.test.ts
git commit -m "feat(agents): deriveCliFact — the machine-owned half of a description

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: doctor check (O) — assert, and fail

**Files:**
- Modify: `src/commands/doctor.ts`
- Test: `tests/dispatcher/agent-facts.test.ts` (add to)

**Interfaces:**
- Consumes: `deriveCliFact`, `CLI_FACT_MARKER`, `DERIVED_AGENT_IDS` (Task 4); `readAgentMdFiles`, `AgentMdFile` (existing, `src/commands/doctor.ts`).
- Produces: `export function cliFactDrift(files: AgentMdFile[]): string[]`.

- [ ] **Step 1: Write the failing test**

Add to `tests/dispatcher/agent-facts.test.ts`:

```ts
import { cliFactDrift, readAgentMdFiles } from "../../src/commands/doctor"
import { resolve } from "node:path"
const ROOT = resolve(import.meta.dir, "../..")

const md = (id: string, desc: string) => ({
  id, file: `plugins/sgc/agents/${id.replace(".", "/")}.md`,
  text: `---\nname: ${id.replace(".", "-")}\ndescription: ${JSON.stringify(desc)}\n---\n\nbody\n`,
})

describe("doctor check (O) — the clause is asserted, not sniffed", () => {
  test("a description ending in the derived clause passes", () => {
    const good = `Does a useful thing. ${deriveCliFact("reviewer.performance")}`
    expect(cliFactDrift([md("reviewer.performance", good)])).toEqual([])
  })

  test("a stale clause fails AND the message carries the exact expected string", () => {
    const stale = `Does a useful thing. ${CLI_FACT_MARKER} something someone typed by hand.`
    const drifts = cliFactDrift([md("reviewer.performance", stale)])
    expect(drifts).toHaveLength(1)
    expect(drifts[0]).toContain(deriveCliFact("reviewer.performance"))
  })

  test("a missing clause fails", () => {
    const drifts = cliFactDrift([md("reviewer.performance", "Does a useful thing.")])
    expect(drifts).toHaveLength(1)
    expect(drifts[0]).toMatch(/no `Separate fact for sgc CLI users:` clause/)
  })

  test("a clause that LEADS fails — a routing field must not open with a disclaimer", () => {
    // M5's F1/F2: "NOT IMPLEMENTED" as the leading token is a phrase engineered to
    // stop the router in a field whose only job is to start it.
    const leads = `${deriveCliFact("reviewer.performance")} Does a useful thing.`
    const drifts = cliFactDrift([md("reviewer.performance", leads)])
    expect(drifts.length).toBeGreaterThan(0)
    expect(drifts.join(" ")).toMatch(/capability sentence must come first/)
  })

  test("out-of-scope agent files are ignored, not failed", () => {
    expect(cliFactDrift([md("planner.ceo", "Product gate reviewer.")])).toEqual([])
  })
})
```

**Note — the real-9-files test lives in Task 8, not here.** It cannot pass until the
generator has run, and a task that knowingly ends with a red suite makes the next two
tasks' reviews unreadable (a reviewer cannot tell an expected red from a new one).
Every task in this plan ends green.

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/agent-facts.test.ts`
Expected: FAIL — `cliFactDrift` is not exported.

- [ ] **Step 3: Implement `cliFactDrift`**

In `src/commands/doctor.ts`, add the import:

```ts
import { deriveCliFact, CLI_FACT_MARKER, DERIVED_AGENT_IDS } from "../dispatcher/agent-facts"
```

And the function, next to `agentMetadataDrift`:

```ts
/**
 * Check (O): the CLI-fact half of a description must be byte-identical to
 * deriveCliFact(id).
 *
 * agentMetadataDrift (above) checks that a description CONTAINS a disclosure
 * keyword. That is a magic-word test, and it has now failed in both directions:
 * it passed a term list missing three terms and an advertised O(n) the regex could
 * not match, and in M5 it REJECTED a more accurate description that happened to use
 * none of its words. This check compares against the code instead.
 */
export function cliFactDrift(files: AgentMdFile[]): string[] {
  const drifts: string[] = []
  for (const f of files) {
    if (!DERIVED_AGENT_IDS.includes(f.id)) continue
    let desc: string
    try {
      desc = readFrontmatterDescription(f.text)
    } catch (err) {
      drifts.push(`${f.id}: ${f.file} frontmatter does not parse (${String(err).slice(0, 80)})`)
      continue
    }
    const at = desc.indexOf(CLI_FACT_MARKER)
    if (at < 0) {
      drifts.push(
        `${f.id}: ${f.file} has no \`${CLI_FACT_MARKER}\` clause — run \`sgc doctor --write-descriptions\``,
      )
      continue
    }
    if (at === 0) {
      drifts.push(
        `${f.id}: ${f.file} opens with the CLI fact — the capability sentence must come first. ` +
          `This field's only consumer is Claude Code's dispatch decision; leading with a disclaimer suppresses it.`,
      )
      continue
    }
    const actual = desc.slice(at)
    const expected = deriveCliFact(f.id)
    if (actual !== expected) {
      drifts.push(
        `${f.id}: ${f.file} CLI-fact clause is stale.\n    expected: ${expected}\n    actual:   ${actual}\n` +
          `    fix: sgc doctor --write-descriptions`,
      )
    }
  }
  return drifts
}
```

- [ ] **Step 4: Wire it into `runDoctor` as a failing check**

Find the `// ── (N) agent registry ↔ manifest ──` block in `runDoctor` and add directly after it:

```ts
  // ── (O) agent description ↔ derived CLI fact ────────────────────────────
  log("")
  log("=== agent description ↔ derived CLI fact ===")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ CLI-fact derivation skipped (no plugins/sgc/agents/ — npm channel)" })
  } else {
    const factDrifts = cliFactDrift(readAgentMdFiles(root))
    if (factDrifts.length === 0) {
      emit({ severity: "ok", msg: `  ✓ ${DERIVED_AGENT_IDS.length} agent CLI-fact clauses match the code` })
    } else {
      for (const d of factDrifts) emit({ severity: "fail", msg: `  ✗ ${d}` })
    }
  }
```

- [ ] **Step 5: Run the check tests**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/agent-facts.test.ts`
Expected: PASS, 0 fail.

Then run the full suite — check (O) is now wired into `runDoctor`, and the 9 real files
have NOT been regenerated yet, so any test that runs the real doctor will see check (O)
fail. Run: `SGC_FORCE_INLINE=1 bun test tests/`

**If a doctor-level test goes red here, do NOT weaken check (O) to make it pass** —
that is the whole batch's failure mode in miniature. Report it: the fix is either to
scope the check behind `hasSource` (already in Step 4) or to move that test's expectation
to Task 8. Confirm the failure message prints the exact expected clause; that message is
the deliverable.

- [ ] **Step 6: Commit**

```bash
npm run typecheck   # expect exit 0
git add src/commands/doctor.ts tests/dispatcher/agent-facts.test.ts
git commit -m "feat(doctor): check (O) — assert the CLI-fact clause against the code

Fails, blocking CI, same as the metrics baseline. Per this project's own P3-12
finding, a gate that never blocks is a gate that is ignored.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `sgc doctor --write-descriptions` — the generator

**Files:**
- Modify: `src/commands/doctor.ts`, `src/sgc.ts` (flag registration)
- Test: `tests/dispatcher/agent-facts.test.ts` (add to)

**Interfaces:**
- Consumes: `deriveCliFact`, `CLI_FACT_MARKER`, `DERIVED_AGENT_IDS`, `AgentMdFile`.
- Produces: `export function rewriteCliFact(text: string, id: string): string` — pure, returns the new file text.

- [ ] **Step 1: Write the failing test**

Add to `tests/dispatcher/agent-facts.test.ts`:

```ts
import { rewriteCliFact } from "../../src/commands/doctor"

describe("--write-descriptions — regenerates the fact, never the capability", () => {
  const CAP = "Performance review of a diff — algorithmic complexity and N+1 patterns."
  const file = (desc: string) =>
    `---\nname: reviewer-performance\ndescription: ${JSON.stringify(desc)}\n---\n\n# Body\n\nUnchanged.\n`

  test("a stale clause is replaced and the capability sentence survives byte-for-byte", () => {
    const out = rewriteCliFact(file(`${CAP} ${CLI_FACT_MARKER} stale junk.`), "reviewer.performance")
    expect(out).toContain(CAP)
    expect(out).toContain(deriveCliFact("reviewer.performance"))
    expect(out).not.toContain("stale junk")
    expect(out).toContain("# Body")      // body untouched
  })

  test("a missing clause is appended after the capability sentence", () => {
    const out = rewriteCliFact(file(CAP), "reviewer.performance")
    expect(out).toContain(`${CAP} ${deriveCliFact("reviewer.performance")}`)
  })

  test("it is idempotent — running it twice changes nothing", () => {
    const once = rewriteCliFact(file(CAP), "reviewer.performance")
    expect(rewriteCliFact(once, "reviewer.performance")).toBe(once)
  })

  test("output round-trips through the drift check", () => {
    const out = rewriteCliFact(file(`${CAP} ${CLI_FACT_MARKER} junk.`), "reviewer.performance")
    expect(cliFactDrift([{ id: "reviewer.performance", file: "x.md", text: out }])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/agent-facts.test.ts`
Expected: FAIL — `rewriteCliFact` is not exported.

- [ ] **Step 3: Implement `rewriteCliFact`**

In `src/commands/doctor.ts`:

```ts
/**
 * Replace everything from CLI_FACT_MARKER to the end of the description with the
 * derived clause, leaving the capability sentence and the body untouched.
 *
 * Rebuilds the frontmatter with js-yaml rather than a regex substitution: a
 * description is a YAML string that may be quoted three different ways, and M4
 * already shipped a regex that captured "" from an unquoted one and then accused
 * it of disclosing nothing.
 */
export function rewriteCliFact(text: string, id: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) throw new Error(`${id}: no frontmatter block`)
  const parsed = yamlLoad(m[1]!) as Record<string, unknown>
  const desc = typeof parsed["description"] === "string" ? (parsed["description"] as string) : ""
  const at = desc.indexOf(CLI_FACT_MARKER)
  const capability = (at < 0 ? desc : desc.slice(0, at)).trimEnd()
  parsed["description"] = `${capability} ${deriveCliFact(id)}`
  const front = yamlDump(parsed, { lineWidth: -1, quotingType: '"', forceQuotes: false })
  return `---\n${front.trimEnd()}\n---\n${text.slice(m[0].length)}`
}
```

`src/commands/doctor.ts:29` already reads `import { load as yamlLoad } from "js-yaml"`. **Extend that line — do not add a second import of the same module:**

```ts
import { load as yamlLoad, dump as yamlDump } from "js-yaml"
```

Note `readFrontmatterDescription` (`doctor.ts:308`) is module-private and NOT exported — `cliFactDrift` and `rewriteCliFact` both live in `doctor.ts`, so they can call it directly. Also note `agentMetadataDrift` lowercases its result (`.toLowerCase()`) because it is keyword-sniffing; **`cliFactDrift` must NOT lowercase** — it compares bytes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/agent-facts.test.ts`
Expected: all pass except `THE REAL 9 FILES are in sync` (Task 8).

- [ ] **Step 5: Wire the flag**

In `src/commands/doctor.ts`, add `writeDescriptions?: boolean` to `DoctorOptions`, and at the top of `runDoctor`, before any check runs:

```ts
  if (opts.writeDescriptions) {
    const written: string[] = []
    for (const f of readAgentMdFiles(root)) {
      if (!DERIVED_AGENT_IDS.includes(f.id)) continue
      const next = rewriteCliFact(f.text, f.id)
      if (next !== f.text) {
        writeFileSync(resolve(root, f.file), next, "utf8")
        written.push(f.id)
      }
    }
    log(written.length > 0
      ? `wrote CLI-fact clause for: ${written.join(", ")}`
      : "all CLI-fact clauses already match the code")
  }
```

In `src/sgc.ts`, find the `doctor` command's option registration and add:

```ts
        "--write-descriptions": {
          type: "boolean",
          description: "Regenerate the derived CLI-fact clause in plugins/sgc/agents/**/*.md",
        },
```

then pass it through: `writeDescriptions: args["--write-descriptions"] === true`.

Confirm the exact option shape by reading the neighbouring flags in `src/sgc.ts` before editing — match the file's existing style rather than this sketch.

- [ ] **Step 6: Commit**

```bash
npm run typecheck   # expect exit 0
git add src/commands/doctor.ts src/sgc.ts tests/dispatcher/agent-facts.test.ts
git commit -m "feat(doctor): --write-descriptions regenerates the derived clause

Mirrors \`sgc metrics --write-baseline\`: doctor fails, you run the generator,
doctor passes. Human owns the capability sentence, machine owns the fact.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: The defect-reproduction suite

**Files:**
- Test: `tests/dispatcher/agent-facts.test.ts` (add to)

This is the spec's headline success criterion: **reproducing any M4/M5 description defect must require editing code, not prose.** Each test below reintroduces one real shipped defect and proves check (O) now catches it.

**Interfaces:** Consumes everything from Tasks 1–6. Produces no new exports.

**RED first, and it is a real RED.** Iron Law #1 binds here like everywhere. These tests
assert that check (O) *catches* things — so the RED is: disable check (O) and watch every
one of them fail. Step 2 does exactly that. A test you never saw fail proves nothing, and
this task's entire purpose is to prove a gate works.

- [ ] **Step 1: Write the tests**

```ts
describe("Task 7 — every M4/M5 defect class now requires editing code to reproduce", () => {
  const withDesc = (id: string, desc: string) => ({
    id, file: "x.md",
    text: `---\nname: x\ndescription: ${JSON.stringify(desc)}\n---\nbody\n`,
  })
  const CAP = "Does the thing."

  test("M4: a term dropped from the advertised list (signature|encrypt|decrypt)", () => {
    const mangled = deriveCliFact("reviewer.security").replace("|signature|encrypt|decrypt", "")
    expect(cliFactDrift([withDesc("reviewer.security", `${CAP} ${mangled}`)])).toHaveLength(1)
  })

  test("M4: an advertised term the matcher cannot match (O(n))", () => {
    // The inverse now: O(n…) can only appear in the clause because it is in
    // PERFORMANCE_TERMS, and Task 2's frozen probes prove the regex matches it.
    const mangled = deriveCliFact("reviewer.performance").replace("|O(n…)", "")
    expect(cliFactDrift([withDesc("reviewer.performance", `${CAP} ${mangled}`)])).toHaveLength(1)
  })

  test("M5: a severity that disagrees with the code", () => {
    const mangled = deriveCliFact("reviewer.migration").replace("high severity", "low severity")
    expect(cliFactDrift([withDesc("reviewer.migration", `${CAP} ${mangled}`)])).toHaveLength(1)
  })

  test("M4: the mechanism mislabelled (tests called a keyword matcher)", () => {
    const mangled = deriveCliFact("reviewer.tests").replace(/a file-path check[^;]*/, "a keyword matcher")
    expect(cliFactDrift([withDesc("reviewer.tests", `${CAP} ${mangled}`)])).toHaveLength(1)
  })

  test("M5 F1/F2: the disclaimer moved to the front", () => {
    const drifts = cliFactDrift([
      withDesc("janitor.archive", `${deriveCliFact("janitor.archive")} ${CAP}`),
    ])
    expect(drifts.join(" ")).toMatch(/capability sentence must come first/)
  })

  test("M5 F3: an invented pointer to a non-LLM surface (the cso redirect)", () => {
    const mangled = `${deriveCliFact("reviewer.security")} For semantic analysis use \`sgc cso\`.`
    expect(cliFactDrift([withDesc("reviewer.security", `${CAP} ${mangled}`)])).toHaveLength(1)
  })

  test("a prompt_path flip must change the clause — the metric cannot be moved by a label", () => {
    // reviewer.security has a prompt_path; reviewer.performance does not. Their
    // clauses must therefore differ in shape, not just in wording.
    expect(deriveCliFact("reviewer.security")).toContain("with an API key it runs")
    expect(deriveCliFact("reviewer.performance")).not.toContain("with an API key it runs")
  })
})
```

- [ ] **Step 2: Prove the RED — disable the gate and watch all 7 fail**

Temporarily neuter `cliFactDrift` in `src/commands/doctor.ts` by making it return early:

```ts
export function cliFactDrift(files: AgentMdFile[]): string[] {
  return []   // TEMPORARY — proving the Task 7 tests are not vacuous
  // …real body…
}
```

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/agent-facts.test.ts -t "Task 7"`
Expected: **6 of the 7 fail.** (The 7th — "a prompt_path flip must change the clause" — tests `deriveCliFact` directly, not the gate, so it stays green. That is correct, not a miss.)

**Then revert the early return** and re-run: PASS, 0 fail.

If a test stays green with the gate disabled, it is vacuous — it is asserting nothing about check (O). Fix it before proceeding.

**The specific vacuity trap in this task:** every `mangled` is built with `.replace()`. If the replace target does not appear in the derived string, `.replace()` silently returns the input unchanged, `mangled === deriveCliFact(id)`, the description is *correct*, and the test passes while proving nothing. Guard each one:

```ts
expect(mangled).not.toBe(deriveCliFact(id))   // the replace actually landed
```

Add that line to every test in this describe block before its `cliFactDrift` assertion.

- [ ] **Step 3: Commit**

```bash
git add tests/dispatcher/agent-facts.test.ts
git commit -m "test(agents): pin that every M4/M5 defect class now needs a code edit

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Regenerate the 9 descriptions

**Files:**
- Modify: all 9 `plugins/sgc/agents/**/*.md` (via the generator, not by hand)

- [ ] **Step 1: Capture the capability sentences BEFORE regenerating**

```bash
cd /mnt/data_ssd/dev/projects/sgc
for f in plugins/sgc/agents/reviewer/{security,tests,performance,maintainability,migration,infra,adversarial,spec}.md plugins/sgc/agents/janitor/archive.md; do
  echo "=== $f"
  sed -n '3p' "$f" | sed 's/Separate fact for sgc CLI users:.*//'
done > /tmp/capability-before.txt
cat /tmp/capability-before.txt
```

- [ ] **Step 2: Run the generator**

Run: `SGC_FORCE_INLINE=1 bun run src/sgc.ts doctor --write-descriptions`
Expected: `wrote CLI-fact clause for: …` listing the ids that changed.

- [ ] **Step 3: Verify NO capability sentence changed**

```bash
for f in plugins/sgc/agents/reviewer/{security,tests,performance,maintainability,migration,infra,adversarial,spec}.md plugins/sgc/agents/janitor/archive.md; do
  echo "=== $f"
  sed -n '3p' "$f" | sed 's/Separate fact for sgc CLI users:.*//'
done > /tmp/capability-after.txt
diff /tmp/capability-before.txt /tmp/capability-after.txt && echo "✓ capability sentences byte-identical"
```

Expected: no diff. **If any capability sentence changed, stop** — `rewriteCliFact` is over-reaching and Task 6 needs fixing, not the file.

- [ ] **Step 4: Read the diff by eye**

Run: `git diff plugins/sgc/agents/`
Read every changed description in full. A generated clause that is accurate but unreadable is still a routing signal — if it reads badly, the template in Task 4 is wrong, not the file.

- [ ] **Step 5: Add the real-9-files pin (moved here from Task 5 — it cannot pass before the generator runs)**

Add to `tests/dispatcher/agent-facts.test.ts`:

```ts
test("THE REAL 9 FILES are in sync with the derivation", () => {
  // The one test that binds the derivation to what actually ships. Every other
  // test in this file works on constructed fixtures; this one reads the repo.
  expect(cliFactDrift(readAgentMdFiles(ROOT))).toEqual([])
})
```

- [ ] **Step 6: doctor and full suite green**

```bash
SGC_FORCE_INLINE=1 bun run src/sgc.ts doctor    # expect 71 OK / 0 warn / 0 fail (70 + check O)
SGC_FORCE_INLINE=1 bun test tests/              # expect 0 fail
npm run typecheck                                # expect exit 0
```

- [ ] **Step 7: Commit**

```bash
git add plugins/sgc/agents/ tests/dispatcher/agent-facts.test.ts
git commit -m "chore(agents): regenerate the 9 CLI-fact clauses from code

Written by \`sgc doctor --write-descriptions\`, not by hand. Capability sentences
verified byte-identical.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Release v1.36.0

**Files:**
- Modify: `CHANGELOG.md`, `package.json`, `package-lock.json` (2 sites), `plugins/sgc/.claude-plugin/plugin.json`, `plugins/sgc/CLAUDE.md` (status header), `plugins/sgc/bin/sgc.mjs` (rebuilt)

**This task needs hard AUTH before it starts (§2 L3 + released artifact).**

- [ ] **Step 1: Pre-flight**

```bash
SGC_FORCE_INLINE=1 bun run src/sgc.ts cso      # expect: pass, no findings
npm audit                                       # expect: 0 vulnerabilities
gh run list --branch main --limit 1             # §7 HARD: must be green before pushing
```

- [ ] **Step 2: Bump the version in lockstep**

`package.json`, `plugins/sgc/.claude-plugin/plugin.json`, `package-lock.json` (**2 sites**), and the `## Implementation Status (v1.35.0 —` header in `plugins/sgc/CLAUDE.md` → `v1.36.0`.

- [ ] **Step 3: CHANGELOG entry**

Top of `CHANGELOG.md`, above the v1.35.0 heading. §2-EXT requires the migration note first. The descriptions' wording changes, so state what a reader of the old strings should expect:

```markdown
## v1.36.0 — <date> — the drifting half of a description is now derived

### MIGRATION

Agent description text changed for all 9 reviewer/janitor agents. The capability
sentence is unchanged; the `Separate fact for sgc CLI users:` clause is now generated
from code and may be worded differently from v1.35.0. No behaviour change: no matcher,
trigger, severity or prompt_path moved (pinned by frozen-equivalence probes).

If you edit an agent description, write only the capability sentence. Running
`sgc doctor` will tell you if the fact clause is stale, and
`sgc doctor --write-descriptions` regenerates it.

### Why

8 of the 9 defects the M4+M5 reviews found lived in that clause; 0 lived in the
capability sentence. …
```

- [ ] **Step 4: Rebuild the bundle with the CI-pinned bun**

`src/` changed, so `plugins/sgc/bin/sgc.mjs` must be rebuilt — **with bun 1.3.5, not the local 1.3.11.** bun's output is not byte-stable across versions; a 1.3.11 bundle passes `doctor` locally (it rebuilds with the same bun) and fails CI's parity gate (which rebuilds with 1.3.5).

```bash
mkdir -p /tmp/bun135 && cd /tmp/bun135
curl -fsSL -o bun.zip "https://github.com/oven-sh/bun/releases/download/bun-v1.3.5/bun-linux-x64.zip"
unzip -oq bun.zip && ./bun-linux-x64/bun --version    # expect 1.3.5
cd /mnt/data_ssd/dev/projects/sgc
PATH="/tmp/bun135/bun-linux-x64:$PATH" npm run build:cli
git ls-files --stage plugins/sgc/bin/sgc.mjs | awk '{print $1}'   # expect 100755
```

- [ ] **Step 5: Commit, tag, push**

```bash
git add -A && git status --short    # review before committing
git commit -m "chore(release): v1.36.0 — derive the CLI-fact half of agent descriptions

Bundle rebuilt with bun 1.3.5 (the CI-pinned version).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin main
git tag v1.36.0 && git push origin v1.36.0
```

- [ ] **Step 6: Verify CI, then canary the published artifact**

```bash
gh run list --limit 2      # both workflows must be green before trusting the release
cd /tmp && rm -rf canary && mkdir canary && cd canary
npm i -q @sdsrs/sgc@1.36.0
./node_modules/.bin/sgc --version    # expect 1.36.0
```

- [ ] **Step 7: Dispose of sandbox artifacts (§8.V4)**

```bash
rm -rf /tmp/bun135
rm -rf /tmp/canary
rm -f /tmp/capability-before.txt /tmp/capability-after.txt
```

Use literal paths — `rm -rf "$VAR"` on an unvalidated variable is blocked by the repo's safety hook, correctly.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `agent-facts.ts` / `deriveCliFact` | 4 |
| 4 clause shapes (incl. maintainability's two-slot template) | 4 |
| Terms as `{display, re, wordBounded}` + `buildPattern` | 1, 2 |
| Trigger built from the same list | 2 |
| doctor check (O), fail severity | 5 |
| Capability sentence must lead | 5 (`at === 0`), 7 |
| `--write-descriptions` | 6 |
| M5 reachability test survives | 2 (Step 4, explicit) |
| Defect-reproduction criterion | 7 |
| Scope = 9 files, others untouched | 4 (`DERIVED_AGENT_IDS`), 5 (skip), 7 |
| No `sgc review` behaviour change | 2 (frozen probes), 3 (frozen probes) |
| v1.36.0 non-patch + migration note | 9 |
| bun 1.3.5 bundle | 9 Step 4 |

No gaps.

**Placeholder scan:** none — every code step carries the code.

**Type consistency:** `Term` (Task 1) is consumed unchanged by Tasks 2, 3, 4. `SpecialistDef.terms` (Task 2) is read by `agent-facts.ts` via the exported `SECURITY|MIGRATION|PERFORMANCE|INFRA` — Task 2 Step 3 exports them (they were module-private through v1.35.0). `cliFactDrift` and `rewriteCliFact` both live in `doctor.ts` and are imported by the Task 5/6/7 tests from `../../src/commands/doctor`. `AgentMdFile` is `{id, file, text}` — the test helpers construct that shape.

**One risk the implementer must not paper over:** Task 2's frozen-equivalence test is the only thing standing between this refactor and a silent change to what `sgc review` flags. If a probe disagrees, the term list is wrong — do not edit the frozen regex to match the new build.
