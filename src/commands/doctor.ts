// `sgc doctor` — consistency checks across the three name registries:
//
//   1. contracts/sgc-capabilities.yaml  (manifest, source-of-truth)
//   2. prompts/*.md                     (LLM templates referenced by prompt_path)
//   3. src/dispatcher/agents/*.ts       (implementations — heuristic + LLM coerce)
//
// Adding a new agent touches all three, and pre-spawn validation
// (spawn.ts:formatPrompt) only catches prompt_path mismatches at runtime,
// when a user has already typed `sgc plan ...`. `sgc doctor` runs the
// checks ahead of time — useful as a pre-PR hook and as a smoke test in
// CI.
//
// Checks:
//   (A) Every manifest with `prompt_path` declared → file exists in prompts/
//   (B) Every prompts/*.md file → at least one manifest references it
//   (C) status: slot-only entries → MUST have prompt_path: null (they are
//       documented placeholders, not LLM-routable)
//
// Exit code: 0 if zero failures, 1 otherwise. Warnings (orphan prompts)
// do not affect exit code — they signal "you may have stale template
// files" without blocking ship.

import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnCapture } from "../dispatcher/subprocess"
import { load as yamlLoad, dump as yamlDump } from "js-yaml"
import { getCapabilities, getSubagentManifest } from "../dispatcher/schema"
import { deriveCliFact, CLI_FACT_MARKER, DERIVED_AGENT_IDS } from "../dispatcher/agent-facts"
import { EMBEDDED_PROMPTS, listEmbeddedPromptKeys } from "../dispatcher/embedded-data"
import {
  computeMetricsLive,
  parseBaseline,
  diffMetrics,
  type FourHuaMetrics,
} from "../dispatcher/metrics"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(moduleDir, "..", "..")

/**
 * Extract subcommand names from the `subCommands: { ... }` block in src/sgc.ts.
 * Textual (not import-based) so `sgc doctor` never triggers the CLI's runMain
 * side effect. Source of truth stays sgc.ts.
 */
