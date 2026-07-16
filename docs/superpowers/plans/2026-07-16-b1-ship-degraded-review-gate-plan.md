# B1 implementation plan — ship blocks degraded L2+ review

> Plan for spec `docs/superpowers/specs/2026-07-16-b1-ship-degraded-review-gate-design.md`.
> **L3 sign-off: recorded 2026-07-16 (user "执行" after design approval + spec review request).**
> TDD, one RED→GREEN task per step; full suite + doctor green before done.

## Degraded-detection rule (precise)

A code review is **LLM-backed** iff `engine !== undefined && engine !== "inline"`.
The gate is **degraded** iff NO code review is LLM-backed (every one is heuristic
`inline` OR a pre-A3 report with no `engine`). This is stricter than A3's advisory
notice (which counts only proven `inline`): a gate errs toward blocking, an advisory
toward not-warning.

## Steps

1. **RED** `tests/dispatcher/ship-degraded-review.test.ts` — the spec's cases:
   heuristic-only L2 → throws; + valid acceptance → ships + `ship.md` records it +
   log names signer; malformed acceptance (empty by / reason<40) → throws;
   ≥1 LLM-backed review (engine stamped) → ships without acceptance; L1 heuristic →
   unaffected; pre-A3 (engine absent) → blocked without acceptance.
2. **Types** — `ShipOptions += acceptDegradedReview?, acceptedBy?`;
   `ShipDoc += degraded_review_acceptance?: {by, at, reason}`.
3. **ship.ts gate** — replace the A3 notice block with: compute degraded; if degraded
   and no valid acceptance → throw the actionable message; if degraded and valid
   acceptance → set the ShipDoc field + log; if not degraded → proceed silently.
   Validate a supplied acceptance (by non-empty AND reason≥40) → throw on malformed.
4. **state.ts** — `writeShip`/`validateShip` carry `degraded_review_acceptance`
   through (generic frontmatter round-trip; validate shape only when present).
5. **sgc.ts** — wire `--accept-degraded-review <reason>` + `--accepted-by <name>`
   CLI flags into `ShipOptions` on the `ship` command.
6. **Blast radius** — update `l2Ready`/`l3Ready` (sgc-ship) + the L2/L3 flows in
   gh-runner / janitor-compound / review-* / eval L2-*/L3-* to pass the signed
   acceptance (option a — exercises the real escape hatch). Where the acceptance
   obscures a test's assertion, stamp a non-inline engine instead (option b).
7. **Docs** — CHANGELOG MIGRATION section + README review-gate line; roadmap B1 → ✅.
8. **GREEN gate** — `tsc --noEmit`, `sgc doctor`, full `bun test tests/` all green.

## Non-goals (from spec)

QA gating; changing reviewer agents or `resolveMode`; schema migration.
