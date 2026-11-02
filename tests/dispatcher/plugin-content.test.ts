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

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs"
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

/** What is wrong with a "sgc CLI not found" advice (empty when nothing).
 *  Measured on Claude Code 2.1.316 with bin/sgc.mjs deleted from the plugin
 *  cache: `install` alone answers "already installed", and so does `update`
 *  ("already at the latest version"); uninstall + install restores the file.
 *  Both default to user scope: for a project or local install the uninstall
 *  fails ("enabled at project scope") and the install adds a second,
 *  user-wide install. A plugin from a local-directory marketplace (`plugin
 *  list` shows "Read from") or from --plugin-dir is read from that
 *  directory, where no reinstall changes anything.
 *  `plugin list` also shows other projects' project- and local-scope
 *  installs, with nothing in the plain output to tell them apart, so a
 *  listed Scope can be the wrong one: there the uninstall fails and changes
 *  nothing, but an install run anyway adds an install the user did not
 *  have. Hence `&&`: the install runs only after its uninstall worked. */
const REINSTALL = "claude plugin uninstall sgc@sgc --scope <scope> && claude plugin install sgc@sgc --scope <scope>"
function reinstallAdviceProblems(text: string): string[] {
  const problems: string[] = []
  const list = text.indexOf("claude plugin list")
  const reinstall = text.indexOf(REINSTALL)
  if (!/in a terminal in this project/i.test(text)) problems.push("not run in this project, whose installs plugin list must show")
  if (list === -1) problems.push("no `claude plugin list`, which shows the install's scope")
  if (reinstall === -1) problems.push(`not literally: ${REINSTALL}`)
  if (list !== -1 && reinstall !== -1 && list > reinstall) problems.push("the reinstall comes before `claude plugin list`")
  if (!/then try the next (?:listed )?Scope/.test(text)) problems.push("no next step when the uninstall fails")
  if (!text.includes("Read from") || !text.includes("--plugin-dir") || !/restore `?bin\/sgc\.mjs`?/.test(text))
    problems.push("no restore of bin/sgc.mjs for a plugin read from a directory")
  return [...problems, ...reinstallMentionProblems(text)]
}

/** A plugin (un)install named anywhere, other than as the REINSTALL pair: an
 *  install outside the pair runs even when its uninstall failed. Counts
 *  every spelling Claude Code accepts (install|i, uninstall|remove, with or
 *  without @sgc) and any `/plugin` (un)install. */
function reinstallMentionProblems(text: string): string[] {
  const problems: string[] = []
  const pairs = text.split(REINSTALL).length - 1
  const installs = text.match(/claude plugin (?:install|i)\s+sgc\b/g)?.length ?? 0
  const uninstalls = text.match(/claude plugin (?:uninstall|remove)\s+sgc\b/g)?.length ?? 0
  if (installs !== pairs) problems.push(`${installs} claude plugin install(s) for ${pairs} \`uninstall && install\` pair(s)`)
  if (uninstalls !== pairs) problems.push(`${uninstalls} claude plugin uninstall(s) for ${pairs} \`uninstall && install\` pair(s)`)
  if (/\/plugin (?:install|i|uninstall|remove)\b/.test(text)) problems.push("a `/plugin` (un)install")
  return problems
}

/** Every file under commands/, skills/ and agents/, whatever its extension. */
function allFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? allFiles(join(dir, e.name)) : [join(dir, e.name)],
  )
}

test("no command, skill or agent file names a plugin (un)install other than the scoped uninstall && install pair", () => {
  const files = ["commands", "skills", "agents"].flatMap((d) => allFiles(join(PLUGIN, d)))
  expect(files.length).toBeGreaterThanOrEqual(contentFiles.length)
  const failures = files.flatMap((f) =>
    reinstallMentionProblems(readFileSync(f, "utf8")).map((p) => `${f.slice(PLUGIN.length + 1)}: ${p}`),
  )
  expect(failures).toEqual([])
})

/** The text a block's not-found line prints. */
function notFoundMessage(block: string): string {
  return /echo "([^"]*)" >&2; exit 1; \}$/.exec(block.split("\n").at(-1)!)?.[1] ?? ""
}

test("every block's not-found message gives the same reinstall, one that works for each kind of install", () => {
  const messages = withLookup.map(({ block }) => notFoundMessage(block!))
  expect(reinstallAdviceProblems(messages[0]!)).toEqual([])
  expect(withLookup.filter((_, i) => messages[i] !== messages[0]).map((x) => x.rel)).toEqual([])
})

test("bash is available (zsh where SGC_REQUIRE_ZSH=1, bash 3.2 where SGC_REQUIRE_BASH32=1), and every file that names the bundled CLI has a lookup block", () => {
  expect(SHELLS.some((p) => p.endsWith("/bash"))).toBe(true)
  // test.yml installs zsh and sets SGC_REQUIRE_ZSH=1, so the zsh cases
  // cannot skip unseen there. Not keyed to CI: publish.yml runs this suite
  // too, on a runner without zsh.
  if (process.env["SGC_REQUIRE_ZSH"] === "1") expect(SHELLS.some((p) => p.endsWith("/zsh"))).toBe(true)
  // test.yml's macOS job sets SGC_REQUIRE_BASH32=1: there the bash on PATH
  // must be Apple's /bin/bash 3.2, or the job would pass on a newer bash.
  if (process.env["SGC_REQUIRE_BASH32"] === "1") {
    const bash = SHELLS.find((p) => p.endsWith("/bash"))!
    expect(spawnSync(bash, ["-c", "echo $BASH_VERSION"], { encoding: "utf8" }).stdout).toStartWith("3.2.")
  }
  expect(withLookup.length).toBeGreaterThanOrEqual(25)
  expect(withLookup.filter((x) => x.block === null).map((x) => x.rel)).toEqual([])
})

