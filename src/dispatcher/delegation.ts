// Plugin delegation detection — P1.6 audit follow-up.
//
// Reads ~/.claude/plugins/installed_plugins.json (the Claude Code authoritative
// inventory) and exposes a typed presence map for sgc decision points.
// Surfaces `(hint)` recommendations — NEVER enforces. Output is a one-line
// log message; the user decides whether to take the delegated path.
//
// Plugin set is deliberately narrow: only plugins whose capabilities sgc has
// observed complementary value from (per docs/POSITIONING.md + the user's
// ~/.claude/MEMORY.md plugin contracts). Adding to the set requires a
// corresponding usage point in delegationHintsFor() — never a presence
// check without a hint.
//
// Source-of-truth precedence (per Phase H lesson — verify, don't assume):
//   1. Explicit override: SGC_PLUGIN_REGISTRY env (test hook + advanced use)
//   2. ~/.claude/plugins/installed_plugins.json (file format v2)
//   3. Empty set (degrades gracefully — sgc behavior unchanged)

import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"

export interface InstalledPluginSet {
  /** `superpowers@claude-plugins-official` — TDD / debugging / parallel-agent contracts. */
  superpowers: boolean
  /** `code-graph-mcp@code-graph-mcp` — AST / call-graph / impact-analysis. */
  codeGraphMcp: boolean
  /** `claude-mem-lite@sdsrss` — bugfix-lesson recall layer. */
  claudeMemLite: boolean
  /** `frontend-design@claude-plugins-official` — UI design + iteration skills. */
  frontendDesign: boolean
}

export const EMPTY_PLUGIN_SET: InstalledPluginSet = Object.freeze({
  superpowers: false,
  codeGraphMcp: false,
  claudeMemLite: false,
  frontendDesign: false,
})

/**
 * Pure parser exposed for unit tests. Tolerates malformed JSON / missing
 * `plugins` field by returning EMPTY_PLUGIN_SET — never throws.
 *
 * Plugin key format observed in v2: `<plugin>@<marketplace>` (one entry per
 * plugin, even though the value is an array of installs across scopes).
 */
export function parsePluginSet(installedJson: string): InstalledPluginSet {
  try {
    const data = JSON.parse(installedJson) as { plugins?: Record<string, unknown> }
    const keys = Object.keys(data.plugins ?? {})
    const has = (q: string): boolean => keys.some((k) => k === q || k.startsWith(`${q}@`))
    return {
      superpowers: has("superpowers"),
      codeGraphMcp: has("code-graph-mcp"),
      claudeMemLite: has("claude-mem-lite"),
      frontendDesign: has("frontend-design"),
    }
  } catch {
    return { ...EMPTY_PLUGIN_SET }
  }
}

let cached: InstalledPluginSet | null = null

/**
 * Read the registry once per process. Cached so we don't re-stat the
 * registry inside hot dispatch loops (researcher.history + planner cluster
 * all fire delegation hints).
 */
export function detectInstalledPlugins(): InstalledPluginSet {
  if (cached) return cached
  const path =
    process.env["SGC_PLUGIN_REGISTRY"] ??
    resolve(homedir(), ".claude/plugins/installed_plugins.json")
  if (!existsSync(path)) {
    cached = { ...EMPTY_PLUGIN_SET }
    return cached
  }
  try {
    cached = parsePluginSet(readFileSync(path, "utf8"))
  } catch {
    cached = { ...EMPTY_PLUGIN_SET }
  }
  return cached
}

/** Test-only: clear cache between cases. */
export function resetPluginDetectionCache(): void {
  cached = null
}

export interface DelegationHint {
  /** sgc agent / decision point where the hint fires. */
  agent: string
  /** Slash-command or skill the user might prefer. */
  recommended: string
  /** One-line reason — what the recommended path adds beyond sgc's inline path. */
  reason: string
}

export type DelegationContext =
  | "plan.adversarial"
  | "plan.researcher"
  | "review.cluster"
  | "ship.pr"

/**
 * Return zero or more delegation hints for a given sgc decision point.
 *
 * Contract: each hint MUST cite a plugin we actually checked for presence;
 * `plugins` defaults to `detectInstalledPlugins()` for runtime use but tests
 * pass an explicit set for determinism.
 */
export function delegationHintsFor(
  context: DelegationContext,
  plugins: InstalledPluginSet = detectInstalledPlugins(),
): DelegationHint[] {
  const hints: DelegationHint[] = []
  switch (context) {
    case "plan.adversarial":
      if (plugins.superpowers) {
        hints.push({
          agent: "planner.adversarial",
          recommended: "/superpowers:dispatching-parallel-agents",
          reason:
            "sgc runs the L3 pre-mortem fan-out natively; sp's parallel-agent contract is an optional richer orchestration if you've installed it",
        })
      }
      break
    case "plan.researcher":
      if (plugins.codeGraphMcp) {
        hints.push({
          agent: "researcher.history",
          recommended: "/code-graph-mcp:impact-analysis on touched symbols",
          reason:
            "code-graph's blast-radius narrows researcher's candidate space before the LLM rerank",
        })
      }
      if (plugins.claudeMemLite) {
        hints.push({
          agent: "researcher.history",
          recommended: "mem_recall(file=<touched-file>)",
          reason:
            "claude-mem-lite's bugfix-lesson layer is orthogonal to .sgc/solutions/ — complementary signal at the dispatch boundary",
        })
      }
      break
    case "review.cluster":
      if (plugins.superpowers) {
        hints.push({
          agent: "reviewer.correctness",
          recommended: "/superpowers:requesting-code-review",
          reason:
            "sgc Invariant §1 already enforces author/reviewer context separation natively; sp's review contract is an optional richer path if installed",
        })
      }
      if (plugins.codeGraphMcp) {
        hints.push({
          agent: "reviewer.correctness",
          recommended: "/code-graph-mcp:impact-analysis on changed symbols",
          reason:
            "for L2+ multi-file changes, surface the call graph before reviewer.correctness focuses on local logic",
        })
      }
      break
    case "ship.pr":
      // Reserved for future: PR-template / land-and-deploy plugin detection.
      break
  }
  return hints
}

export function formatHint(hint: DelegationHint): string {
  return `(hint) ${hint.agent}: consider ${hint.recommended} — ${hint.reason}`
}
