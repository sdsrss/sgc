// P2-10 regression: the prompt must not travel on the command line.
//
// runClaudeCliAgent built `["claude", "-p", "--output-format", "json",
// promptText]` — the whole prompt as one argv element. The prompt carries the
// task input YAML: diffs, source excerpts, intent. On Linux /proc/<pid>/cmdline
// is world-readable by default (no hidepid), so on any shared or multi-tenant
// host every local user could read the reviewed code straight out of `ps` for
// as long as the call ran. Large prompts also risk E2BIG once argv passes
// ARG_MAX.
//
// stdin has neither problem, and `claude -p` reads the prompt from it. The SDK
// and OpenRouter modes were never affected — they put the prompt in a request
// body.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runClaudeCliAgent } from "../../src/dispatcher/claude-cli-agent"
import type { SubagentManifest } from "../../src/dispatcher/types"

let tmp: string
let promptPath: string
const SECRET_IN_PROMPT = "PROPRIETARY_DIFF_LINE_do_not_leak_to_ps"

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-cli-stdin-"))
  promptPath = join(tmp, "prompt.md")
  writeFileSync(promptPath, `system\n\n---\n\nreview this:\n${SECRET_IN_PROMPT}\n`, "utf8")
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const manifest = {
  name: "classifier.level",
  outputs: { level: "string", rationale: "string" },
  timeout_s: 5,
} as unknown as SubagentManifest

const OK_RESULT = JSON.stringify({
  result: "```yaml\nlevel: L0\nrationale: trivial typo fix in readme.md\n```",
})

describe("claude-cli prompt delivery (P2-10)", () => {
  test("the prompt is NOT passed as an argv element", async () => {
    let seenArgv: string[] = []
    await runClaudeCliAgent(promptPath, manifest, async (argv) => {
      seenArgv = argv
      return { stdout: OK_RESULT, stderr: "", exitCode: 0, timedOut: false }
    })
    expect(seenArgv.join(" ")).not.toContain(SECRET_IN_PROMPT)
    for (const a of seenArgv) expect(a).not.toContain(SECRET_IN_PROMPT)
  })

  test("argv keeps only the flags (still a real `claude -p` invocation)", async () => {
    let seenArgv: string[] = []
    await runClaudeCliAgent(promptPath, manifest, async (argv) => {
      seenArgv = argv
      return { stdout: OK_RESULT, stderr: "", exitCode: 0, timedOut: false }
    })
    expect(seenArgv[0]).toBe("claude")
    expect(seenArgv).toContain("-p")
    expect(seenArgv).toContain("--output-format")
    expect(seenArgv).toContain("json")
  })

  test("the prompt IS delivered to the child on stdin", async () => {
    let seenStdin: string | undefined
    await runClaudeCliAgent(
      promptPath,
      manifest,
      async (_argv, _timeout, _onSpawn, stdin) => {
        seenStdin = stdin
        return { stdout: OK_RESULT, stderr: "", exitCode: 0, timedOut: false }
      },
    )
    expect(seenStdin).toContain(SECRET_IN_PROMPT)
  })

  test("the parsed result is unchanged by the delivery switch", async () => {
    const out = (await runClaudeCliAgent(promptPath, manifest, async () => ({
      stdout: OK_RESULT,
      stderr: "",
      exitCode: 0,
      timedOut: false,
    }))) as { level: string }
    expect(out.level).toBe("L0")
  })
})
