# Changelog

## v1.2.0 — 2026-04-21 — Audit remediation

### Strategy
- **Positioning**: sgc declared as "规范层 + 知识引擎" alongside sp/gs. See `docs/POSITIONING.md`.

### Features
- `classifier.level`: real-LLM dispatch path via `prompts/classifier-level.md` (heuristic fallback retained)
- `reviewer.correctness`: real-LLM dispatch path via `prompts/reviewer-correctness.md` (heuristic fallback retained)
- Plugin skills (`plugins/sgc/skills/*/SKILL.md`) now dispatch to the CLI via `bun src/sgc.ts <cmd>`
- `sgc plan` / `sgc ship` auto-write `handoff.md` for session resume
- New `--force-new-task` flag for `sgc plan` when conflicting handoff exists
- Manifest field `prompt_path` for agent-to-prompt template mapping
- Manifest field `status` + `roadmap` for slot-vs-implemented agent visibility

### Performance
- Anthropic SDK: system block now cached with `cache_control: ephemeral`. System prefix is manifest-derived (byte-stable across calls); per-call data (spawn_id, scope tokens, input) moved to user block.

### Tests (357 → 445, +88)
- Eval: `classifier-llm` — heuristic limits + LLM routing readiness
- Eval: `reviewer-correctness-llm` — heuristic blind spots + LLM routing readiness
- Eval: `L3-auto-refused` — Invariant §4
- Eval: `override-reason-short` — Invariant §5
- Eval: `compound-rollback` — Invariant §10
- Eval: `reviewer-conflict` — worst-of verdict aggregation
- Eval: `resume-guard` — session handoff
- Unit: `splitPrompt`, cache-stability integration, prompt-path routing

### Docs
- New: `docs/POSITIONING.md`
- Updated: `plugins/sgc/CLAUDE.md`, `README.md`, all 8 `SKILL.md` files
- Annotated: 5 unimplemented reviewer slots + janitor.archive in capabilities.yaml

## v1.1.0 — 2026-04-16 — D-phase + E-phase

Initial release with full L0-L3 pipeline, 12 invariants, 357 tests.
See `docs/e-phase-demo.md` for details.
