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

import { afterAll, describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

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

    test(`${rel}: no repo-relative link or author-machine reference (absent in a plugin install)`, () => {
      expect(text.match(/\]\(\.\.\/[^)]*\)/g) ?? []).toEqual([])
      expect(text).not.toMatch(/~\/\.claude\/CLAUDE\.md|CLAUDE-extended\.md|~\/\.ssh\/|On this machine/)
      // the author's shorthand for other plugins: the superpowers plugin's
      // skills are superpowers:<name>, and gstack's are /<name>
      expect(text.match(/(?<![\w-])(?:sp|gs):[\w/]/g) ?? []).toEqual([])
      expect(text).not.toContain("tasks/lessons.md")
      expect(text).not.toMatch(/`bun src\/sgc\.ts [a-z]+`/)
      // `sgc qa` without a target fails and uses up the task's append-only qa report
      expect(text).not.toMatch(/sgc qa --browse/)
    })

    // A user's project has no src/, contracts/ … of sgc's: link to GitHub.
    // Frontmatter is left out: descriptions are LLM-visible metadata that
    // doctor check (O) derives from code.
    test(`${rel}: no bare path into the sgc repository`, () => {
      const body = text
        .replace(/^---\n[\s\S]*?\n---\n/, "")
        .replace(/\[`[^`\]]*`\]\(https:\/\/github\.com\/sdsrss\/sgc\/[^)]*\)/g, "")
      expect(body.match(/(?<![\w/.-])(?:src|tests|contracts|prompts|metrics|plugins\/sgc|tasks)\/[\w.-]+/g) ?? []).toEqual([])
    })

    // The blocks run the plugin's own CLI by the name its bin/ puts on PATH.
    // A bare `sgc` line meets a user's `sgc` alias first, and in a later Bash
    // call there is no function or variable left to make `sgc` mean the plugin.
    test(`${rel}: shell lines run sgc.mjs, never a bare sgc or the source checkout`, () => {
      // (a fence that installs the npm package runs in a terminal, where npm's name is sgc)
      const shell = [...text.matchAll(/^```(?:bash|sh)\n([\s\S]*?)^```/gm)]
        .filter((m) => !m[1]!.startsWith("npm install -g @sdsrs/sgc"))
        .flatMap((m) => m[1]!.split("\n"))
      expect(shell.filter((l) => /^\s*(?:sgc|bun src\/sgc\.ts)\s/.test(l))).toEqual([])
    })
  }
})

// v2.0.1 delta review: c824a7a's block stored `node <root>/bin/sgc.mjs` in a
// variable and ran it as an unquoted `$SGC …`. That relies on bash word
// splitting: under zsh, which Claude Code's Bash tool prefers on macOS, every
// block failed with "no such file or directory: node …/bin/sgc.mjs"; and a
// plugin root containing a space (Claude Code substitutes the path verbatim)
// split into two words under bash too. So the blocks are executed here, the
// way Claude Code would run them, not just string-matched.
// Absolute paths: the blocks run with a minimal PATH that need not contain the shell.
const SHELLS = ["bash", "zsh"].map((s) => Bun.which(s)).filter((p): p is string => p !== null)
const NODE_DIR = dirname(Bun.which("node")!)
const PKG_VERSION = (JSON.parse(readFileSync(resolve(PLUGIN, "..", "..", "package.json"), "utf8")) as { version: string })
  .version

/** The CLI lookup of a command or skill file (from its first `command -v
 *  sgc.mjs` line to the not-found line), or null when it has none. */
function lookupBlock(text: string): string | null {
  const lines = text.split("\n")
  const start = lines.findIndex((l) => l.startsWith("command -v sgc.mjs"))
  if (start === -1) return null
  const end = lines.findIndex((l, i) => i > start && l.includes("sgc CLI not found"))
  return end === -1 ? null : lines.slice(start, end + 1).join("\n")
}

const withLookup = contentFiles
  .map((f) => ({ rel: f.slice(PLUGIN.length + 1), text: readFileSync(f, "utf8") }))
  .filter(({ text }) => text.includes("${CLAUDE_PLUGIN_ROOT}/bin"))
  .map(({ rel, text }) => ({ rel, block: lookupBlock(text) }))

test("bash is available (and zsh where SGC_REQUIRE_ZSH=1), and every file that names the bundled CLI has a lookup block", () => {
  expect(SHELLS.some((p) => p.endsWith("/bash"))).toBe(true)
  // test.yml installs zsh and sets SGC_REQUIRE_ZSH=1, so the zsh cases
  // cannot skip unseen there. Not keyed to CI: publish.yml runs this suite
  // too, on a runner without zsh.
  if (process.env["SGC_REQUIRE_ZSH"] === "1") expect(SHELLS.some((p) => p.endsWith("/zsh"))).toBe(true)
  expect(withLookup.length).toBeGreaterThanOrEqual(25)
  expect(withLookup.filter((x) => x.block === null).map((x) => x.rel)).toEqual([])
})

describe("each CLI lookup block runs the bundled CLI, as Claude Code's Bash tool would run it", () => {
  // No CLAUDE_PLUGIN_ROOT in the environment (the Bash tool has none), no
  // global sgc, no src/sgc.ts in the working directory.
  const dir = mkdtempSync(join(tmpdir(), "sgc-plugin-content-"))
  const spaced = join(dir, "plugin root with space")
  symlinkSync(PLUGIN, spaced)
  // Claude Code pastes the root into the text verbatim, before any shell
  // quoting applies: none of these characters may change what runs.
  const special = join(dir, `root $HOME "q" \`false\` 'a' $(false)`)
  symlinkSync(PLUGIN, special)
  // Unmatched quote and parenthesis: bash 3.2 (macOS's /bin/bash) cannot
  // parse a here-document like this inside $(…), even with bin/ on PATH.
  const unmatched = join(dir, "root o'brien (x")
  symlinkSync(PLUGIN, unmatched)
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  // The Bash tool sources a snapshot of the user's shell config (aliases
  // included, with bash's expand_aliases on), then evals the command.
  const prelude = {
    plain: "",
    "an sgc alias": `alias sgc='echo ALIAS-SGC'\n`,
    "set -euo pipefail": "set -euo pipefail\n",
  }
  const cases = [
    // the documented mechanism: the plugin's bin/ is on the Bash tool's PATH
    { name: "bin/ on PATH", root: PLUGIN, path: `${join(PLUGIN, "bin")}:${NODE_DIR}:/usr/bin:/bin` },
    // fallback: the substituted ${CLAUDE_PLUGIN_ROOT}
    { name: "root with a space", root: spaced, path: `${NODE_DIR}:/usr/bin:/bin` },
    { name: "root with $ \" ` ' and $()", root: special, path: `${NODE_DIR}:/usr/bin:/bin` },
    { name: "root with an unmatched ' and (", root: unmatched, path: `${NODE_DIR}:/usr/bin:/bin` },
    { name: "root with an unmatched ' and (, bin/ on PATH", root: unmatched, path: `${join(PLUGIN, "bin")}:${NODE_DIR}:/usr/bin:/bin` },
  ]
  for (const sh of SHELLS) {
    const shName = sh.split("/").pop()!
    for (const c of cases) {
      for (const [pName, pre] of Object.entries(prelude)) {
        test(`${shName}, ${c.name}, ${pName}: every block reaches sgc ${PKG_VERSION}`, () => {
          const failures: string[] = []
          for (const { rel, block } of withLookup) {
            const cmd = block!.replaceAll("${CLAUDE_PLUGIN_ROOT}", () => c.root) + "\nsgc.mjs --version\n"
            const outer = `${shName === "bash" ? "shopt -s expand_aliases\n" : ""}${pre}eval "$1"`
            const r = spawnSync(sh, ["-c", outer, "sh", cmd], {
              cwd: dir,
              encoding: "utf8",
              env: { PATH: c.path, HOME: dir },
            })
            if (r.status !== 0 || r.stdout.trim() !== PKG_VERSION) {
              failures.push(`${rel}: exit ${r.status} ${`${r.stdout ?? ""}${r.stderr ?? ""}${r.error ?? ""}`.trim().slice(0, 160)}`)
            }
          }
          expect(failures).toEqual([])
        }, 120_000)
      }
    }
  }
})