export function extractCliSubcommands(src: string): string[] {
  const marker = "subCommands: {"
  const start = src.indexOf(marker)
  if (start === -1) return []
  const rest = src.slice(start + marker.length)
  const end = rest.indexOf("\n  }") // 2-space closing brace of the block
  const block = end === -1 ? rest : rest.slice(0, end)
  const names: string[] = []
  const re = /["']?([a-z][a-z0-9-]*)["']?\s*:\s*\(\)\s*=>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) names.push(m[1] as string)
  return names
}

type Severity = "ok" | "warn" | "fail"

interface CheckRow {
  severity: Severity
  msg: string
}

/**
 * Pure check (L): is the `## Implementation Status (vX.Y.Z …)` header in
 * plugins/sgc/CLAUDE.md behind package.json? That header is LLM-visible
 * metadata steering Claude Code; it once drifted to v1.20.0 while the package
 * shipped v1.29.1 (and falsely claimed the L2 reviewer cluster "not yet
 * wired"). Warn (not fail) so it surfaces drift without blocking ship.
 */
export function statusHeaderFreshness(
  claudeMd: string,
  pkgVersion: string,
): { severity: Severity; msg: string } {
  const h = /##\s+Implementation Status\s*\(v(\d+)\.(\d+)\.(\d+)/.exec(claudeMd)
  const p = /^(\d+)\.(\d+)\.(\d+)/.exec(pkgVersion)
  if (!h) return { severity: "warn", msg: 'no "## Implementation Status (vX.Y.Z" header in CLAUDE.md' }
  if (!p) return { severity: "warn", msg: `unparseable package.json version: ${pkgVersion}` }
  const hMaj = Number(h[1]), hMin = Number(h[2]), hPat = Number(h[3])
  const pMaj = Number(p[1]), pMin = Number(p[2]), pPat = Number(p[3])
  const behind =
    hMaj < pMaj || (hMaj === pMaj && (hMin < pMin || (hMin === pMin && hPat < pPat)))
  const hVer = `${hMaj}.${hMin}.${hPat}`
  const pVer = `${pMaj}.${pMin}.${pPat}`
  return behind
    ? {
        severity: "warn",
        msg: `CLAUDE.md status header v${hVer} trails package.json v${pVer} — refresh the status header`,
      }
    : { severity: "ok", msg: `CLAUDE.md status header v${hVer} ≥ package.json v${pVer}` }
}

/**
 * Parse the git-recorded file mode for the committed bundle from
 * `git ls-files --stage <path>` output and decide whether the exec bit is set.
 *
 * Content-hash parity is mode-blind: a committed bundle can match the source
 * rebuild byte-for-byte yet still carry git mode 100644 (no exec bit). On a
 * fresh checkout that file lands non-executable, and CI's `git diff --exit-code`
 * staleness gate flags the mode drift while a local content-only sha check
 * passes — exactly the v1.24.0 release snag. We read the *git-recorded* mode
 * (not the working-tree FS mode, which build:cli may have already chmod'd to
 * 0o755 locally, masking the drift) to replicate the CI gate's semantics.
 *
 * Returns true if recorded mode is 100755, false if it lacks the exec bit,
 * null when the path is untracked / not a git repo (mode is indeterminate →
 * caller skips the check rather than failing).
 */
export function bundleExecBitOk(lsFilesStdout: string): boolean | null {
  const line = lsFilesStdout.trim()
  if (!line) return null
  const mode = line.split(/\s+/)[0] ?? "" // e.g. "100755" from "100755 <sha> 0\t<path>"
  if (!/^\d{6}$/.test(mode)) return null
  return (parseInt(mode, 8) & 0o111) !== 0
}

/**
 * P1-4 (audit v1.31.8): README four-化 scorecard ↔ live `sgc metrics` parity.
 *
 * The README asserts these numbers "are produced by `sgc metrics` … they are
 * not hand-maintained" and invites the reader to run the command. In fact they
 * were hand-copied: README carried 自动化 4/6 while the tool printed 5/9 (the
 * automation metric grew the CE-arc stages in v1.29+). For a project whose
 * pitch is honest measurement, the one claim a user can check in a single
 * command was the one that was false — so the prose gets a machine gate, same
 * as the metrics baseline (check K).
 *
 * Parses the three counted 化 out of the README's scorecard line. 高效化 is
 * prose-shaped ("1 step·node≥18") and covered by check K's baseline, so it is
 * deliberately not parsed here.
 *
 * Returns a human-readable drift line per mismatch; empty = in sync.
 */
export function readmeScorecardDrift(readme: string, live: FourHuaMetrics): string[] {
  const expected: [string, number, number][] = [
    ["规范化", live.standardization.machine_enforced, live.standardization.total],
    ["智能化", live.intelligence.llm_invokable, live.intelligence.total_subagents],
    ["自动化", live.automation.automated_steps, live.automation.total_steps],
  ]
  const drifts: string[] = []
  for (const [label, num, den] of expected) {
    // `<label> <n>/<d>` — the scorecard's literal shape in README.md.
    const m = readme.match(new RegExp(`${label}\\s+(\\d+)\\s*/\\s*(\\d+)`))
    if (!m) {
      drifts.push(`${label}: no "${label} <n>/<d>" found in README (expected ${num}/${den})`)
      continue
    }
    if (Number(m[1]) !== num || Number(m[2]) !== den) {
      drifts.push(`${label}: README says ${m[1]}/${m[2]}, live metrics say ${num}/${den}`)
    }
  }
  return drifts
}

export interface AgentMdFile {
  /** `<group>.<name>` derived from agents/<group>/<name>.md */
  id: string
  file: string
  text: string
}

/** Resolve an agent id to its manifest entry; null when absent. Injected so the
 *  check is unit-testable without a contracts dir on disk. */
export type ManifestLookup = (
  id: string,
) => { prompt_path?: string | null; status?: string } | null

/**
 * Manifest ids with no Claude Code registry file (M4).
 *
 * All four are dispatched inside sgc and work; none is exposed as a Claude Code
 * subagent, so none has a prompt body for Claude to run. `reviewer.migration`
 * and `reviewer.infra` are keyword matchers spawned by `sgc review` at L2+;
 * `clarifier.discover` and `planner.decompose` are LLM-backed (they have a
 * `prompt_path`) and are dispatched by `sgc discover` / `sgc plan`.
 *
 * Recorded, not designed: the manifest→file direction below did not exist, so
 * these absences were nobody's decision — they were invisible. The review that
 * prompted this fix predicted two of them; the check found four. Listing them
 * makes the gap explicit and makes any NEW absence fail.
 *
 * M5: `reviewer.migration` and `reviewer.infra` are OFF this list — they now have
 * files. Exempting them in M4 was the wrong call and worth naming: both are
 * `status: implemented`, both spawn at L2+ via matchSpecialists(), and both emit
 * `high` — the loudest severity in the cluster. So a reader auditing
 * plugins/sgc/agents/reviewer/ to learn what `sgc review` does was missing exactly
 * the two reviewers most likely to block their ship, while finding two
 * (adversarial, spec) that never run at all. An exemption list is for absences that
 * are a decision; theirs was an oversight wearing an exemption's clothes.
 */
const REGISTRY_EXEMPT_IDS = new Set(["clarifier.discover", "planner.decompose"])

/**
 * P3-2 (audit v1.31.8): bind the Claude Code agent registry to the manifest.
 *
 * `plugins/sgc/agents/**\/*.md` frontmatter `description:` is LLM-visible
 * metadata — what a model reads to decide whether a capability exists. doctor
 * gates the other two registries (prompts↔manifest in check B, slash↔CLI in
 * check H) but never this one, so it drifted into advertising work the runtime
 * does not do: an "OWASP Top 10" security reviewer that is a regex over
 * auth|jwt|token, and two reviewers claiming to be "Dispatched by /review"
 * while the manifest marks them slot-only — never dispatched at all.
 *
 * Obligations, derived from the manifest rather than from prose review:
 *   - `status: slot-only` → the description must say it is not implemented, and
 *     must NOT also claim to be dispatched.
 *   - `prompt_path: null` → the description must disclose it is heuristic, since
 *     `prompt_path` truthiness is this project's honest LLM-backed signal (it is
 *     what `sgc metrics` 智能化 counts).
 *   - every manifest id has a registry file, or is exempt above (M4).
 *
 * ## What this check CANNOT do, and why that matters (M4)
 *
 * It enforces WIRING and DISCLOSURE, not ACCURACY. It cannot read the
 * implementation and decide whether the prose describes it. So a description
 * can carry the required word and still lie about everything else, and this
 * check will pass it — which is exactly what happened: the P3-2 honesty pass
 * itself shipped `maintainability.md` advertising long-function/large-file
 * analysis that the code never performed, and `janitor/archive.md` describing
 * housekeeping with zero implementation. Both said "heuristic". Both passed.
 *
 * Treat a green (N) as "the registry is wired and discloses its LLM-backing",
 * never as "the descriptions are true". The latter needs a human reading the
 * code, and `tests/dispatcher/m4-agent-metadata.test.ts` pins the specific
 * claims that have been wrong before.
 */
export function agentMetadataDrift(
  files: AgentMdFile[],
  lookup: ManifestLookup,
  manifestIds: string[] = [],
): string[] {
  const drifts: string[] = []
  for (const f of files) {
    // Use the real manifest parser, not a regex: entries are written in three
    // shapes (block, `&anchor` block, and `{ <<: *anchor, ... }` flow map), and
    // a hand-rolled matcher silently reports the anchored ones as orphans.
    const entry = lookup(f.id)
    if (!entry) {
      drifts.push(`${f.id}: ${f.file} has no manifest entry (orphan registry file)`)
      continue
    }
    // Parse the frontmatter as YAML rather than regexing it (M4). The old
    // `/description:\s*"([^"]*)"/` only matched double-quoted single-line
    // values: an unquoted description (valid YAML) captured "" and was then
    // accused of not disclosing what it disclosed perfectly, and an escaped
    // quote truncated the capture at the escape.
    let desc: string
    try {
      desc = readFrontmatterDescription(f.text).toLowerCase()
    } catch (err) {
      drifts.push(`${f.id}: ${f.file} frontmatter does not parse (${String(err).slice(0, 80)})`)
      continue
    }
    // M5: `manual-only` is the same situation as `slot-only` for this check — the
    // CLI does not run it, and that is the fact the description owes a reader.
    // janitor.archive previously fell through to the heuristic branch below and
    // was told to "disclose it is not LLM-backed": a category error, since there
    // is no implementation to be LLM-backed or not. The M4 test recorded that the
    // manual-only/slot-only split was how it escaped the earlier relabelling —
    // recorded as a curiosity, when it was the bug.
    const cliNeverRuns = entry.status === "slot-only" || entry.status === "manual-only"
    const heuristic = !entry.prompt_path

    if (cliNeverRuns) {
      if (!/(not implemented|slot-only|manual-only|never dispatched|not wired|never runs)/.test(desc)) {
        drifts.push(
          `${f.id}: manifest says status slot-only (never dispatched) but ${f.file} advertises it as working`,
        )
      } else if (/dispatched by/.test(desc)) {
        // A disclaimer in a parenthetical does not neutralize the claim in the
        // sentence. "…Dispatched by /review for L2+ tasks. (The legacy stub is
        // not wired.)" satisfied the check above while restoring the precise
        // overclaim P3-2 removed.
        drifts.push(
          `${f.id}: ${f.file} is slot-only yet still says "dispatched by" — a disclaimer elsewhere does not undo it`,
        )
      }
      continue
    }
    // The obligation is "disclose that this is not LLM-backed", not "use the
    // word heuristic". The accurate word differs per agent: compound.related is
    // deterministic BY DESIGN (§3 — an LLM could mint a dedup verdict past the
    // write gate), qa.browser drives a real browser, janitor.* runs decision
    // rules. Forcing one vocabulary would trade one inaccuracy for another.
    if (heuristic && !/(heuristic|keyword match|deterministic|not llm-backed|rule-based|not implemented)/.test(desc)) {
      drifts.push(
        `${f.id}: manifest says prompt_path null (not LLM-backed) but ${f.file} does not disclose it`,
      )
    }
  }

  // M4: the other direction. Check B binds prompts↔manifest both ways; this one
  // only ever walked files → manifest, so an id that is manifested and
  // dispatched but has no registry file was invisible.
  const present = new Set(files.map((f) => f.id))
  for (const id of manifestIds) {
    if (present.has(id) || REGISTRY_EXEMPT_IDS.has(id)) continue
    drifts.push(`${id}: manifested but has no registry file under plugins/sgc/agents/ (missing)`)
  }
  return drifts
}

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

/** Read `description:` out of an agent file's YAML frontmatter. Throws on malformed YAML. */
function readFrontmatterDescription(text: string): string {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1]
  if (block === undefined) throw new Error("no frontmatter block")
  const parsed = yamlLoad(block)
  if (typeof parsed !== "object" || parsed === null) throw new Error("frontmatter is not a mapping")
  const d = (parsed as Record<string, unknown>)["description"]
  return typeof d === "string" ? d : ""
}