describe("each CLI lookup block runs the bundled CLI, as Claude Code's Bash tool would run it", () => {
  // No CLAUDE_PLUGIN_ROOT in the environment (the Bash tool has none), no
  // global sgc, no src/sgc.ts in the working directory.
  // Created in beforeAll, not while bun collects the tests: when `-t` filters
  // out this whole describe, bun runs neither hook, so nothing is left behind.
  let dir = ""
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "sgc-plugin-content-"))
    for (const name of [spaced, special, unmatched]) symlinkSync(PLUGIN, join(dir, name))
    // a plugin whose files are incomplete: bin/ without the CLI
    mkdirSync(join(dir, broken, "bin"), { recursive: true })
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))
  const spaced = "plugin root with space"
  // Claude Code pastes the root into the text verbatim, before any shell
  // quoting applies: none of these characters may change what runs.
  const special = `root $HOME "q" \`false\` 'a' $(false)`
  // Unmatched quote and parenthesis: bash 3.2 (macOS's /bin/bash) cannot
  // parse a here-document like this inside $(…), even with bin/ on PATH.
  const unmatched = "root o'brien (x"
  const broken = "root without the CLI"

  // The Bash tool sources a snapshot of the user's shell config (aliases
  // included, with bash's expand_aliases on), then evals the command.
  const prelude = {
    plain: "",
    "an sgc alias": `alias sgc='echo ALIAS-SGC'\n`,
    "set -euo pipefail": "set -euo pipefail\n",
  }
  const run = (sh: string, pre: string, block: string, root: string, path: string, after: string) => {
    const cmd = block.replaceAll("${CLAUDE_PLUGIN_ROOT}", () => root) + after
    const outer = `${sh.endsWith("/bash") ? "shopt -s expand_aliases\n" : ""}${pre}eval "$1"`
    return spawnSync(sh, ["-c", outer, "sh", cmd], { cwd: dir, encoding: "utf8", env: { PATH: path, HOME: dir } })
  }
  const cases = [
    // the documented mechanism: the plugin's bin/ is on the Bash tool's PATH
    { name: "bin/ on PATH", root: () => PLUGIN, path: `${join(PLUGIN, "bin")}:${NODE_DIR}:/usr/bin:/bin` },
    // fallback: the substituted ${CLAUDE_PLUGIN_ROOT}
    { name: "root with a space", root: () => join(dir, spaced), path: `${NODE_DIR}:/usr/bin:/bin` },
    { name: "root with $ \" ` ' and $()", root: () => join(dir, special), path: `${NODE_DIR}:/usr/bin:/bin` },
    { name: "root with an unmatched ' and (", root: () => join(dir, unmatched), path: `${NODE_DIR}:/usr/bin:/bin` },
    { name: "root with an unmatched ' and (, bin/ on PATH", root: () => join(dir, unmatched), path: `${join(PLUGIN, "bin")}:${NODE_DIR}:/usr/bin:/bin` },
  ]
  for (const sh of SHELLS) {
    const shName = sh.split("/").pop()!
    for (const c of cases) {
      for (const [pName, pre] of Object.entries(prelude)) {
        test(`${shName}, ${c.name}, ${pName}: every block reaches sgc ${PKG_VERSION}`, () => {
          const failures: string[] = []
          for (const { rel, block } of withLookup) {
            const r = run(sh, pre, block!, c.root(), c.path, "\nsgc.mjs --version\n")
            if (r.status !== 0 || r.stdout.trim() !== PKG_VERSION) {
              failures.push(`${rel}: exit ${r.status} ${`${r.stdout ?? ""}${r.stderr ?? ""}${r.error ?? ""}`.trim().slice(0, 160)}`)
            }
          }
          expect(failures).toEqual([])
        }, 120_000)
      }
    }
    // The not-found branch: neither bin/ on PATH nor a CLI under the root.
    // The block must stop there (exit 1, before the CLI line) with its advice
    // on stderr, not fail in some other way.
    for (const [pName, pre] of Object.entries(prelude)) {
      test(`${shName}, plugin files incomplete, ${pName}: every block stops with its reinstall advice`, () => {
        const failures: string[] = []
        for (const { rel, block } of withLookup) {
          const r = run(sh, pre, block!, join(dir, broken), `${NODE_DIR}:/usr/bin:/bin`, "\necho CLI-LINE-REACHED\n")
          if (r.status !== 1 || r.stdout !== "" || r.stderr.trim() !== notFoundMessage(block!)) {
            failures.push(`${rel}: exit ${r.status} ${`${r.stdout ?? ""}${r.stderr ?? ""}${r.error ?? ""}`.trim().slice(0, 160)}`)
          }
        }
        expect(failures).toEqual([])
      }, 120_000)
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

  test("its sgc-CLI-not-found advice restores the files for each kind of install (see reinstallAdviceProblems)", () => {
    const advice = boot.split("\n\n").filter((p) => p.includes("sgc CLI not found"))
    expect(advice.length).toBe(1)
    expect(reinstallAdviceProblems(advice[0]!)).toEqual([])
  })

  test("it points at no repo path a user's project does not have", () => {
    expect(boot).not.toMatch(/plugins\/sgc\/CLAUDE\.md|src\/dispatcher|contracts\/|\.\.\/\.\.\//)
  })
})
