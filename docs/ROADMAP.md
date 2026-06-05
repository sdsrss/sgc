# sgc Roadmap — toward the all-in-one self-contained super-plugin

## North star (vision)

**sgc is a full-replacement engineering super-plugin: all-in-one, runs standalone, no need to install `superpowers` (sp), `gstack` (gs), or any separate Compound-Engineering tooling.** It absorbs the best of all three — fused (融汇贯通), not juxtaposed — through the 13 invariants + the unified write-gate + the CE capture→promote→reuse loop, and installs in one command (`/plugin install sgc`). The product is measured against four 化: **规范化 / 智能化 / 自动化 / 高效化** — raising the efficiency and quality of AI-assisted engineering.

Guiding constraints (carry into every phase):
- **融汇贯通, not juxtaposition** — every absorbed capability must close through the CE loop + be gated by the invariants, or it's just bundled commands.
- **Honest claims** — no capability is advertised beyond what ships (E-E-A-T / §10 Specificity). Where native depth is thin, say so.
- **Absorb patterns, not implementations** — re-author concepts natively (avoid the upstream-staleness treadmill); never vendor sp/gs source (the lone exception is the `browse` binary).
- **Run each phase as its own cycle**: `sp:brainstorming` → `writing-plans` → `subagent-driven-development` (TDD, 2-stage review per task) → `finishing-a-development-branch` → release.

## Status

- ✅ **Phase 0 — install / distribution** (SHIPPED v1.24.0): self-contained Node bundle (`plugins/sgc/bin/sgc.mjs`, contracts+prompts inlined), dual-channel (plugin payload + npm), no bun runtime, 4-tier resolver, doctor bundle-parity + CI staleness gate, two e2e acceptance scripts.
- ✅ **Phase 1 (doc part)** (SHIPPED v1.24.1): README + GitHub About + `docs/POSITIONING.md` + `plugins/sgc/CLAUDE.md` + npm/plugin descriptions reframed from "coexist, NOT a replacement" → self-contained super-plugin (delegate table → *optional interop*).
- ✅ **Phase 1 (runtime part)** (SHIPPED, framing-only commit `82558e0`): `delegation.ts` hint reasons + `sgc.ts` header/`--help` + `marketplace.json` reframed to "sgc-native default, sp/gs optional richer path".
- ✅ **Phase 2a — TDD-ledger** (SHIPPED v1.25.0): `sgc work --done` close-gate anchors to a recorded prior-RED pair XOR `--waive-red` (level-agnostic, grandfather already-done); prior-RED done writes a `red-green/<slug>.md` capture (mirrors ship-failures); `sgc compound --from-red-green` promotes it into `solutions/` through the deterministic Invariant §3 dedup pipeline. Capture auto, promote deliberate (no done-time auto-write). Spec/plan under `docs/superpowers/`.
- ✅ **Phase 2b — native deep planning** (SHIPPED v1.26.0): native deep-plan-authoring path (file-level task decomposition + bite-sized TDD steps, CE reuse-in) — no longer light vs `sp:writing-plans`. Spec/plan under `docs/superpowers/`.
- ✅ **Phase 2c — L2 reviewer cluster wired** (landed in code: commit `62755e9` + CHANGELOG v1.27.0; shipped to npm within the **v1.28.0** release line — there is no standalone v1.27.0 tag/publish): the L2 review cluster (correctness + tests + maintainability + conditional specialists) now runs at L2, not just `reviewer.correctness`; specialists stay L3-only. Spec/plan under `docs/superpowers/`.
- ✅ **Phase 3 — four-化 metrics** (SHIPPED v1.28.0): `sgc metrics` computes 规范化 12/13 · 智能化 11/23 LLM-invokable · 自动化 4/6 · 高效化 1 step·node≥18 live from embedded contracts + compiled symbols (no baseline read at runtime); `metrics/metrics-baseline.yaml` is a dev/CI drift reference (doctor check `J`/`K`). Spec/plan under `docs/superpowers/`.
- ✅ **Phase 2d — browse on the npm channel** (RESOLVED) + ✅ **real-browser runner WIRED (v1.29.0, Playwright)**: we deliberately do **not** ship the ~100 MB vendored `browse` binary on npm (`sgc doctor` check `E` keeps `plugins/` out of the npm `files` allowlist). The vendored binary proved non-functional in-repo (its server needs `diff` + `playwright` + `bun:sqlite`, none shipped), so `sgc qa`'s real-browser smoke was re-implemented on **Playwright** (`src/dispatcher/agents/playwright-runner.ts`): opt-in via `--browse` / `SGC_QA_REAL=1` → `goto` + console/page errors + screenshot → verdict; **stub by default** (`concern`, never rubber-stamps); needs a browser (`npx playwright install chromium`, or `SGC_QA_BROWSER=chrome`); works on both channels (playwright is a dependency). The vendored `plugins/sgc/browse/` tree has since been **removed**. **Roadmap Phase 0–3 + every Phase-2 item complete; only cross-cutting debt remains (2e was dropped — see Phase 2 / Cross-cutting).**

---

## Phase 1 (remaining) — runtime interop surface

The *docs* now say super-plugin; the *runtime* surface still talks like a delegation layer in places. Close that gap.

