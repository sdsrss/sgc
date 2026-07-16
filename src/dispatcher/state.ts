// State layer I/O for `.sgc/{decisions,progress,solutions,reviews}/`.
//
// Each state file is markdown with YAML frontmatter:
//
//     ---
//     task_id: 01HXXX...
//     level: L1
//     ---
//
//     # Markdown body...
//
// Mutability rules (per contracts/sgc-state.schema.yaml + sgc-invariants.md):
//
//   decisions/{id}/intent.md   immutable after creation (Invariant §2)
//   decisions/{id}/ship.md     immutable after creation
//   progress/*.md              read-write, overwritten per task
//   solutions/{cat}/{slug}.md  append-or-update-existing (dedup-enforced
//                              elsewhere — this layer doesn't check)
//   reviews/{id}/{stage}/{r}   append-only per (task, stage, reviewer)
//
// Schema validation is field-presence only for MVP. Full typebox decoding
// is a D-phase concern.
//
// ── Module layout (ARCH-3, audit v1.37.0 C10) ────────────────────────────────
// The former 1065-line monolith was split by state layer into ./state/*. This
// file is now a re-export barrel: the historical import surface (`from
// "…/dispatcher/state"`) is preserved verbatim, so the 72 existing consumers
// keep their named imports unchanged. Edit a layer under ./state/; add new
// exports to the relevant layer file — this barrel needs no per-symbol edits.
//
//   ./state/atomic      shared: root resolution, frontmatter, writeAtomic, wordCount
//   ./state/decisions   intent.md + ship.md (immutable)
//   ./state/progress    current-task / feature-list / handoff + plan-doc writer
//   ./state/solutions   solutions corpus (dedup-gated, delete-forbidden, locked)
//   ./state/reviews     review reports + janitor decisions + red-green captures

export * from "./state/atomic"
export * from "./state/decisions"
export * from "./state/progress"
export * from "./state/reviews"
export * from "./state/solutions"
