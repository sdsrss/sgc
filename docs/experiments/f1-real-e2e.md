# F-1: Real E2E Experiment Log

**Date**: 2026-04-21
**LLM mode**: openrouter (OPENROUTER_API_KEY → anthropic/claude-sonnet-4 via chat/completions)
**Task**: "add --verbose flag to sgc status that shows solutions/ entry count and last compound timestamp"
**Level classified**: L1

## Timeline

- **plan**: ~3s | classifier returned L1 via **real LLM** (not heuristic). Rationale was semantic: "modifying CLI argument parsing and output logic within the sgc status command — single-file change without breaking existing behavior or changing contracts." planner.eng approved (still heuristic stub).
- **work**: feature list created. Marked done manually (no actual code — testing pipeline, not feature).
- **review**: ~5s | reviewer.correctness via **real LLM** returned `fail, critical: "Empty diff provided but intent describes implementing a --verbose flag, indicating missing implementation."` Correct behavior — caught the empty diff.
- **ship**: correctly refused. "1 review(s) with verdict=fail need an override with reason ≥40 chars (Invariant §5)". Immutability + gate chain intact.

## What Worked Well

1. **Classifier LLM path activates correctly** — resolveMode detects OPENROUTER_API_KEY + prompt_path → "openrouter" mode. Semantic rationale ("modifying CLI argument parsing") is vastly better than the keyword heuristic ("default classification").
2. **Reviewer LLM catches real issues** — "empty diff with code intent" is exactly the kind of semantic bug the heuristic (TODO/FIXME scanner) would miss. Verdict=fail is correct.
3. **Invariant chain holds end-to-end** — §5 (override reason ≥40 chars) blocks ship after reviewer fail. No bypass possible without explicit human override.
4. **OpenRouter integration works** — chat/completions format, YAML extraction from LLM output, no SDK dependency. ~3-5s per agent call.

## Friction Points (ranked by severity)

1. **[FIXED] resolveMode priority bug** — inlineStub was winning over API keys, preventing LLM paths from ever activating. Fixed by checking manifest.prompt_path: only agents with templates route to LLM. Added SGC_FORCE_INLINE=1 for test isolation.
2. **[FIXED] OpenRouter 404** — initial implementation used Anthropic SDK with baseURL override, but OpenRouter uses OpenAI chat/completions format. Fixed with dedicated openrouter-agent.ts using fetch.
3. **planner.eng is still a stub** — returns "approve" always. No real planning value. Next priority for LLM swap (Phase G).
4. **compound cluster all stubs** — solutions/ will never accumulate real knowledge until compound agents get LLM paths.
5. **No `--verbose` on status** — the actual feature was never implemented (only pipeline testing). Not a friction point per se, but status lacks observability.

## Recommended Fixes for F-2

1. ~~resolveMode priority~~ — FIXED in this session
2. ~~OpenRouter format~~ — FIXED in this session
3. planner.eng LLM swap → Phase G (next session)
4. compound.context LLM swap → Phase G

## Conclusion

**The sgc pipeline works end-to-end with real LLM.** Classification is semantic, review catches real issues, invariant gates block correctly. The main gap is in the "middle layer" — planning and compounding are still stub-quality. Phase G should focus on these.