describe("bootstrap (injected into sessions)", () => {
  const boot = readFileSync(join(PLUGIN, "skills", "bootstrap", "SKILL.md"), "utf8")

  test("its always-on description is scoped to projects that use sgc, like the hook", () => {
    const description = /^description: "(.*)"$/m.exec(boot)?.[1] ?? ""
    expect(description).toContain(".sgc/")
    expect(description).not.toMatch(/any conversation/i)
  })

  test("it names what the bundled CLI needs: Node, and Playwright only for qa --browse", () => {
    expect(boot).not.toMatch(/nothing else to install/i)
    expect(boot).toContain("Node ≥ 22.19")
    expect(boot).toMatch(/--browse[^\n]*Playwright|Playwright[^\n]*--browse/)
  })

  test("every slash command it names is a /sgc: plugin command", () => {
    const slash = [...boot.matchAll(/`(\/[a-z][\w-]*(?::[\w*-]+)?)/g)].map((m) => m[1]!)
    expect(slash.length).toBeGreaterThan(0)
    expect(slash.filter((s) => !s.startsWith("/sgc:"))).toEqual([])
  })

  test("it points at no repo path a user's project does not have", () => {
    expect(boot).not.toMatch(/plugins\/sgc\/CLAUDE\.md|src\/dispatcher|contracts\/|\.\.\/\.\.\//)
  })
})
