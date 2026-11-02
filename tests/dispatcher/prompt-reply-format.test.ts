// v2.0.1: a manifest output key the prompt presents as optional gets dropped.
//
// researcher.history's manifest requires `warnings: array[string]`, but its
// prompt showed `warnings:` followed by `- <optional string per warning>`. On
// the default model (anthropic/claude-opus-4.7) the reply then omitted the key
// whenever there was nothing to warn about: all 4 researcher.history
// failures on that model measured on 2026-11-01 (4 of 18 calls) were
// `OutputShapeMismatch ... missing required fields: warnings`. spawn() validates the shape before the agent's
// coerce step, so `sgc plan` fell back to an empty prior_art. Telling the
// model to always include both keys took it to 0 of 30.
//
// So every prompt's "## Reply format" (or "## Output …") section must:
// 1. show every top-level manifest output key in its first code block, as a
//    YAML `key:` line or a JSON `"key":`;
// 2. say, in a prose sentence starting "Always include", every one of those
//    keys in backticks. This is the guarantee: a positive instruction, which
//    no rewording elsewhere can slip past the way it slips past a list of
//    banned words;
// 3. not contradict that anywhere in the section. A list of conditional
//    words cannot be complete, so this part only catches the usual
//    phrasings: on the key's own line, the comment lines just above it, and
//    the lines below it up to the first non-comment line; and in any prose
//    sentence that names the key (backticks, bold, quotes or a bare word),
//    with soft-wrapped lines joined and "e.g." not ending a sentence.

import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getCapabilities } from "../../src/dispatcher/schema"

const CONDITIONAL_RE = new RegExp(
  [
    "optional",
    "not (?:required|needed|necessary|mandatory)",
    "omit(?:s|ted|ting)?",
    "leav(?:e|ing) (?:\\S+ )?out",
    "left out",
    "drop(?:s|ped|ping)?",
    "skip(?:s|ped|ping)?",
    "exclud(?:e|es|ed|ing)",
    "unless",
    "if (?:there (?:are|is) )?any",
    "if (?:needed|applicable|present|relevant)",
    "when (?:present|applicable|relevant|needed)",
    "\\bonly\\b",
    "just for",
    "(?:may|can|could|might) be (?:absent|missing|empty or absent)",
  ].join("|"),
  "i",
)

const REPO = resolve(import.meta.dir, "..", "..")

const agents = Object.entries(getCapabilities().subagents).filter(
  ([, m]) => m.prompt_path && m.outputs && existsSync(resolve(REPO, m.prompt_path)),
)

test("there are prompted agents with declared outputs to check", () => {
  expect(agents.length).toBeGreaterThan(5)
})

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const isComment = (l: string) => /^\s*(?:#|\/\/)/.test(l)
const indent = (l: string) => /^\s*/.exec(l)![0].length

/** Prose sentences: paragraphs joined across soft wraps, split at . ! ? but
 *  not after e.g. / i.e. / etc. / vs. */
function sentences(prose: string): string[] {
  return prose
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " "))
    .flatMap((p) => p.split(/(?<!\b(?:e\.g|i\.e|etc|vs|cf))[.!?](?=\s|$)/))
    .map((s) => s.trim())
    .filter((s) => s !== "")
}

for (const [name, m] of agents) {
  test(`${name}: every required output key is in the reply format, always included, never called optional`, () => {
    const lines = readFileSync(resolve(REPO, m.prompt_path!), "utf8").split("\n")
    const head = lines.findIndex((l) => /^## (Reply format|Output)\b/.test(l))
    expect({ name, replySection: head !== -1 }).toEqual({ name, replySection: true })
    const nextHeading = lines.findIndex((l, i) => i > head && l.startsWith("## "))
    const section = lines.slice(head + 1, nextHeading === -1 ? undefined : nextHeading)
    const open = section.findIndex((l) => l.startsWith("```"))
    const close = section.findIndex((l, i) => i > open && l.startsWith("```"))
    const block = section.slice(open + 1, close)
    let inFence = false
    const prose = section
      .filter((l) => {
        if (l.startsWith("```")) {
          inFence = !inFence
          return false
        }
        return !inFence
      })
      .join("\n")
    const proseSentences = sentences(prose)
    const keys = Object.keys(m.outputs as object)

    // 2. the positive instruction
    const always = proseSentences.find((s) => /^Always include\b/i.test(s)) ?? ""
    const named = new Set([...always.matchAll(/`([\w-]+)`/g)].map((x) => x[1]!))
    expect({ always: always !== "", missing: keys.filter((k) => !named.has(k)) }).toEqual({ always: true, missing: [] })

    for (const key of keys) {
      // 1. shown in the reply block
      const at = block.findIndex((l) => l.startsWith(`${key}:`) || new RegExp(`^\\s*"${escape(key)}":`).test(l))
      expect({ key, inReplyBlock: at !== -1 }).toEqual({ key, inReplyBlock: true })

      // 3a. the key's own lines in the block
      const own = [block[at]!]
      for (let i = at - 1; i >= 0 && isComment(block[i]!) && indent(block[i]!) === indent(block[at]!); i--) own.unshift(block[i]!)
      for (let i = at + 1; i < block.length; i++) {
        own.push(block[i]!)
        if (!isComment(block[i]!)) break
      }
      const near = own.join("\n")
      expect({ key, near, conditional: CONDITIONAL_RE.exec(near)?.[0] ?? null }).toEqual({ key, near, conditional: null })

      // 3b. prose that names the key
      const mention = new RegExp(`(?<![\\w-])${escape(key)}(?![\\w-])`)
      const contradicting = proseSentences.filter((s) => s !== always && mention.test(s) && CONDITIONAL_RE.test(s))
      expect({ key, contradicting }).toEqual({ key, contradicting: [] })
    }
  })
}
