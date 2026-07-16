# sgc — All-in-One Engineering Workflow & Knowledge Engine for Claude Code

[![npm version](https://img.shields.io/npm/v/@sdsrs/sgc?logo=npm)](https://www.npmjs.com/package/@sdsrs/sgc)
[![install size](https://img.shields.io/badge/runtime-node%20%E2%89%A518.17-339933?logo=node.js&logoColor=white)](#install)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](https://docs.claude.com/en/docs/claude-code)
[![license](https://img.shields.io/npm/l/@sdsrs/sgc)](LICENSE)

**sgc is a self-contained [Claude Code](https://docs.claude.com/en/docs/claude-code) plugin that runs your entire engineering loop — plan → implement → review → QA → ship → compound — from one install.** It adds L0–L3 task classification, 13 runtime invariants, and a deduplicated knowledge engine that *compounds* what every task teaches you. One command to install, node-only, no extra runtime, no other plugins required.

> **In one sentence:** sgc turns Claude Code into a disciplined engineering agent that classifies each task, enforces the right process for its risk level, runs review/QA/security gates, ships it, and records reusable knowledge so the same mistake is never made twice.

sgc consolidates — natively, in-process — the engineering capabilities you'd otherwise install separately: gstack-style **canary / security review / browser QA / ship orchestration**, Superpowers-style **systematic debugging and verification gates**, and the **Compound Engineering** capture→promote→reuse loop. You don't need to install or wire up those plugins; sgc owns the whole workflow and runs standalone. (It will still interoperate with `superpowers` / `gstack` if you have them.)

## Why sgc?

- **One-command install, zero runtime hassle.** `/plugin install sgc` ships a self-contained Node bundle — works on any machine that runs Claude Code (Node ≥ 18.17). No `bun`, no second install step, no global setup.
- **Right-sized process per task.** Every task is classified **L0–L3** (typo → architecture) and gets exactly the planning, review depth, and human gates its risk warrants — no ceremony on a typo, full adversarial review + human signature on a migration.
- **13 runtime invariants, enforced — not suggested.** Generator/evaluator separation, immutable decisions, dedup-gated knowledge writes, scope tokens pinned at spawn, two-tier event audit. The protocol is machine-checked at every write.
- **A knowledge engine that compounds.** Every shipped task can promote a reusable solution/prevention into a deduplicated corpus; future plans surface prior art automatically, so lessons accumulate instead of evaporating.
- **Full loop in one tool.** `plan · work · review · qa · ship · compound · debug · cso · canary · land · reflect · loop` — the complete plan-to-prod pipeline plus security review, systematic debugging, post-publish canary, and knowledge reflection.

## Install

```bash
/plugin marketplace add sdsrss/sgc
/plugin install sgc
```

That's it. The plugin ships a self-contained Node CLI bundle (`plugins/sgc/bin/sgc.mjs`), so every `/sgc:*` slash command works immediately on any machine that runs Claude Code — **no `bun`, no separate `npm install`, no PATH setup.**

**Also available on npm** (for `npx`, CI, or use outside Claude Code):

```bash
npm install -g @sdsrs/sgc
sgc --version
```

The npm package runs on Node ≥ 18.17 (no `bun` runtime required). Both channels ship the **same bundle**; when both are present, the plugin-bundled CLI wins for version determinism.

<details>
<summary><strong>From source</strong> (to hack on sgc itself)</summary>

```bash
git clone https://github.com/sdsrss/sgc && cd sgc
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install   # bun client ignores HTTP_PROXY; use npm
bun --version    # ≥1.3 — dev/build/test runtime only (not needed by end users)
npm run build:cli                                 # rebuild plugins/sgc/bin/sgc.mjs
```

In source mode the slash commands fall back to `bun src/sgc.ts` when no bundle/global CLI is found.
</details>

### Update

```bash
/plugin marketplace update sgc   # refresh marketplace metadata first
/plugin update sgc               # then pull the new version
npm update -g @sdsrs/sgc         # if you also use the npm channel
```

Both plugin steps are needed — `/plugin update` alone uses cached marketplace metadata. Your project `.sgc/` state is untouched by updates.

### Uninstall

```bash
/plugin uninstall sgc
/plugin marketplace remove sgc
```

No global footprint is left behind. Project-level `.sgc/` directories are **not** removed — that's your data, not plugin data (`rm -rf .sgc` per project to wipe state).

## Quick start

```bash
# 1. Plan a task — classifier picks L0–L3, runs the planner cluster, writes immutable intent
#    (L1+ requires --motivation ≥20 words; L0 typos skip intent entirely)
sgc plan "add an Example section to the plan skill" \
  --motivation "Newcomers can't verify the skill end-to-end without sample input/output, so add a runnable Example block matching the repo's format."

# 2. Track implementation progress (you write code; sgc tracks features + gates 'done')
sgc work                                   # list features, highlight active
sgc work --add "verify empty-input path"
sgc work --done f1 --verify-command "bun test tests/foo.test.ts"

# 3. Independent review of your diff
sgc review                                 # reviewer.correctness at L1; full cluster (tests + maintainability + conditional specialists) at L2+ vs git diff

# 4. Ship + compound knowledge
sgc ship                                   # 8-gate ship; auto-runs the compound janitor
sgc status                                 # dashboard: active task, level, last activity
```

State lives under `.sgc/` in the project (override via `SGC_STATE_ROOT`); it's `.gitignore`d — runtime state, not source.

## Commands

| Command | Purpose |
|---------|---------|
| `sgc discover <topic>` | Forcing-question clarifier; feeds `sgc plan --motivation` |
| `sgc plan <task> [--motivation\|--signed-by\|--level\|--async]` | Classify L0–L3; run the planner cluster (L2 adds ceo+researcher, L3 adds adversarial + human signature); write immutable `decisions/{id}/intent.md` |
| `sgc work [--add\|--done <id> --verify-command <s> [--evidence <s>]]` | Track `feature-list.md`; `--done` **requires** a verify command (verification close-gate) |
| `sgc review [--base <ref>]` | Independent review on your git diff → append-only report(s); correctness at L1, full cluster at L2+ |
| `sgc qa [<target>] [--flows a,b,c]` | End-to-end QA gate (required before an L2+ ship). Real-browser smoke (Playwright) is **opt-in** via `--browse` / `SGC_QA_REAL=1`; **stub by default** — returns `concern`, never rubber-stamps |
| `sgc ship [--auto\|--pr\|--no-janitor\|--force-compound]` | 8-gate ship; optional `gh pr create`; auto-invokes the compound janitor |
| `sgc compound [--from-ship-failure\|--from-canary\|--force\|--slug …]` | Extract + dedup-gate (0.85) + write reusable `solutions/{cat}/{slug}.md` |
| `sgc reflect [--task\|--since\|--save\|--json]` | Audit which stored solutions/preventions actually surfaced in your decisions |
| `sgc loop <task> [--resume\|--runs\|--status]` | End-to-end orchestrator: plan → work → review → qa → ship → compound with manual gates |
| `sgc debug <start\|close> […]` | 4-phase systematic debugging (investigate → analyze → hypothesize → implement); `close` is a hard-gate |
| `sgc cso [--mode daily\|comprehensive]` | Pre-ship security review — secret scan + dependency audit + event-stream anomaly detection |
| `sgc canary [--package\|--version\|--phases\|--health-url …]` | Post-publish health check (npm propagation → smoke install → optional health URL) |
| `sgc land` | Post-publish ship chain (`watch-ci-failure` + `canary`, fail-fast) |
| `sgc watch-ci-failure [--run-id\|--workflow]` | Poll publish CI; capture a templated ship-failure record for promotion |
| `sgc handoff [--auto]` | Session-state checkpoint → `tasks/<slug>-paused.md` for post-compaction recovery |
| `sgc status` / `sgc tail […]` | Dashboard / live `.sgc/progress/events.ndjson` audit stream |
| `sgc metrics [--json\|--write-baseline]` | Four-化 product self-scorecard (read-only); numbers below are reproduced by this command |
| `sgc doctor` | Self-check: contracts ↔ prompts ↔ command parity ↔ bundle freshness |

20 commands total — 17 are also exposed as `/sgc:*` slash commands inside Claude Code; `canary`, `watch-ci-failure`, and `land` are CLI-only. Real-browser QA uses **Playwright** (opt-in via `--browse` / `SGC_QA_REAL=1`; needs a browser — `npx playwright install chromium`, or `SGC_QA_BROWSER=chrome` for system Chrome); `sgc qa` defaults to a non-rubber-stamping stub.

**Four-化 scorecard** (run `sgc metrics` to reproduce): 规范化 12/13 · 智能化 13/23 LLM-invokable · 自动化 5/9 · 高效化 1 step·node≥18.17. These numbers are produced by `sgc metrics`; see `metrics/metrics-baseline.yaml` — they are not hand-maintained, and `sgc doctor` fails if this line drifts from the live output.

## Task levels (L0–L3)

| Level | Scope | Planning | Review | Human gate |
|-------|-------|----------|--------|------------|
| **L0** | Trivial (typo, format, config) | Skip — direct to work | None | No |
| **L1** | Single file, < 50 lines, no behavior change | Light planner.eng | reviewer.correctness | No |
| **L2** | Multi-file / behavior change / new tests | + planner.ceo + researcher.history | correctness + tests + maintainability + conditional specialists | No |
| **L3** | Architecture, schema, prod, infra | + planner.adversarial | + conditional specialists (security/migration/perf/infra) | **Signature required; `--auto` refused** |

## Knowledge engine — the compounding loop

sgc's differentiator is that work **compounds**. The loop: a shipped task → the compound janitor decides if it's worth keeping → a 4-agent cluster extracts a solution/prevention → it passes a deduplication gate (Jaccard ≥ 0.85, non-tunable) → it's written to an append-only `solutions/` corpus. On the next plan, `researcher.history` mines that corpus and `planner.adversarial` is injected with relevant preventions — so prior lessons actively shape new decisions. `sgc reflect` audits how often stored knowledge actually surfaces.

## Invariants (enforced at runtime)

| § | Rule |
|---|------|
| 1 | Reviewers/QA cannot read `solutions/` (generator–evaluator separation) |
| 2 | Decisions are immutable once written (changed intent → new task) |
| 3 | No write to `solutions/` without a dedup stamp from a prior `compound.related` run |
| 4 | L3 requires a human signature + interactive confirm; `--auto` refused |
| 5 | A reviewer-fail override needs a human signature + reason (≥ 40 chars) |
| 6 | Every janitor/review/QA decision is logged (no silent skips) |
| 7 | Schema validation precedes every `.sgc/` write |
| 8 | Subagent scope tokens are pinned at spawn (no runtime elevation) |
| 9 | Subagents may only emit their declared output shape |
| 10 | The compound cluster is all-or-nothing (transactional) |
| 11 | The classifier must justify its level with a concrete task feature |
| 12 | The eval framework is authoritative; a new invariant ships with its regression test |
| 13 | Every spawn + LLM call emits paired audit events (two-tier) |

§1 and §8 are fully enforced in `inline` mode; under real-LLM modes (`claude-cli` / `anthropic-sdk`) they are advisory unless you sandbox the spawned process. See [docs/POSITIONING.md](docs/POSITIONING.md) for the full trust model.

## Agent dispatch modes

sgc auto-detects an LLM backend per priority: `SGC_FORCE_INLINE=1` → **inline** (deterministic heuristics, no network) · `ANTHROPIC_API_KEY` → **anthropic-sdk** (direct API + prompt caching) · `OPENROUTER_API_KEY` → **openrouter** · `claude` binary in PATH → **claude-cli** (subscription-friendly) · otherwise **file-poll** (you fulfill prompts manually via `sgc agent-loop`). Force a mode with `SGC_AGENT_MODE=<mode>`.

**Where your code goes.** In `anthropic-sdk` and `openrouter` modes, each subagent's prompt — which includes your task text, source excerpts and diffs — is sent to that provider (Anthropic, or `openrouter.ai` and whichever upstream it routes to). `openrouter` mode activates on nothing more than the env var being set, so sgc prints a one-time stderr notice when it does. `claude-cli` mode goes through your local `claude` binary and its own account; `inline` and `file-poll` send nothing anywhere. If you are reviewing code that must not leave the machine, use `SGC_FORCE_INLINE=1` or unset the keys.

## Architecture

```
contracts/        spec source-of-truth — capabilities.yaml, state.schema.yaml, invariants.md
src/
  sgc.ts          citty CLI (20 subcommands)
  commands/       one implementation per subcommand
  dispatcher/     spawn protocol, scope tokens, dedup, embedded contracts/prompts, state I/O
plugins/sgc/
  bin/sgc.mjs     self-contained Node bundle shipped to /plugin install (contracts+prompts inlined)
  {skills,commands,hooks}/   markdown prompt layer + slash commands + SessionStart hook
tests/dispatcher/ deterministic unit + integration suite (bun test)
tests/eval/       end-to-end LLM scenarios (Invariant §12)
```

The Node bundle inlines `contracts/` + `prompts/`, so the shipped CLI is fully self-contained. `sgc doctor` verifies the committed bundle matches a fresh rebuild (`scripts/build-cli.mjs`), and CI fails on a stale bundle.

## Test

```bash
npm test              # deterministic dispatcher suite (1051 tests, 0 flake)
npm run test:eval     # real-LLM evaluation lane (gated on API keys)
npm run typecheck     # tsc --noEmit (strict)
```

CI (`.github/workflows/test.yml`) runs the dispatcher suite + typecheck + a bundle-freshness gate on every push/PR.

## FAQ

**Do I need bun, Superpowers, or gstack to use sgc?**
No. As of v1.24.0 the CLI ships as a self-contained Node bundle — `/plugin install sgc` gives you a working CLI on any machine with Node ≥ 18.17. sgc runs the full loop standalone; if `superpowers` / `gstack` are installed it can interoperate, but neither is required.

**How does sgc install in one command?**
`/plugin marketplace add sdsrss/sgc` then `/plugin install sgc`. The plugin payload contains the compiled Node bundle plus the slash-command prompt layer, so there is no separate CLI install step.

**What makes sgc different from a generic AI coding assistant?**
It enforces a level-appropriate process (L0–L3), 13 machine-checked invariants, and a deduplicated knowledge corpus that compounds across tasks — so review rigor scales with risk and lessons are reused, not relearned.

**Where is my data stored?**
Per-project, per-machine, under a `.gitignore`d `.sgc/` directory. There is no telemetry and no built-in cloud sync (cross-machine knowledge sharing is on the roadmap).

## Links

- npm: [@sdsrs/sgc](https://www.npmjs.com/package/@sdsrs/sgc)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Positioning & trust model: [docs/POSITIONING.md](docs/POSITIONING.md)
- Curated solutions/preventions: [docs/SOLUTIONS.md](docs/SOLUTIONS.md)

## License

MIT
