# B1 — `sgc ship` blocks a degraded (heuristic-only) L2+ review

> Design spec · 2026-07-16 · roadmap item B1 (audit v1.37.0 finding F1)
> Classification: **L3** — released-artifact user-visible default-behavior change.
> Prereqs shipped this session: A3 (report `engine` stamp + non-blocking ship notice), B3 (`by`+reason≥40 override validation).

## Problem (F1)

`sgc ship`'s L2+ review gate blocks only on `verdict === "fail"`. Every heuristic
reviewer structurally caps at `pass`/`concern` (`reviewer-correctness.ts:48`,
`reviewer-specialists.ts:59`, `reviewer-quality.ts:78,120`); `resolveMode` picks
the inline heuristic whenever no LLM is configured (`spawn.ts:459-460`). So in the
default no-LLM path the gate can never see a `fail` — it verifies only that *a
report exists*, not that *the code was reviewed*. An L2 change with a real
null-deref, reviewed with no API key, ships. The tool advertises "independent
correctness review"; degraded, the gate is ceremony.

A3 made the degradation **visible** (each `ReviewReport` carries `engine`; ship
prints a non-blocking notice). B1 makes it **enforced**.

## Decisions (brainstorm, 2026-07-16)

1. **Block mechanism — the gate reads the engine stamp.** Heuristic reviewers keep
   honest `pass`/`concern` semantics; the *gate* adjudicates. `sgc ship` refuses to
   satisfy the L2+ review gate when the code-review coverage is heuristic-only.
   Rejected: making heuristic reviewers emit `fail` (a marker-regex hit is not a
   correctness failure — overstates what the heuristic found) and concern-count
   thresholds (arbitrary; muddies `concern`'s deliberately non-blocking meaning).
2. **Escape hatch — a §5-style signed acceptance.** The block lifts when a human
   records a named acceptance with reason ≥40 chars — the exact shape B3 hardened
   for fail-overrides. Attributable and conscious; not a silent env-var/CI bypass.

## Behaviour

At `level === "L2" || level === "L3"`, after the existing review-existence and
fail-override gates pass:

- Let `codeReviews = listReviewsForStage(taskId, "code")`.
- **LLM-backed if** at least one code review has `engine !== "inline"` (a real
  correctness review happened) → gate satisfied, no change.
- **Degraded if** every code review is heuristic (`isHeuristicMode(r.engine)` true
  for all — including the back-compat `engine === undefined`, treated as
  possibly-heuristic and therefore degraded, so a pre-A3 report cannot slip
  through). Then:
  - If a signed acceptance is present (`opts.acceptDegradedReview` with reason ≥40
    chars **and** `opts.acceptedBy` non-empty) → record it, proceed.
  - Else → **throw** with an actionable message naming both ways forward.

L0/L1 are unaffected (no L2+ review cluster gate). The QA path is unchanged — see
Scope boundary.

### Error message (the whole contract a blocked user sees)

```
L2 ship blocked: every code review is heuristic (no LLM was configured), so the
correctness gate verified only that a report exists — not that the code was
reviewed (audit F1). Either:
  • configure an LLM (OPENROUTER_API_KEY, or the claude CLI) and re-run `sgc review`, or
  • accept the degraded review explicitly:
    sgc ship --accepted-by "<name>" --accept-degraded-review "<why, ≥40 chars>"
```

### The acceptance record

`--accept-degraded-review "<reason>"` + `--accepted-by "<name>"`:
- Validated exactly like a §5 override: `acceptedBy.trim()` non-empty AND
  `acceptDegradedReview.trim().length >= 40`; a malformed pair is itself a throw
  (do not silently ignore a half-supplied acceptance).
- Recorded into `ship.md` as a structured field
  `degraded_review_acceptance: { by, at, reason }`, so the attribution is
  immutable (§6) and auditable after the fact. (ShipDoc gains this optional field.)
- Logged: `⚠ shipped on a heuristic-only review, accepted by <name>: <reason>`.

## Scope boundary (conscious)

B1 gates the **code-review cluster only** — that is the F1 correctness hole. It does
**not** gate QA. `sgc qa` is stub-by-default and honestly returns `concern` (never
rubber-stamps, `qa-browser.ts:55`); requiring real-browser QA on every L2+ ship is a
much larger default-behaviour change and is out of scope. The QA existence + not-fail
gate is unchanged. This boundary is stated so it is a decision, not an omission.

## Surface changes

- `src/commands/ship.ts`
  - `ShipOptions` gains `acceptDegradedReview?: string`, `acceptedBy?: string`.
  - The A3 non-blocking notice block becomes the gate above. The notice text is
    subsumed by the throw/acceptance-log.
  - Reuses `isHeuristicMode` (types.ts, A3) and the by/reason≥40 validation shape (B3).
- `src/dispatcher/types.ts` — `ShipDoc` gains optional
  `degraded_review_acceptance?: { by: string; at: string; reason: string }`.
- `src/dispatcher/state.ts` — `writeShip`/`validateShip` carry the new optional
  field through (round-trips via generic frontmatter; validate only when present).
- `src/sgc.ts` — wire `--accept-degraded-review` + `--accepted-by` CLI flags to
  `ShipOptions` on the `ship` command.
- Docs — README + CHANGELOG MIGRATION section (released default-behaviour change);
  POSITIONING "Optional interop" if it references the review gate.

No change to reviewer agents, `resolveMode`, or the QA path.

## Testing

New negative/positive cases in `tests/dispatcher/sgc-ship.test.ts` (and a focused
`ship-degraded-review.test.ts`):
- L2, heuristic-only code reviews, no acceptance → throws `/degraded|heuristic/`.
- L2, heuristic-only + valid `--accepted-by` + reason≥40 → ships; `ship.md` carries
  `degraded_review_acceptance`; log names the signer.
- L2, heuristic-only + acceptance with empty `by` OR reason<40 → throws (malformed
  acceptance, not a silent bypass).
- L2 with at least one LLM-backed code review (engine stamped non-inline) → ships
  with no acceptance needed.
- L1 with heuristic review → unaffected (ships, no gate).
- Pre-A3 report (`engine` absent) treated as degraded → blocked without acceptance.

**Blast radius (must be resolved in the plan).** The `l2Ready`/`l3Ready` helpers in
`sgc-ship.test.ts`, plus L2/L3 flows in `gh-runner.test.ts`, `janitor-compound.test.ts`,
`review-engine-provenance.test.ts`, `review-override-signer.test.ts`, and the
`tests/eval/L2-*/L3-*` suites, all ship on inline reviews and will newly throw.
Resolution options (plan decides, one consistently): (a) the shared helpers pass the
signed acceptance; or (b) a test seam stamps a non-inline engine on the seeded review.
Prefer (a) — it exercises the real escape hatch and keeps the seeded reviews honest —
unless it obscures what a given test asserts, in which case (b) for that test. Whichever
is chosen, `sgc doctor` and the full suite must return to green.

## Migration / compatibility

- Released-artifact default-behaviour change → **L3**, MIGRATION section in the
  CHANGELOG: what changed, who is affected (L2+ ship with no LLM), the two ways
  forward, and the revert pin (`npm i @sdsrs/sgc@<prev>`).
- On-disk compat: `degraded_review_acceptance` and `engine` are optional-additive;
  older `ship.md`/review files read back with the field absent. A pre-A3 review
  (no `engine`) is treated as degraded — conservative, never a silent pass.
- No schema migration, no data rewrite.

## Acceptance criteria

- Default no-LLM L2+ ship is blocked with the actionable message; a signed
  acceptance (by + reason≥40) is the only bypass and is recorded immutably in
  `ship.md`.
- An LLM-backed review satisfies the gate with no acceptance.
- L0/L1 and the QA gate are behaviourally unchanged.
- `tsc --noEmit` clean; `sgc doctor` green; full suite green (blast radius resolved).
- CHANGELOG MIGRATION + README updated; no capability advertised beyond what ships.
```
