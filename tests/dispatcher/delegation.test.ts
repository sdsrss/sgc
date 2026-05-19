// Unit tests for delegation detection (P1.6). Pure parser + hint-selection
// tests — runtime FS path is exercised indirectly via SGC_PLUGIN_REGISTRY
// env override (no integration with the real ~/.claude/plugins/).

import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  EMPTY_PLUGIN_SET,
  delegationHintsFor,
  detectInstalledPlugins,
  formatHint,
  parsePluginSet,
  resetPluginDetectionCache,
} from "../../src/dispatcher/delegation"

afterEach(() => {
  resetPluginDetectionCache()
  delete process.env["SGC_PLUGIN_REGISTRY"]
})

describe("parsePluginSet", () => {
  test("matches superpowers@claude-plugins-official → superpowers=true", () => {
    const json = JSON.stringify({
      version: 2,
      plugins: {
        "superpowers@claude-plugins-official": [
          { scope: "user", installPath: "/x", version: "5.1.0" },
        ],
      },
    })
    const set = parsePluginSet(json)
    expect(set.superpowers).toBe(true)
    expect(set.codeGraphMcp).toBe(false)
  })

  test("matches all 4 supported plugin slugs", () => {
    const json = JSON.stringify({
      plugins: {
        "superpowers@claude-plugins-official": [],
        "code-graph-mcp@code-graph-mcp": [],
        "claude-mem-lite@sdsrss": [],
        "frontend-design@claude-plugins-official": [],
      },
    })
    const set = parsePluginSet(json)
    expect(set).toEqual({
      superpowers: true,
      codeGraphMcp: true,
      claudeMemLite: true,
      frontendDesign: true,
    })
  })

  test("missing plugins field returns empty set, never throws", () => {
    expect(parsePluginSet("{}")).toEqual({ ...EMPTY_PLUGIN_SET })
  })

  test("malformed JSON returns empty set, never throws", () => {
    expect(parsePluginSet("not json")).toEqual({ ...EMPTY_PLUGIN_SET })
  })

  test("bare key (no @marketplace) still matches", () => {
    const json = JSON.stringify({ plugins: { superpowers: [] } })
    expect(parsePluginSet(json).superpowers).toBe(true)
  })

  test("partial-name false-positive guard (e.g. `superpowers-x` does NOT match)", () => {
    const json = JSON.stringify({
      plugins: { "superpowers-clone@somemarketplace": [] },
    })
    // `has("superpowers")` should NOT match "superpowers-clone" — only exact
    // name or `<name>@<marketplace>` form. Verifies the startsWith(`${q}@`)
    // boundary in parsePluginSet.
    expect(parsePluginSet(json).superpowers).toBe(false)
  })
})

describe("detectInstalledPlugins", () => {
  test("SGC_PLUGIN_REGISTRY env override is honored", () => {
    const tmp = mkdtempSync(join(tmpdir(), "sgc-delegation-"))
    const path = join(tmp, "registry.json")
    writeFileSync(
      path,
      JSON.stringify({
        plugins: { "code-graph-mcp@code-graph-mcp": [] },
      }),
    )
    process.env["SGC_PLUGIN_REGISTRY"] = path
    resetPluginDetectionCache()

    const set = detectInstalledPlugins()
    expect(set.codeGraphMcp).toBe(true)
    expect(set.superpowers).toBe(false)

    rmSync(tmp, { recursive: true, force: true })
  })

  test("missing registry file returns empty set", () => {
    process.env["SGC_PLUGIN_REGISTRY"] = "/nonexistent/path/to/registry.json"
    resetPluginDetectionCache()

    expect(detectInstalledPlugins()).toEqual({ ...EMPTY_PLUGIN_SET })
  })

  test("cache is process-local — second call same result, no re-stat", () => {
    const tmp = mkdtempSync(join(tmpdir(), "sgc-delegation-"))
    const path = join(tmp, "registry.json")
    writeFileSync(path, JSON.stringify({ plugins: { "superpowers@x": [] } }))
    process.env["SGC_PLUGIN_REGISTRY"] = path
    resetPluginDetectionCache()

    const a = detectInstalledPlugins()
    // Mutate the file — cached value should NOT change until resetCache.
    writeFileSync(path, JSON.stringify({ plugins: {} }))
    const b = detectInstalledPlugins()
    expect(a).toEqual(b)
    expect(a.superpowers).toBe(true)

    rmSync(tmp, { recursive: true, force: true })
  })
})

describe("delegationHintsFor", () => {
  test("plan.adversarial + superpowers → 1 sp hint", () => {
    const hints = delegationHintsFor("plan.adversarial", {
      ...EMPTY_PLUGIN_SET,
      superpowers: true,
    })
    expect(hints).toHaveLength(1)
    expect(hints[0]!.recommended).toContain("dispatching-parallel-agents")
    expect(hints[0]!.agent).toBe("planner.adversarial")
  })

  test("plan.researcher with both code-graph + mem-lite → 2 hints", () => {
    const hints = delegationHintsFor("plan.researcher", {
      ...EMPTY_PLUGIN_SET,
      codeGraphMcp: true,
      claudeMemLite: true,
    })
    expect(hints).toHaveLength(2)
    expect(hints.some((h) => h.recommended.includes("impact-analysis"))).toBe(true)
    expect(hints.some((h) => h.recommended.includes("mem_recall"))).toBe(true)
  })

  test("review.cluster + sp + code-graph → 2 hints (sp first, code-graph second)", () => {
    const hints = delegationHintsFor("review.cluster", {
      ...EMPTY_PLUGIN_SET,
      superpowers: true,
      codeGraphMcp: true,
    })
    expect(hints).toHaveLength(2)
    expect(hints[0]!.recommended).toContain("requesting-code-review")
    expect(hints[1]!.recommended).toContain("impact-analysis")
  })

  test("ship.pr context returns no hints (reserved for future)", () => {
    const hints = delegationHintsFor("ship.pr", {
      superpowers: true,
      codeGraphMcp: true,
      claudeMemLite: true,
      frontendDesign: true,
    })
    expect(hints).toHaveLength(0)
  })

  test("empty plugin set → empty hints across all contexts", () => {
    const contexts = [
      "plan.adversarial",
      "plan.researcher",
      "review.cluster",
      "ship.pr",
    ] as const
    for (const ctx of contexts) {
      expect(delegationHintsFor(ctx, EMPTY_PLUGIN_SET)).toHaveLength(0)
    }
  })
})

describe("formatHint", () => {
  test("renders one-line `(hint) agent: ... — reason` shape", () => {
    const formatted = formatHint({
      agent: "researcher.history",
      recommended: "/code-graph-mcp:impact-analysis",
      reason: "narrows candidate space",
    })
    expect(formatted).toBe(
      "(hint) researcher.history: consider /code-graph-mcp:impact-analysis — narrows candidate space",
    )
  })
})
