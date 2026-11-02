// v2.0.1: a manifest output key the prompt presents as optional gets dropped.
//
// researcher.history's manifest requires `warnings: array[string]`, but its
// prompt showed `warnings:` followed by `- <optional string per warning>`. On
// the default model (anthropic/claude-opus-4.7) the reply then omitted the key
// whenever there was nothing to warn about: all 4 researcher.history
// failures on that model measured on 2026-11-01 (4 of 18 calls) were
// `OutputShapeMismatch ... missing required fields: warnings`. spawn() validates the shape before the agent's
// coerce step, so `sgc plan` fell back to an empty prior_art.
//
// Every top-level manifest output key must appear in the prompt's reply
// format (a YAML `key:` line or a JSON `"key":`), and the key's own line and
// the line after it must not call it optional.

import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getCapabilities } from "../../src/dispatcher/schema"

const REPO = resolve(import.meta.dir, "..", "..")

const agents = Object.entries(getCapabilities().subagents).filter(
  ([, m]) => m.prompt_path && m.outputs && existsSync(resolve(REPO, m.prompt_path)),
)

test("there are prompted agents with declared outputs to check", () => {
  expect(agents.length).toBeGreaterThan(5)
})

for (const [name, m] of agents) {
  test(`${name}: every required output key is in the reply format and not marked optional`, () => {
    const lines = readFileSync(resolve(REPO, m.prompt_path!), "utf8").split("\n")
    for (const key of Object.keys(m.outputs as object)) {
      const yaml = lines.findIndex((l) => l.startsWith(`${key}:`))
      const json = lines.findIndex((l) => l.includes(`"${key}":`))
      expect({ key, present: yaml !== -1 || json !== -1 }).toEqual({ key, present: true })
      if (yaml !== -1) {
        const near = lines.slice(yaml, yaml + 2).join("\n")
        expect({ key, near, optional: /optional/i.test(near) }).toEqual({ key, near, optional: false })
      }
    }
  })
}
