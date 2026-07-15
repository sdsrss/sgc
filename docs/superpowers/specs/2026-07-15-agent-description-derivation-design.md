# Agent Description Derivation — Design Spec

**Date:** 2026-07-15
**Status:** approved (brainstorming); pending implementation plan
**Provoked by:** M3 (v1.33.0) → M4 (v1.34.0) → M5 (v1.35.0) — three consecutive
batches, each of which shipped agent metadata that a later review overturned.

## Goal

Stop `plugins/sgc/agents/**/*.md` descriptions from drifting, by deriving the part
that keeps drifting from code instead of hand-writing it.

## The problem, stated precisely

Every reviewer capability currently has **2–3 hand-maintained representations**:

| representation | consumer |
|---|---|
| `plugins/sgc/agents/reviewer/<x>.md` body (86–102 lines) | Claude Code dispatch — runs it as the subagent's system prompt |
| `prompts/reviewer-<x>.md` | `sgc review` LLM path (when `prompt_path` is set + an API key exists) |
| the matcher in `src/dispatcher/agents/reviewer-*.ts` | `sgc review` fallback (no key) |

…plus **one `description:` string that must be true of all of them simultaneously**.

The `doctor` gate on that string (`agentMetadataDrift`, `src/commands/doctor.ts`)
checks only that the description *contains* a disclosure keyword
(`/heuristic|keyword match|deterministic|not llm-backed|rule-based|not implemented/`).
It never checks that any of it is accurate. Two consequences, both observed:

- **False specifics pass.** M4 shipped a term list missing three terms the regex
  actually matches, and advertised an `O(n)` term the regex could not match in any
  natural context. Both satisfied the gate.
- **The gate rewards the wrong word.** M4's `tests.md` called a file-path check a
  "keyword matcher" — inaccurate, and *that inaccurate phrase* is exactly what
  satisfied the gate's regex. In M5, correcting the wording made `janitor.archive`
  **fail** the gate, because the more accurate sentence contained none of the magic
  words.

### The statistic that shapes this design

Every one of the 9 descriptions has the same two-part structure:

1. **Capability sentence** — hand-written, judgement, the valuable half.
2. **`Separate fact for sgc CLI users: …`** — formulaic, and 100% derivable from
   code (`prompt_path`, `status`, the matcher's term list, `severity`).

**8 of the 9 defects the M4/M5 reviews found lived in part 2.** The cso redirect,
the missing terms, the mechanism mislabel, the unmatched `O(n)`, severity disclosed
in 1 of 4, and `NOT IMPLEMENTED` leading — all of it. The only defect in part 1 was
`spec.md`'s undisclosed `intent.md` dependency.

**Hand-writing part 1 has never caused a defect. Hand-writing part 2 has caused
eight, across three releases.** So stop hand-writing part 2.

## Why this specific shape (the proven counter-pattern)

This repo already contains the answer, and it is load-bearing rather than
theoretical:

- `doctor` check **M** asserts the README four-化 scorecard matches live
  `sgc metrics` output.
- `doctor` checks **J/K** assert `metrics/metrics-baseline.yaml` matches live output;
  `sgc metrics --write-baseline` regenerates it.
- `bundleParityCheck` asserts the committed bundle matches a source rebuild.

**Every claim in this repo that is machine-reconciled has never drifted. The claims
that drift are exactly the ones nobody reconciles.** Observed again during M5: the
moment `prompt_path` changed, check M and check J/K went red unprompted
(`✗ metrics drift — intelligence.llm_invokable: live=13 baseline=11`), and
`--write-baseline` closed it. Nobody had to notice.

This design copies that generator + gate pair verbatim onto descriptions.

## Design

### 1. `src/dispatcher/agent-facts.ts` (new) — the single source

Exports `deriveCliFact(agentId: string): string` returning the canonical
`Separate fact for sgc CLI users: …` clause. It derives from:

- the manifest — `prompt_path` (LLM path or not, and which prompt), `status`
  (`slot-only` / `manual-only` → the CLI never runs it at all);
- a matcher-facts registry — `terms`, `severity`, `mechanism`.

Four clause shapes, matching the four real situations:

| shape | agents | derived from |
|---|---|---|
| term-list matcher | `performance`, `migration`, `infra` | `terms`, `severity` |
| LLM-backed, matcher fallback | `security`, `tests` | `prompt_path` + the fallback's own facts |
| threshold + marker-list matcher | `maintainability` | `MAX_LINE` (120), marker `terms`, `severity` |
| CLI never runs it | `adversarial`, `spec`, `archive` | `status` |

`maintainability` is called out separately because it is the one agent whose mechanism
is **two** facts, not one: a numeric threshold *and* a marker list. Both are derivable
(`MAX_LINE` is already a constant; the markers are a term list in the same shape as the
others), so it needs a two-slot template rather than a new hand-written escape. `tests`
is the mirror case — its fallback mechanism is a file-path regex over `+++ b/<path>`
headers with no term list at all, which is exactly the fact M4 got wrong by calling it
a "keyword matcher".

### 2. Matcher facts become data, and the regex is built from them

The M5 defect "the description's term list omits `signature|encrypt|decrypt`" exists
because the list lives in a `.md` and the regex lives three files away. Inverting the
dependency makes the defect unrepresentable:

A term is a triple: what it is **called**, what it **matches**, and whether it is
word-bounded. Only `security` is a plain literal alternation today — `migration` has
`ALTER\s+TABLE`, `infra` has `FROM\s+\w` and `k8s\b`, and `performance` keeps
`O\(n\^?\d*\)` outside its `\b(…)\b` group precisely because a trailing `\b` after a
literal `)` is what broke big-O detection in the first place. So a bare string list
would fit one of four. The triple fits all four:

```ts
type Term = { display: string; re: string; wordBounded: boolean }

const PERFORMANCE_TERMS: readonly Term[] = [
  { display: "cache",  re: "cache",                    wordBounded: true },
  { display: "O(n…)",  re: String.raw`O\(n\^?\d*\)`,   wordBounded: false },  // \b after `)` never matches
  // …
]
const PERFORMANCE: SpecialistDef = {
  name: "reviewer.performance",
  terms: PERFORMANCE_TERMS,
  pattern: buildPattern(PERFORMANCE_TERMS),   // \b(w1|w2)\b|u1|u2
  severity: "medium",
}
```