- **1a. Reframe the delegation surface.** Audit `src/dispatcher/delegation.ts` and every command-output string that surfaces an sp/gs "delegate / recommended" message. Reword to "optional richer path (if installed)" — consistent with the aligned docs. Behavior unchanged; framing only.
- **1b. Residual-string sweep.** `grep` the whole repo for stale claims: `coexist`, `NOT a replacement`, `ships separately`, `CLI ships separately`, `delegate to`, `规范层 + 知识引擎` (as the *sole* identity). Hit list likely includes `.claude-plugin/marketplace.json`, skill `SKILL.md` descriptions, agent prompt templates, `sgc.ts` header/`--help`.
- **1c. Self-description parity.** Confirm `sgc --help`, `sgc.ts` header, and `sgc doctor` self-description read as super-plugin.
- **Acceptance:** grep finds no stale coexist/not-a-replacement/ships-separately claims; the delegation surface reads as optional interop, not obligation.

## Phase 2 — native capability closure (the 融汇贯通 core)

The honest native gaps today (from `docs/POSITIONING.md` "Optional interop"). Each item is its own brainstorm→spec→plan→implement cycle, **wired through the CE loop + invariants**.

- **2a. TDD-ledger** *(highest-leverage; design already brainstormed this session — "ledger, not coach")*. NOT a re-implementation of `sp:test-driven-development`. A **ledger**: capture RED→GREEN transitions; anchor the existing `sgc work --done` close-gate to a *recorded prior-RED* (repro/failing-test + its red output) or an explicit `--waive-red <reason>`; the RED→GREEN pair auto-becomes a CE `solutions/` problem→fix entry feeding prior-art. Scope = extend `src/commands/work.ts` close-gate + a capture point; sgc *records* the loop, sp (if present) *runs* it. This operationalizes the spec's own "cite the prior-failing state" rule the close-gate doesn't yet enforce.
- **2b. Native deep planning.** `sgc plan` is light vs `sp:writing-plans`. Add a native deep-plan-authoring path (file-level task decomposition + bite-sized steps) — e.g. `sgc plan --deep` or a `planner.eng` extension — writing to `intent.md` + `feature-list.md`.
- **2c. Wire the full L2 reviewer cluster.** README/POSITIONING note the 6-reviewer L2 cluster is "manifested but not yet wired" — only `reviewer.correctness` runs at L2 today (specialists are L3-only). Wire the L2 cluster.
- **2d. browse on the npm channel.** ✅ **RESOLVED + real-browser runner WIRED (v1.29.0, Playwright)** (see Status above). Don't ship the ~100 MB vendored binary on npm; the vendored binary was non-functional, so `sgc qa`'s real-browser smoke runs on **Playwright** — opt-in `--browse` / `SGC_QA_REAL=1`, stub by default (`concern`, never rubber-stamps). The vendored `browse/` tree has been **removed** (superseded by the Playwright runner).
- **2e. (optional) native parallel-subagents** — ❌ **won't-do** (2026-06-04). No concrete need: the only parallelism need — the L2/L3 reviewer cluster — already runs via `Promise.all` in `src/commands/review.ts`. If a real fan-out need arises, use `sp:dispatching-parallel-agents` (the optional richer path) rather than building a native framework. YAGNI.
- **Acceptance per item:** new capability is native + standalone, closes through CE (a reuse/prevention path exists), invariants hold, doctor + CI gates green, POSITIONING "Optional interop" row updated from "light/thinnest gap" to "native".

## Phase 3 — four-化 metrics (make the claim measurable)

Operationalize each 化 as a metric with a baseline, and surface honestly (no baseless adjectives, per §10 / E-E-A-T).

- **规范化** — already ≈ 12/13 machine-enforced invariants + doctor checks; formalize as a tracked number.
- **智能化** — e.g. plan-fusion verdict quality, prior-art surface rate (`surfaced_in` / `applied_in`), classifier accuracy on an eval set.
- **自动化** — capture→promote automation rate (human steps per compound), CE-loop closure rate.
- **高效化** — TTHW (install → first successful command), commands-to-ship, one-command install time (now measurable post-Phase-0).
- **Deliverable:** a metrics surface (extend `sgc reflect`, or a `sgc metrics` view) + honest README numbers with baselines.

## Cross-cutting debt (address opportunistically)

- **doctor `bundleParityCheck` is content-only** — it does not check file mode; CI's `git diff --exit-code` is the backstop (this gap caused the v1.24.0 mode-drift release snag). Consider adding mode to the doctor check.
- **No cross-machine knowledge sync** — `.sgc/solutions/` is per-machine; a `sgc solutions sync` / local-team partition is future work.

## Release reminders (every phase)

- main-direct, no PR; bump `package.json` + `plugins/sgc/.claude-plugin/plugin.json` in **lockstep**; tag `v*` → `publish.yml` → npm.
- **If `src/` OR `package.json` changed, `npm run build:cli` + commit the rebuilt `plugins/sgc/bin/sgc.mjs`** (the bundle inlines both) — else the doctor/CI parity gate fails. Commit the bundle with mode `100755` (`git add --chmod=+x`).
- `npm publish --provenance` can throw a false-negative E403 on a double-PUT — verify via `npm view @sdsrs/sgc@<ver> dist.shasum`, don't blindly re-run.
