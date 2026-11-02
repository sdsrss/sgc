// v2.0.1: once the plugin loaded again (hooks.json fix), its command and skill
// text went live, and parts of it could not work in a user's project.
//
// - Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` (braced) in skill, command
//   and agent content, and does NOT export CLAUDE_PLUGIN_ROOT to commands the
//   Bash tool runs (plugins reference, "Where each variable resolves"). All 17
//   commands tested `[ -f "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" ]` unbraced, which
//   is empty in the Bash tool, so they never found the bundled CLI.
// - Eight skills ran `bun src/sgc.ts <cmd>`, which exists only inside an sgc
//   source checkout with bun installed.
// - The bootstrap (injected at session start) routed users to bare `/plan` and
//   `/status`, which are Claude Code built-ins; plugin commands are /sgc:<name>.
//   It also pointed at repo paths a user's project does not have.

import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const PLUGIN = resolve(import.meta.dir, "..", "..", "plugins", "sgc")

function mdFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...mdFiles(p))
    else if (e.name.endsWith(".md")) out.push(p)
  }
  return out
}

const contentFiles = ["commands", "skills", "agents"].flatMap((d) => mdFiles(join(PLUGIN, d)))

test("there is plugin content to check", () => {
  expect(contentFiles.length).toBeGreaterThan(30)
})

describe("plugin content reaches the bundled CLI", () => {
  for (const f of contentFiles) {
    const rel = f.slice(PLUGIN.length + 1)
    const text = readFileSync(f, "utf8")

    test(`${rel}: CLAUDE_PLUGIN_ROOT only in the braced form Claude Code substitutes`, () => {
      expect(text.match(/\$CLAUDE_PLUGIN_ROOT\b/g) ?? []).toEqual([])
    })

    if (/^\s*bun src\/sgc\.ts /m.test(text)) {
      test(`${rel}: running sgc from source is only the fallback after the bundled CLI`, () => {
        expect(text).toContain('[ -f "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" ]')
        expect(text).not.toMatch(/^bun src\/sgc\.ts /m)
      })
    }
  }
})

describe("bootstrap (injected into sessions)", () => {
  const boot = readFileSync(join(PLUGIN, "skills", "bootstrap", "SKILL.md"), "utf8")

  test("every slash command it names is a /sgc: plugin command", () => {
    const slash = [...boot.matchAll(/`(\/[a-z][\w-]*(?::[\w*-]+)?)/g)].map((m) => m[1]!)
    expect(slash.length).toBeGreaterThan(0)
    expect(slash.filter((s) => !s.startsWith("/sgc:"))).toEqual([])
  })

  test("it points at no repo path a user's project does not have", () => {
    expect(boot).not.toMatch(/plugins\/sgc\/CLAUDE\.md|src\/dispatcher|\.\.\/\.\.\//)
  })
})
