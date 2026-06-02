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

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { load as yamlLoad } from "js-yaml"
import { getCapabilities } from "../dispatcher/schema"
import { EMBEDDED_PROMPTS, listEmbeddedPromptKeys } from "../dispatcher/embedded-data"

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

export interface DoctorOptions {
  log?: (msg: string) => void
  /** Override repo root for tests (default: derived from import.meta). */
  repoRoot?: string
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

  // ── (D) bunfig.toml [test] root="tests" — guards R0 regression ─────────
  // A bare `bun test` must stay scoped to sgc's gate; otherwise the vendored
  // plugins/sgc/browse/ upstream suite gets swept and reports false failures.
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
        msg: '  ✗ bunfig.toml present but [test] root!="tests" — bare `bun test` may sweep plugins/sgc/browse (R0 regression)',
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
      // Flag directory-level entries (e.g. "plugins/" or "plugins") that would
      // publish the entire vendored browse tree. Specific committed file paths
      // (e.g. "plugins/sgc/bin/sgc.mjs") are intentional artifacts — not leaks.
      const leaks = files.filter((f) => {
        const norm = f.replace(/^\.?\//, "")
        if (!norm.startsWith("plugins")) return false
        // Allow explicit file paths: must contain a dot in the last path segment
        const last = norm.split("/").at(-1) ?? ""
        return last === "" || !last.includes(".")
      })
      if (files.length === 0) {
        emit({
          severity: "warn",
          msg: '  ⚠ package.json has no "files" allowlist — npm would publish vendored browse',
        })
      } else if (leaks.length) {
        emit({
          severity: "fail",
          msg: `  ✗ package.json files includes vendored path(s): ${leaks.join(", ")}`,
        })
      } else {
        emit({
          severity: "ok",
          msg: "  ✓ package.json files excludes plugins/ (vendored browse not npm-published)",
        })
      }
    }
  }

  // ── (F) vendored-components.yaml provenance ────────────────────────────
  log("")
  log("=== vendored-components.yaml provenance ===")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ vendored-components.yaml skipped (no source checkout — dev/CI-only check)" })
  } else {
    const vcPath = resolve(root, "contracts/vendored-components.yaml")
    if (!existsSync(vcPath)) {
      emit({
        severity: "warn",
        msg: "  ⚠ contracts/vendored-components.yaml not found — vendored source unregistered (R0/Rec4)",
      })
    } else {
      let comps: Record<string, unknown>[] | null = []
      try {
        const doc = yamlLoad(readFileSync(vcPath, "utf8")) as { components?: unknown }
        comps = Array.isArray(doc?.components)
          ? (doc.components as Record<string, unknown>[])
          : []
      } catch (e) {
        emit({
          severity: "fail",
          msg: `  ✗ vendored-components.yaml parse error: ${(e as Error).message.slice(0, 80)}`,
        })
        comps = null
      }
      if (comps && comps.length === 0) {
        emit({ severity: "warn", msg: "  ⚠ vendored-components.yaml lists no components" })
      } else if (comps) {
        const required = ["path", "upstream", "upstream_ref", "vendored_at"]
        for (const c of comps) {
          const missing = required.filter(
            (k) => c[k] == null || String(c[k]).trim() === "",
          )
          const cpath = (c["path"] as string) ?? "<no path>"
          if (missing.length) {
            emit({
              severity: "fail",
              msg: `  ✗ vendored ${cpath}: missing field(s) ${missing.join(", ")}`,
            })
          } else if (!existsSync(resolve(root, cpath))) {
            emit({
              severity: "fail",
              msg: `  ✗ vendored ${cpath}: registered path missing on disk`,
            })
          } else {
            emit({
              severity: "ok",
              msg: `  ✓ vendored ${cpath} (upstream_ref: ${String(c["upstream_ref"])})`,
            })
          }
        }
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

  const ok = rows.filter((r) => r.severity === "ok").length
  const warn = rows.filter((r) => r.severity === "warn").length
  const fail = rows.filter((r) => r.severity === "fail").length

  log("")
  log(`=== Summary ===`)
  log(`${ok} OK · ${warn} warn · ${fail} fail`)

  return { ok, warn, fail, rows }
}
