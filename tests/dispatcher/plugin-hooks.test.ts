// v2.0.1: plugins/sgc/hooks/hooks.json had `"hooks"` as an ARRAY of
// `{matcher: "SessionStart", hooks: [...]}`. Claude Code's hooks schema wants
// an object mapping each event to a list of matcher groups; Claude Code
// 2.1.316 refuses the whole plugin ("✘ failed to load", `claude plugin
// validate` HOOKS_SCHEMA_INVALID), so no /sgc:* command, skill or agent was
// available. The same file shipped in v1.38.5.
//
// The SessionStart hook now injects the bootstrap (and the active task) only
// in projects that use sgc (a .sgc/ directory), and the bootstrap no longer
// tells the model that bun is the runtime.

import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const PLUGIN = resolve(import.meta.dir, "..", "..", "plugins", "sgc")
const hooksFile = JSON.parse(readFileSync(join(PLUGIN, "hooks", "hooks.json"), "utf8")) as Record<string, unknown>

type Handler = { type: string; command?: string; [k: string]: unknown }
type Group = { matcher?: string; hooks: Handler[] }

describe("hooks.json follows Claude Code's hooks schema", () => {
  test("top level holds only `hooks` (and an optional `description`)", () => {
    for (const k of Object.keys(hooksFile)) expect(["hooks", "description"]).toContain(k)
  })

  test("`hooks` is an object mapping each event to a list of groups, each with a `hooks` list", () => {
    const hooks = hooksFile["hooks"]
    expect(typeof hooks === "object" && hooks !== null && !Array.isArray(hooks)).toBe(true)
    for (const [event, groups] of Object.entries(hooks as Record<string, unknown>)) {
      expect(event).toMatch(/^[A-Z][A-Za-z]+$/)
      expect(Array.isArray(groups)).toBe(true)
      for (const g of groups as Group[]) {
        expect(Array.isArray(g.hooks)).toBe(true)
        for (const h of g.hooks) {
          expect(h.type).toBe("command")
          expect(typeof h.command).toBe("string")
        }
      }
    }
  })
})

function sessionStartCommand(): string {
  const groups = (hooksFile["hooks"] as Record<string, Group[]>)["SessionStart"]!
  expect(groups).toHaveLength(1)
  expect(groups[0]!.hooks).toHaveLength(1)
  return groups[0]!.hooks[0]!.command!
}

function runHook(projectDir: string, env: Record<string, string | undefined>): { status: number | null; out: string } {
  const r = spawnSync("bash", ["-c", sessionStartCommand()], {
    cwd: projectDir,
    encoding: "utf8",
    env: { PATH: process.env["PATH"], CLAUDE_PLUGIN_ROOT: PLUGIN, ...env },
  })
  return { status: r.status, out: r.stdout }
}

describe("SessionStart hook", () => {
  test("a project without .sgc/ gets no injected context", () => {
    const dir = mkdtempSync(join(tmpdir(), "sgc-hook-"))
    try {
      const r = runHook(dir, { CLAUDE_PROJECT_DIR: dir })
      expect(r.status).toBe(0)
      expect(r.out).toBe("")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("a project with .sgc/ gets the bootstrap, and the active task when there is one", () => {
    const dir = mkdtempSync(join(tmpdir(), "sgc-hook-"))
    try {
      mkdirSync(join(dir, ".sgc", "progress"), { recursive: true })
      const without = runHook(dir, { CLAUDE_PROJECT_DIR: dir })
      expect(without.status).toBe(0)
      expect(without.out).toContain("# SGC Bootstrap")
      expect(without.out).not.toContain("Active sgc task")

      writeFileSync(join(dir, ".sgc", "progress", "current-task.md"), "task: hook-probe-42\n")
      const withTask = runHook(dir, { CLAUDE_PROJECT_DIR: dir })
      expect(withTask.out).toContain("# SGC Bootstrap")
      expect(withTask.out).toContain("## Active sgc task")
      expect(withTask.out).toContain("task: hook-probe-42")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("without CLAUDE_PROJECT_DIR the hook falls back to its working directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "sgc-hook-"))
    try {
      mkdirSync(join(dir, ".sgc"), { recursive: true })
      expect(runHook(dir, { CLAUDE_PROJECT_DIR: undefined }).out).toContain("# SGC Bootstrap")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

test("the injected bootstrap does not name bun as the runtime", () => {
  const skill = readFileSync(join(PLUGIN, "skills", "bootstrap", "SKILL.md"), "utf8")
  expect(skill).not.toMatch(/requires bun|bun[^\n]{0,20}required as the runtime|runtime[^\n]{0,20}bun/i)
})