`buildPattern` groups the word-bounded terms inside `\b(…)\b` and alternates the rest
outside it — which is exactly the shape M5 arrived at by hand for `performance`, now
expressed once instead of per-matcher.

The description's advertised list is then `terms.map(t => t.display).join("|")`. **No
regex parser is required, and the regex cannot disagree with the advertised terms** —
the M5 defect "the description omits `signature|encrypt|decrypt`" becomes
unrepresentable rather than merely tested-for.

Trigger regexes are built from the same list, which subsumes M5's reachability
invariant (`debounce`, `throttle`, `argo` were matcher-only, so no trigger could spawn
them) into construction. **Keep M5's reachability test anyway** — it is what found
`argo` after two independent reviewers missed it, and a test that pins an invariant the
code now establishes by construction is exactly the test that catches the refactor
which quietly stops establishing it.

### 3. `doctor` check (O) — assert, and fail

For each of the 9 files:

- the description MUST end with exactly `deriveCliFact(id)` → else **fail**, printing
  the exact expected string (the failure message is the fix);
- the description MUST NOT *lead* with the CLI fact — the capability sentence comes
  first. This makes M5's F1/F2 (a routing field opening with a phrase engineered to
  prevent routing) structurally impossible rather than a matter of review taste.

**Severity: fail, blocking CI** — same as J/K. Per this project's own P3-12 finding, a
gate that never blocks is a gate that gets ignored.

### 4. `sgc doctor --write-descriptions` — the generator

Rewrites the clause in place: everything from `Separate fact for sgc CLI users:` to
the end of the description. The capability sentence is never touched.

Mirrors `sgc metrics --write-baseline`: doctor fails → run the generator → doctor
passes. **The human owns the capability sentence; the machine owns the fact
sentence; both live in the same file**, so no new split is introduced. (A split
between "where a human reads the agent" and "where a human writes its capability"
is precisely the disease this batch is treating.)

### Byproduct

M5's sharpest defect — `security.md` closing by redirecting readers to `sgc cso` for
"semantic analysis" that cso (three regex/shell heuristics, no LLM, no manifest
entry) definitionally cannot perform — becomes unrepresentable. A machine composing
the fact clause from `prompt_path` does not invent a pointer to a surface that has none.

