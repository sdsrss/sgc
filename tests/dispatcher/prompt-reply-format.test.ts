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
// Every top-level manifest output key must appear in the first code block of
// the prompt's "## Reply format" (or "## Output …") section, as a YAML `key:`
// line or a JSON `"key":`. Other examples further down do not count. The
// key's own line and the line after it must not call it optional or
// conditional.

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
    const head = lines.findIndex((l) => /^## (Reply format|Output)\b/.test(l))
    expect({ name, replySection: head !== -1 }).toEqual({ name, replySection: true })
    const open = lines.findIndex((l, i) => i > head && l.startsWith("```"))
    const close = lines.findIndex((l, i) => i > open && l.startsWith("```"))
    const block = lines.slice(open + 1, close)
    for (const key of Object.keys(m.outputs as object)) {
      const yaml = block.findIndex((l) => l.startsWith(`${key}:`))
      const json = block.findIndex((l) => l.includes(`"${key}":`))
      expect({ key, inReplyBlock: yaml !== -1 || json !== -1 }).toEqual({ key, inReplyBlock: true })
      if (yaml !== -1) {
        const near = block.slice(yaml, yaml + 2).join("\n")
        expect({ key, near, optional: /optional|if any|omit/i.test(near) }).toEqual({ key, near, optional: false })
      }
    }
  })
}
