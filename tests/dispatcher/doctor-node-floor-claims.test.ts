// v2.0.1: the Node floor stated in user-facing docs must match
// package.json engines.node.
//
// v2.0.0 raised engines.node to >=22.19.0 and synced the README, badges and
// manifest descriptions by hand. Nothing checked them, and two current docs
// (plugins/sgc/CLAUDE.md:7, docs/POSITIONING.md:5) still said "Node ≥ 18"
// until the pre-tag review caught it. Same move as the README scorecard
// (check M): prose that restates a machine fact gets a machine gate.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { NODE_FLOOR_CLAIM_FILES, nodeFloorClaimDrift } from "../../src/commands/doctor"

const REPO = resolve(import.meta.dir, "..", "..")
const ENGINES = ">=22.19.0"

describe("nodeFloorClaimDrift", () => {
  test("claims equal to the floor, in every written form, report no drift", () => {
    const text = [
      "[![x](https://img.shields.io/badge/runtime-node%20%E2%89%A522.19-339933)]",
      "runs on any machine (Node ≥ 22.19). Requires Node >= 22.19.0.",
      "高效化 1 step·node≥22.19.0.",
    ].join("\n")
    expect(nodeFloorClaimDrift([{ path: "README.md", text }], ENGINES)).toEqual([])
  })

  test("a stale floor is reported with file, line and the floor", () => {
    const text = "intro\nruns standalone (Node ≥ 18, no bun)\n"
    expect(nodeFloorClaimDrift([{ path: "plugins/sgc/CLAUDE.md", text }], ENGINES)).toEqual([
      'plugins/sgc/CLAUDE.md:2 says "Node ≥ 18", engines.node is >=22.19.0',
    ])
  })

  test("other wordings of a floor are read too: Node.js, bold, %3E%3D badges, N+", () => {
    const text = [
      "requires Node.js ≥ 18.17",
      "runs on **Node** ≥ 18.17",
      "![b](https://img.shields.io/badge/node-%3E%3D18.17-green)",
      "works on Node 18.17+",
    ].join("\n")
    expect(nodeFloorClaimDrift([{ path: "a.md", text }], ENGINES)).toHaveLength(4)
    const ok = text.replaceAll("18.17", "22.19")
    expect(nodeFloorClaimDrift([{ path: "a.md", text: ok }], ENGINES)).toEqual([])
  })

  test("a claim less precise than major.minor is reported (Node ≥ 22 admits 22.0)", () => {
    expect(nodeFloorClaimDrift([{ path: "a.md", text: "Node >= 22" }], ENGINES)).toHaveLength(1)
  })

  test("a wrong patch is reported", () => {
    expect(nodeFloorClaimDrift([{ path: "a.md", text: "node≥22.19.1" }], ENGINES)).toHaveLength(1)
  })

  test("the history after ' · prior:' in the Implementation Status line is not a current claim", () => {
    const text =
      "## Implementation Status (v2.0.0 — requires Node >=22.19.0 · prior: v1.38.4 — Node ≥ 18.17 synced across README)"
    expect(nodeFloorClaimDrift([{ path: "plugins/sgc/CLAUDE.md", text }], ENGINES)).toEqual([])
  })

  test("the current part of the Implementation Status line is still checked", () => {
    const text = "## Implementation Status (v2.0.0 — requires Node >=18.17 · prior: v1.38.4 — x)"
    expect(nodeFloorClaimDrift([{ path: "plugins/sgc/CLAUDE.md", text }], ENGINES)).toHaveLength(1)
  })

  test("an engines range that is not >=X.Y.Z is reported, not guessed", () => {
    expect(nodeFloorClaimDrift([{ path: "a.md", text: "Node ≥ 22.19" }], "^22.19.0")).toEqual([
      'engines.node "^22.19.0" is not a >=X.Y.Z range; cannot check Node floor claims',
    ])
  })
})

test("the repo's user-facing docs state the current engines.node floor", () => {
  const engines = (JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8")) as {
    engines: { node: string }
  }).engines.node
  const files = NODE_FLOOR_CLAIM_FILES.map((path) => ({
    path,
    text: readFileSync(resolve(REPO, path), "utf8"),
  }))
  expect(nodeFloorClaimDrift(files, engines)).toEqual([])
})