## Scope

**In:** the 9 files M4/M5 damaged — `plugins/sgc/agents/reviewer/{security,tests,
performance,maintainability,migration,infra,adversarial,spec}.md` and
`plugins/sgc/agents/janitor/archive.md`.

**Out (for now):** the other 10 agents (`planner.*`, `compound.*`, `clarifier.*`,
`classifier.*`, `qa.*`, `researcher.*`). Their CLI-fact shape is **unverified** — they
are dispatched by different commands and may need 3–4 templates rather than 2. Same
drift risk applies; it simply has not been measured there yet. Recorded as debt, not
declared absent.

## Non-goals

- **Not collapsing the representations.** Generating `prompts/reviewer-<x>.md` from
  the agent body (2 → 1) is a real option and a separate design: the formats genuinely
  differ (a Claude Code system prompt vs a `<input_yaml/>` + reply-format template),
  and the no-key matcher persists regardless. Bundling it here would repeat M4's own
  mistake of doing one more thing than the batch was scoped for.
- **Not semantic checking of the capability sentence.** Nothing here judges whether
  "traces injection paths" is a fair summary of a 96-line prompt. That ceiling stays,
  and it is now the *only* remaining hand-written surface rather than one of two.
- **Not touching `correctness.md`.** It is the baseline form (234 chars, capability
  first) and carries a known, recorded instance of the same dual-executor gap; changing
  it means redefining the reference shape.

## Success criteria

- All 9 descriptions' CLI clause is byte-identical to `deriveCliFact(id)`, asserted by
  doctor at **fail** severity.
- Reproducing any M4/M5 description defect requires editing code, not prose — verified
  by RED tests that reintroduce each defect class and watch check (O) catch it:
  a term removed from the advertised list; a severity changed; a `prompt_path`
  flipped; a disclaimer moved to the front.
- `sgc doctor --write-descriptions` makes a failing check (O) pass, with no change to
  any capability sentence (asserted).
- Full suite 0 fail (baseline **1499 pass / 38 skip**, measured at `95d0421`) ·
  `tsc --noEmit` exit 0 · `npm audit` 0.
- No behaviour change to `sgc review` — this batch moves prose and pins facts.

## Level and release

**§2 L3** — `plugins/sgc/agents/**/*.md` is LLM-visible metadata (L3 regardless of
LOC), and the descriptions steer Claude Code routing. Requires hard AUTH before
implementation. Ships as **v1.36.0** (non-patch, per §2-EXT released-artifact rules);
the description text changes, so the migration note must state what a reader of the
old strings should expect.

## Decisions

- **D1 (user):** scope = the 9 reviewer + janitor files. Smallest set that proves the
  mechanism, and the set with observed defects.
- **D2 (user):** gate severity = **fail**, blocking CI — same as the metrics baseline.
  Rejected `warn` explicitly: this project has already established (P3-12) that a gate
  which never blocks is a gate that is ignored.
- **D3 (lead):** generator + gate, not pure codegen. Pure codegen needs a home for the
  capability sentence, which would move it out of the `.md` — a new split, when splits
  are the disease. Rejected also because a generated-region marker inside a YAML
  frontmatter *string* renders as literal text to the very reader (Claude Code) the
  field exists for.
- **D4 (lead):** terms-as-data via a `{display, re, wordBounded}` triple, uniform
  across all four matchers. Rev 1 of this spec said "the three literal-alternation
  matchers" and left two on hand-written lists — **that was wrong on the facts**: only
  `security` is a plain literal alternation, so the rule as written would have fitted
  one of four and shipped an asymmetry justified by a miscount. Caught on spec
  self-review by checking the patterns instead of trusting the sentence. The triple
  costs a little verbosity and removes the asymmetry entirely.
- **D5 (lead):** M5's reachability test survives even though construction now
  guarantees what it asserts. It is the test that found `argo` after two reviewers
  missed it, and its job in this design is to fail on the future refactor that stops
  building triggers from the same list.

# Change log

- rev 1 — 2026-07-15 — created from brainstorming; D1/D2 decided by user, D3/D4 by lead.