/** Enumerate the agent registry: agents/<group>/<name>.md → `<group>.<name>`. */
export function readAgentMdFiles(root: string): AgentMdFile[] {
  const dir = resolve(root, "plugins", "sgc", "agents")
  if (!existsSync(dir)) return []
  const out: AgentMdFile[] = []
  for (const group of readdirSync(dir)) {
    const gdir = resolve(dir, group)
    if (!statSync(gdir).isDirectory()) continue
    for (const f of readdirSync(gdir)) {
      if (!f.endsWith(".md")) continue
      out.push({
        id: `${group}.${f.slice(0, -3)}`,
        file: `plugins/sgc/agents/${group}/${f}`,
        text: readFileSync(resolve(gdir, f), "utf8"),
      })
    }
  }
  return out
}

/**
 * P2-2: the bun version CI pins for `bun build`, read from a workflow file.
 * Returns null when no `bun-version:` pin is present.
 */
export function ciPinnedBunVersion(workflowYaml: string): string | null {
  const m = workflowYaml.match(/bun-version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+)["']?/)
  return m?.[1] ?? null
}

/**
 * P2-2: decide what a bundle hash mismatch actually means.
 *
 * `bun build` output is not byte-stable across bun versions (measured on this
 * repo: 1.3.5 reproduces the committed bundle exactly, 1.3.11 does not), so a
 * mismatch only proves staleness when the local toolchain matches CI's pin.
 * Otherwise the old "✗ committed bundle STALE — run `npm run build:cli` and
 * commit" was worse than nothing: following it replaces a correct artifact with
 * one CI's own `git diff --exit-code` gate rejects — a false alarm that
 * manufactures a real failure.
 *
 * Unknown on either side → keep failing. An unreadable pin is not evidence of
 * innocence, and silently downgrading a possibly-real staleness would defeat
 * the gate.
 */
export function bundleStaleSeverity(
  localBun: string | null,
  ciBun: string | null,
): { severity: "fail" | "warn"; msg: string } {
  if (localBun && ciBun && localBun !== ciBun) {
    return {
      severity: "warn",
      msg:
        `  ⚠ bundle-hash differs, but your bun (${localBun}) is not CI's pinned bun (${ciBun}) — ` +
        `inconclusive, and bun's output is not byte-stable across versions. ` +
        `Do NOT rebuild-and-commit from this bun: CI rebuilds with ${ciBun} and would reject it. ` +
        `To check for real: npx bun@${ciBun} build (or match CI's bun), then re-run doctor.`,
    }
  }
  return {
    severity: "fail",
    msg: "  ✗ committed bundle STALE — run `npm run build:cli` and commit",
  }
}

export async function bundleParityCheck(root: string): Promise<CheckRow> {
  const srcEntry = resolve(root, "src", "sgc.ts")
  const committed = resolve(root, "plugins", "sgc", "bin", "sgc.mjs")
  // scripts/build-cli.mjs is the SINGLE source of truth for the bun-build flags
  // (shared with package.json build:cli). Rebuilding via the same script means
  // a flag change can never produce a silent false-STALE failure here.
  const buildScript = resolve(root, "scripts", "build-cli.mjs")
  if (!existsSync(srcEntry) || !existsSync(committed) || !existsSync(buildScript)) {
    return { severity: "ok", msg: "  ⓘ bundle-hash parity skipped (no source checkout — dev/CI-only check)" }
  }
  const tmp = mkdtempSync(resolve(tmpdir(), "sgc-bundle-"))
  const out = resolve(tmp, "sgc.mjs")
  try {
    const r = await spawnCapture(["node", buildScript, "--outfile", out], { cwd: root })
    if (r.exitCode !== 0) return { severity: "warn", msg: `  ⚠ bundle-hash parity: rebuild failed (${r.stderr.slice(0, 120)})` }
    const sha = (buf: Buffer) => createHash("sha256").update(buf).digest("hex")
    // build-cli.mjs normalizes the shebang identically in both the committed
    // bundle and this temp rebuild; strip-before-hash is kept as defensive
    // belt-and-suspenders (harmless when both already match).
    const strip = (b: Buffer) => Buffer.from(b.toString("utf8").replace(/^#![^\n]*\n/, ""))
    const a = sha(strip(readFileSync(out)))
    const b = sha(strip(readFileSync(committed)))
    if (a !== b) {
      // P2-2: a hash mismatch only proves staleness if we built with CI's bun.
      const localBun = (await spawnCapture(["bun", "--version"], { cwd: root })).stdout.trim() || null
      let ciBun: string | null = null
      try {
        ciBun = ciPinnedBunVersion(readFileSync(resolve(root, ".github/workflows/test.yml"), "utf8"))
      } catch {
        // No workflow on disk (e.g. npm-installed tree) → can't compare → fail.
      }
      return bundleStaleSeverity(localBun, ciBun)
    }
    // Content matches; now guard the git-recorded exec bit (build:cli emits
    // 0o755 → must be committed 100755). Best-effort: a non-repo/untracked
    // checkout returns null and we skip rather than fail.
    const ls = await spawnCapture(["git", "ls-files", "--stage", "plugins/sgc/bin/sgc.mjs"], { cwd: root })
    const execOk = ls.exitCode === 0 ? bundleExecBitOk(ls.stdout) : null
    if (execOk === false) {
      return {
        severity: "fail",
        msg: "  ✗ committed bundle missing git exec bit (100644) — run `git add --chmod=+x plugins/sgc/bin/sgc.mjs` and commit",
      }
    }
    return { severity: "ok", msg: "  ✓ committed bundle matches source rebuild (content + exec bit)" }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

export interface DoctorOptions {
  log?: (msg: string) => void
  /** Override repo root for tests (default: derived from import.meta). */
  repoRoot?: string
  /** Regenerate the derived CLI-fact clause in plugins/sgc/agents/**\/*.md
   *  before any check runs, so a single invocation both fixes and verifies. */
  writeDescriptions?: boolean
}

export interface DoctorReport {
  ok: number
  warn: number
  fail: number
  rows: CheckRow[]
}

export async function runDoctor(opts: DoctorOptions = {}): Promise<DoctorReport> {
  const log = opts.log ?? ((m: string) => console.log(m))
  const root = opts.repoRoot ?? repoRoot

  const rows: CheckRow[] = []
  const emit = (row: CheckRow): void => {
    rows.push(row)
    log(row.msg)
  }

  const caps = getCapabilities()
  const manifests = Object.entries(caps.subagents)

  // Detect whether a source checkout is present. Checks that read repo source/config
  // files (D/E/F/G/H/I) are only meaningful in dev/CI; in a shipped bundle those
  // files don't exist and each such check emits a single info/skip row instead.
  const hasSource = existsSync(resolve(root, "src", "sgc.ts"))

  if (opts.writeDescriptions) {
    // Same readAgentMdFiles call check (O) below had to learn to guard — a
    // broken symlink under agents/ throws, and an explicit --write-descriptions
    // invocation shouldn't crash uninformatively any more than a check should.
    try {
      const written: string[] = []
      for (const f of readAgentMdFiles(root)) {
        if (!DERIVED_AGENT_IDS.includes(f.id)) continue
        const next = rewriteCliFact(f.text, f.id)
        if (next !== f.text) {
          writeFileSync(resolve(root, f.file), next, "utf8")
          written.push(f.id)
        }
      }
      log(
        written.length > 0
          ? `wrote CLI-fact clause for: ${written.join(", ")}`
          : "all CLI-fact clauses already match the code",
      )
    } catch (e) {
      log(`✗ --write-descriptions failed: ${(e as Error).message.slice(0, 120)}`)
    }
  }

  // ── (A) manifest.prompt_path → embedded (bundle) or file exists (dev) ───
  log("=== Manifest prompt_path ↔ prompts/ ===")
  for (const [name, m] of manifests) {
    if (m.prompt_path == null) continue
    const present = EMBEDDED_PROMPTS[m.prompt_path] !== undefined
    if (present) {
      emit({ severity: "ok", msg: `  ✓ ${name} → ${m.prompt_path}` })
    } else {
      emit({
        severity: "fail",
        msg: `  ✗ ${name} → ${m.prompt_path} (NOT EMBEDDED)`,
      })
    }
  }

  // ── (B) prompts/*.md → referenced by some manifest ─────────────────────
  log("")
  log("=== prompts/ ↔ manifest ===")
  const declaredPrompts = new Set<string>()
  for (const [, m] of manifests) {
    if (m.prompt_path) declaredPrompts.add(m.prompt_path)
  }
  for (const rel of listEmbeddedPromptKeys().sort()) {
    if (declaredPrompts.has(rel)) {
      emit({ severity: "ok", msg: `  ✓ ${rel}` })
    } else {
      emit({
        severity: "warn",
        msg: `  ⚠ ${rel} (orphan — embedded but unreferenced)`,
      })
    }
  }

  // ── (C) slot-only entries → prompt_path must be null/undefined ─────────
  log("")
  log("=== status: slot-only ↔ prompt_path: null ===")
  for (const [name, m] of manifests) {
    if (m.status !== "slot-only") continue
    if (m.prompt_path == null) {
      emit({
        severity: "ok",
        msg: `  ✓ ${name} (slot-only, no prompt_path)`,
      })
    } else {
      emit({
        severity: "fail",
        msg: `  ✗ ${name} (slot-only but declares prompt_path: ${m.prompt_path})`,
      })
    }
  }

  // ── (D) bunfig.toml [test] root="tests" — keeps `bun test` scoped ──────
  // A bare `bun test` must stay scoped to sgc's gate (tests/); otherwise it
  // would scan the whole repo instead of the dispatcher + eval suites.
  log("")
  log("=== bunfig.toml [test] root ===")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ bunfig.toml root skipped (no source checkout — dev/CI-only check)" })
  } else {
    const bunfigPath = resolve(root, "bunfig.toml")
    if (!existsSync(bunfigPath)) {
      emit({
        severity: "warn",
        msg: '  ⚠ bunfig.toml not found — bare `bun test` may sweep vendored suites (R0)',
      })
    } else if (/root\s*=\s*["']tests["']/.test(readFileSync(bunfigPath, "utf8"))) {
      emit({ severity: "ok", msg: '  ✓ bunfig.toml [test] root="tests"' })
    } else {
      emit({
        severity: "fail",
        msg: '  ✗ bunfig.toml present but [test] root!="tests" — bare `bun test` would scan the whole repo, not just tests/',
      })
    }
  }

  // ── (E) package.json "files" excludes vendored plugins/ ────────────────
  log("")
  log("=== package.json files ↔ no vendored plugins/ ===")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ package.json files skipped (no source checkout — dev/CI-only check)" })
  } else {
    const pkgPath = resolve(root, "package.json")
    if (!existsSync(pkgPath)) {
      emit({ severity: "warn", msg: "  ⚠ package.json not found" })
    } else {
      let files: string[] = []
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { files?: unknown }
        files = Array.isArray(pkg.files) ? (pkg.files as string[]) : []
      } catch (e) {
        emit({
          severity: "fail",
          msg: `  ✗ package.json parse error: ${(e as Error).message.slice(0, 80)}`,
        })
        files = []
      }
      // Flag any entry under "plugins" that would publish the plugin payload
      // (markdown, skills, etc.) to npm. Only files under the committed bundle
      // dir "plugins/sgc/bin/" (e.g. "plugins/sgc/bin/sgc.mjs") are intentional
      // npm artifacts — every other plugins path (directory-style OR an explicit
      // non-bin file like "plugins/sgc/skills/qa/SKILL.md") is a leak.
      const leaks = files.filter((f) => {
        const norm = f.replace(/^\.?\//, "")
        if (!norm.startsWith("plugins")) return false
        const last = norm.split("/").at(-1) ?? ""
        if (last === "" || !last.includes(".")) return true // directory-style → flag
        return !norm.startsWith("plugins/sgc/bin/") // explicit non-bin plugins file → flag
      })
      if (files.length === 0) {
        emit({
          severity: "warn",
          msg: '  ⚠ package.json has no "files" allowlist — npm would publish the plugin payload',
        })
      } else if (leaks.length) {
        emit({
          severity: "fail",
          msg: `  ✗ package.json files includes vendored path(s): ${leaks.join(", ")}`,
        })
      } else {
        emit({
          severity: "ok",
          msg: "  ✓ package.json files excludes plugins/ (plugin payload not npm-published)",
        })
      }
    }
  }

  // ── (G) invariant-enforcement.yaml coverage ────────────────────────────
  log("")
  log("=== invariant-enforcement.yaml coverage ===")
  // iePath is also referenced by check (I); declare it here so both share scope.
  const iePath = resolve(root, "contracts/invariant-enforcement.yaml")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ invariant-enforcement.yaml skipped (no source checkout — dev/CI-only check)" })
  } else if (!existsSync(iePath)) {
    emit({
      severity: "warn",
      msg: "  ⚠ contracts/invariant-enforcement.yaml not found — invariant→test map unverified",
    })
  } else {
    let inv: Record<string, Record<string, unknown>> | null = {}
    try {
      const doc = yamlLoad(readFileSync(iePath, "utf8")) as { invariants?: unknown }
      inv =
        doc?.invariants && typeof doc.invariants === "object"
          ? (doc.invariants as Record<string, Record<string, unknown>>)
          : {}
    } catch (e) {
      emit({
        severity: "fail",
        msg: `  ✗ invariant-enforcement.yaml parse error: ${(e as Error).message.slice(0, 80)}`,
      })
      inv = null
    }
    if (inv) {
      const missingSections: string[] = []
      for (let n = 1; n <= 13; n++) if (inv[String(n)] == null) missingSections.push(`§${n}`)
      if (missingSections.length) {
        emit({
          severity: "fail",
          msg: `  ✗ invariant map missing: ${missingSections.join(", ")}`,
        })
      }
      let machineCount = 0
      for (let n = 1; n <= 13; n++) {
        const e = inv[String(n)]
        if (e == null) continue
        const title = typeof e["title"] === "string" ? (e["title"] as string).slice(0, 32) : ""
        if (e["machine_enforced"] === true) {
          machineCount++
          const tests = Array.isArray(e["tests"]) ? (e["tests"] as string[]) : []
          if (tests.length === 0) {
            emit({ severity: "fail", msg: `  ✗ §${n} machine_enforced but lists no tests` })
          } else {
            const missingTests = tests.filter((t) => !existsSync(resolve(root, t)))
            if (missingTests.length) {
              emit({
                severity: "fail",
                msg: `  ✗ §${n} cites missing test file(s): ${missingTests.join(", ")}`,
              })
            } else {
              emit({ severity: "ok", msg: `  ✓ §${n} ${title} (${tests.length} test file(s))` })
            }
          }
        } else {
          emit({ severity: "ok", msg: `  ✓ §${n} ${title} (procedural)` })
        }
      }
      emit({ severity: "ok", msg: `  · machine-enforced invariants: ${machineCount}/13` })
    }
  }

  // ── (H) slash commands ↔ CLI subcommands parity ───────────────────────
  // The CLI (src/sgc.ts subCommands) and the plugin slash layer
  // (plugins/sgc/commands/*.md) must agree. CLI-only automation tools that
  // are intentionally NOT exposed as interactive slash commands are exempt
  // (post-publish / CI tooling; audit 2026-06-01, user-confirmed scope A).
  // In an npm-install layout the plugins/ tree is absent → warn-skip.
  const SLASH_EXEMPT = new Set(["canary", "watch-ci-failure", "land"])
  log("")
  log("=== slash commands ↔ CLI subcommands ===")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ slash↔CLI parity skipped (no source checkout — dev/CI-only check)" })
  } else {
    const sgcSrcPath = resolve(root, "src/sgc.ts")
    const commandsDir = resolve(root, "plugins/sgc/commands")
    if (!existsSync(sgcSrcPath) || !existsSync(commandsDir)) {
      emit({
        severity: "warn",
        msg: "  ⚠ src/sgc.ts or plugins/sgc/commands/ not found — slash parity unchecked (npm-install layout?)",
      })
    } else {
      const cliNames = extractCliSubcommands(readFileSync(sgcSrcPath, "utf8"))
      const slashNames = new Set(
        readdirSync(commandsDir)
          .filter((f) => f.endsWith(".md"))
          .map((f) => f.slice(0, -3)),
      )
      if (cliNames.length === 0) {
        emit({ severity: "warn", msg: "  ⚠ could not parse subCommands block in src/sgc.ts" })
      }
      for (const name of cliNames) {
        if (slashNames.has(name)) {
          emit({ severity: "ok", msg: `  ✓ ${name} (CLI + slash command)` })
        } else if (SLASH_EXEMPT.has(name)) {
          emit({ severity: "ok", msg: `  ✓ ${name} (CLI-only, slash-exempt)` })
        } else {
          emit({
            severity: "fail",
            msg: `  ✗ ${name} (CLI subcommand has no slash command — add plugins/sgc/commands/${name}.md or add to SLASH_EXEMPT)`,
          })
        }
      }
      const cliSet = new Set(cliNames)
      for (const slash of [...slashNames].sort()) {
        if (!cliSet.has(slash)) {
          emit({
            severity: "warn",
            msg: `  ⚠ ${slash}.md (orphan slash command — no matching CLI subcommand)`,
          })
        }
      }
    }
  }

  // ── (I) invariant-source parity (sgc-invariants.md ↔ enforcement yaml) ──
  // Two files define the invariant set: the prose spec (sgc-invariants.md,
  // `## §N.` headings) and the enforcement map (invariant-enforcement.yaml).
  // They must define the SAME §-numbers, else the "N invariants" claim in the
  // docs drifts (audit 2026-06-01: README said 12, both contracts said 13).
  log("")
  log("=== invariant sources aligned (§ count) ===")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ invariant-source parity skipped (no source checkout — dev/CI-only check)" })
  } else {
    const invMdPath = resolve(root, "contracts/sgc-invariants.md")
    if (!existsSync(invMdPath) || !existsSync(iePath)) {
      emit({
        severity: "warn",
        msg: "  ⚠ sgc-invariants.md or invariant-enforcement.yaml missing — § parity unchecked",
      })
    } else {
      const mdNums = new Set<number>()
      const secRe = /^##\s*§(\d+)\./gm
      let sm: RegExpExecArray | null
      const mdText = readFileSync(invMdPath, "utf8")
      while ((sm = secRe.exec(mdText)) !== null) mdNums.add(Number(sm[1]))
      const yamlNums = new Set<number>()
      try {
        const doc = yamlLoad(readFileSync(iePath, "utf8")) as {
          invariants?: Record<string, unknown>
        }
        if (doc?.invariants) for (const k of Object.keys(doc.invariants)) yamlNums.add(Number(k))
      } catch {
        /* (G) already surfaced the parse error */
      }
      const onlyMd = [...mdNums].filter((n) => !yamlNums.has(n)).sort((a, b) => a - b)
      const onlyYaml = [...yamlNums].filter((n) => !mdNums.has(n)).sort((a, b) => a - b)
      if (mdNums.size > 0 && onlyMd.length === 0 && onlyYaml.length === 0) {
        emit({
          severity: "ok",
          msg: `  ✓ both sources define §1–§${Math.max(...mdNums)} (${mdNums.size} invariants)`,
        })
      } else {
        emit({
          severity: "fail",
          msg: `  ✗ invariant sources disagree — only in .md: [${onlyMd.join(",") || "—"}], only in .yaml: [${onlyYaml.join(",") || "—"}]`,
        })
      }
    }
  }

  // ── (J) bundle-hash parity (dev/CI only — skips in bundle context) ────────
  log("")
  log("=== bundle parity ===")
  emit(await bundleParityCheck(root))

  // ── (K) metrics baseline drift ──────────────────────────────────────────
  log("")
  log("=== metrics baseline drift ===")
  const baselinePath = resolve(root, "metrics", "metrics-baseline.yaml")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ metrics baseline skipped (no source checkout — dev/CI-only check)" })
  } else if (!existsSync(baselinePath)) {
    emit({ severity: "fail", msg: "  ✗ metrics/metrics-baseline.yaml missing — run `sgc metrics --write-baseline`" })
  } else {
    try {
      const live = computeMetricsLive(root)
      const baseline = parseBaseline(readFileSync(baselinePath, "utf8"))
      const drifts = diffMetrics(live, baseline)
      if (drifts.length === 0) {
        emit({ severity: "ok", msg: "  ✓ metrics baseline in sync (live == baseline; bundle_bytes excluded)" })
      } else {
        for (const d of drifts) emit({ severity: "fail", msg: `  ✗ metrics drift — ${d}` })
        emit({ severity: "fail", msg: "  ✗ regenerate: `sgc metrics --write-baseline`" })
      }
    } catch (e) {
      emit({ severity: "fail", msg: `  ✗ metrics baseline check error: ${(e as Error).message.slice(0, 80)}` })
    }
  }

  // ── (N) agent registry ↔ manifest honesty ───────────────────────────────
  log("")
  log("=== agent registry ↔ manifest ===")
  {
    // M4: readAgentMdFiles walks the filesystem, so a broken symlink or an
    // unreadable dir under agents/ threw statSync/readdirSync straight out of
    // runDoctor instead of producing the ✗ this catch exists for. It belongs
    // inside the try.
    try {
      const files = readAgentMdFiles(root)
      if (files.length === 0) {
        emit({ severity: "ok", msg: "  ⓘ agent registry check skipped (no plugins/sgc/agents/ — npm channel)" })
      } else {
        const drifts = agentMetadataDrift(
          files,
          (id) => getSubagentManifest(id) ?? null,
          Object.keys(getCapabilities().subagents),
        )
        if (drifts.length === 0) {
          // Deliberately not "descriptions are accurate" — see agentMetadataDrift's
          // docblock. This check enforces wiring and disclosure; only a human
          // reading the implementation can confirm the prose.
          emit({ severity: "ok", msg: `  ✓ ${files.length} agent descriptions wired to manifest (disclosure checked, not accuracy)` })
        } else {
          for (const d of drifts) emit({ severity: "fail", msg: `  ✗ agent metadata drift — ${d}` })
        }
      }
    } catch (e) {
      emit({ severity: "fail", msg: `  ✗ agent registry check error: ${(e as Error).message.slice(0, 80)}` })
    }
  }

  // ── (O) agent description ↔ derived CLI fact ────────────────────────────
  log("")
  log("=== agent description ↔ derived CLI fact ===")
  if (!hasSource) {
    // States what it tested. `hasSource` is `existsSync(root/src/sgc.ts)`, so
    // "no plugins/sgc/agents/" was a reason this branch never checked — true of
    // the npm tarball by luck, false of any checkout carrying the registry but no
    // src/. A check that misreports why it skipped is the defect check (O) exists
    // to catch, in check (O)'s own skip line. The agents/-absent case is the
    // files.length === 0 branch below, which did test what it claims.
    emit({ severity: "ok", msg: "  ⓘ CLI-fact derivation skipped (no src/sgc.ts — npm channel, no derivation to check against)" })
  } else {
    // Same failure mode check (N) above already learned the hard way: a broken
    // symlink or unreadable dir under agents/ makes readAgentMdFiles throw
    // straight out of runDoctor. It belongs inside the try.
    try {
      const files = readAgentMdFiles(root)
      if (files.length === 0) {
        // Mirrors check (N)'s own distinction directly above: no plugins/sgc/agents/
        // at all is "nothing to check" (npm channel, or a dev checkout that simply
        // doesn't carry this registry) — not "9 files missing". An incomplete-but-
        // present registry (some files, not all 9) is the real drift, handled below.
        emit({ severity: "ok", msg: "  ⓘ CLI-fact derivation skipped (no plugins/sgc/agents/ — npm channel)" })
      } else {
        const present = new Set(files.map((f) => f.id))
        const missingIds = DERIVED_AGENT_IDS.filter((id) => !present.has(id))
        for (const id of missingIds) {
          emit({
            severity: "fail",
            msg: `  ✗ ${id}: no plugins/sgc/agents/${id.replace(".", "/")}.md — a missing file cannot carry the derived clause`,
          })
        }
        const factDrifts = cliFactDrift(files)
        if (factDrifts.length === 0 && missingIds.length === 0) {
          // The count actually checked, not the constant DERIVED_AGENT_IDS.length —
          // a hardcoded count here would claim 9 verified while having seen fewer.
          const checked = files.filter((f) => DERIVED_AGENT_IDS.includes(f.id)).length
          emit({ severity: "ok", msg: `  ✓ ${checked} agent CLI-fact clauses match the code` })
        } else {
          for (const d of factDrifts) emit({ severity: "fail", msg: `  ✗ ${d}` })
        }
      }
    } catch (e) {
      emit({ severity: "fail", msg: `  ✗ CLI-fact check error: ${(e as Error).message.slice(0, 80)}` })
    }
  }

  // ── (M) README four-化 scorecard ↔ live metrics parity ──────────────────
  log("")
  log("=== README four-化 scorecard parity ===")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ README scorecard parity skipped (no source checkout — dev/CI-only check)" })
  } else {
    const readmePath = resolve(root, "README.md")
    if (!existsSync(readmePath)) {
      emit({ severity: "warn", msg: "  ⚠ README.md not found" })
    } else {
      try {
        const drifts = readmeScorecardDrift(readFileSync(readmePath, "utf8"), computeMetricsLive(root))
        if (drifts.length === 0) {
          emit({ severity: "ok", msg: "  ✓ README scorecard matches live metrics" })
        } else {
          for (const d of drifts) emit({ severity: "fail", msg: `  ✗ README scorecard drift — ${d}` })
          emit({ severity: "fail", msg: "  ✗ fix README.md to match `sgc metrics` output" })
        }
      } catch (e) {
        emit({ severity: "fail", msg: `  ✗ README scorecard check error: ${(e as Error).message.slice(0, 80)}` })
      }
    }
  }

  // ── (L) plugins/sgc/CLAUDE.md status header not behind package.json ──────
  log("")
  log("=== plugins/sgc/CLAUDE.md status header freshness ===")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ CLAUDE.md freshness skipped (no source checkout — dev/CI-only check)" })
  } else {
    const claudeMdPath = resolve(root, "plugins", "sgc", "CLAUDE.md")
    const pkgPath = resolve(root, "package.json")
    if (!existsSync(claudeMdPath) || !existsSync(pkgPath)) {
      emit({ severity: "warn", msg: "  ⚠ plugins/sgc/CLAUDE.md or package.json not found" })
    } else {
      try {
        const pkgVer = (JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string }).version ?? ""
        const r = statusHeaderFreshness(readFileSync(claudeMdPath, "utf8"), pkgVer)
        emit({ severity: r.severity, msg: `  ${r.severity === "ok" ? "✓" : "⚠"} ${r.msg}` })
      } catch (e) {
        emit({ severity: "warn", msg: `  ⚠ CLAUDE.md freshness check error: ${(e as Error).message.slice(0, 80)}` })
      }
    }
  }

  const ok = rows.filter((r) => r.severity === "ok").length
  const warn = rows.filter((r) => r.severity === "warn").length
  const fail = rows.filter((r) => r.severity === "fail").length

  log("")
  log(`=== Summary ===`)
  log(`${ok} OK · ${warn} warn · ${fail} fail`)

  return { ok, warn, fail, rows }
}
