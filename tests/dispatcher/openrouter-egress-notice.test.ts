// P2-11 regression: third-party egress must be disclosed at runtime.
//
// Setting OPENROUTER_API_KEY silently routes every subagent through
// openrouter.ai — which means the prompt bodies, and therefore the user's
// source and diffs, leave the machine for a third party. That is a reasonable
// feature; doing it with no user-visible word is not. The only disclosure was a
// comment at the top of openrouter-agent.ts, which nobody reads while exporting
// ANTHROPIC/OPENROUTER keys into a shell profile.
//
// For a tool whose whole job is reviewing proprietary code, "an env var you may
// have set months ago silently ships your diffs to a third party" is the kind
// of default that has to announce itself. Once per process, on stderr, so it
// never corrupts stdout or --json consumers.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  runOpenRouterAgent,
  __resetEgressNoticeForTests,
} from "../../src/dispatcher/openrouter-agent"
import type { SubagentManifest } from "../../src/dispatcher/types"

let tmp: string
let promptPath: string
let prevKey: string | undefined
let stderrLines: string[]
let origError: typeof console.error

const manifest = {
  name: "classifier.level",
  outputs: { level: "string", rationale: "string" },
  timeout_s: 5,
} as unknown as SubagentManifest

const okFetch = async (): Promise<Response> =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: "```yaml\nlevel: L0\nrationale: typo in readme.md\n```" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  )

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-egress-"))
  promptPath = join(tmp, "p.md")
  writeFileSync(promptPath, "system\n\n---\n\nuser part\n", "utf8")
  prevKey = process.env["OPENROUTER_API_KEY"]
  process.env["OPENROUTER_API_KEY"] = "test-key"
  stderrLines = []
  origError = console.error
  console.error = (...a: unknown[]) => stderrLines.push(a.join(" "))
  __resetEgressNoticeForTests()
})
afterEach(() => {
  console.error = origError
  if (prevKey === undefined) delete process.env["OPENROUTER_API_KEY"]
  else process.env["OPENROUTER_API_KEY"] = prevKey
  rmSync(tmp, { recursive: true, force: true })
  __resetEgressNoticeForTests()
})

describe("openrouter egress notice (P2-11)", () => {
  test("first call discloses that prompt content leaves for openrouter.ai", async () => {
    await runOpenRouterAgent(promptPath, manifest, okFetch as unknown as typeof fetch)
    const all = stderrLines.join("\n")
    expect(all).toContain("openrouter.ai")
    // Must name what is actually leaving, not just "using openrouter".
    expect(all.toLowerCase()).toMatch(/prompt|code|diff/)
    // Must name the switch, so the reader knows how they got here.
    expect(all).toContain("OPENROUTER_API_KEY")
  })

  test("the notice is printed once per process, not per spawn", async () => {
    await runOpenRouterAgent(promptPath, manifest, okFetch as unknown as typeof fetch)
    await runOpenRouterAgent(promptPath, manifest, okFetch as unknown as typeof fetch)
    await runOpenRouterAgent(promptPath, manifest, okFetch as unknown as typeof fetch)
    const hits = stderrLines.filter((l) => l.includes("openrouter.ai")).length
    expect(hits).toBe(1)
  })

  test("the notice goes to stderr, never stdout (--json stays clean)", async () => {
    const origLog = console.log
    const stdoutLines: string[] = []
    console.log = (...a: unknown[]) => stdoutLines.push(a.join(" "))
    try {
      await runOpenRouterAgent(promptPath, manifest, okFetch as unknown as typeof fetch)
    } finally {
      console.log = origLog
    }
    expect(stdoutLines.join("\n")).not.toContain("openrouter.ai")
  })
})
