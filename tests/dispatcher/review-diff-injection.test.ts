// P1-1 regression: `sgc review --base` must never reach a shell.
//
// captureDiff used to interpolate the operator-supplied `--base` ref into a
// shell string (`execSync(`git diff ${base}`)`) — the only shell-string
// interpolation in the tree. Any wrapper passing an untrusted ref (sgc spawns
// its own subcommands from plan-jobs.ts) turned that into arbitrary command
// execution. These tests drive the real code path with metacharacter-bearing
// refs and assert the side effect never happens.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureDiff } from "../../src/commands/review"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-review-inject-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("captureDiff (P1-1: no shell interpolation)", () => {
  test("a `;`-chained command in --base is never executed", () => {
    const marker = join(tmp, "pwned-semicolon")
    captureDiff(`HEAD; touch ${marker}`, tmp)
    expect(existsSync(marker)).toBe(false)
  })

  test("a `$(...)` substitution in --base is never executed", () => {
    const marker = join(tmp, "pwned-subshell")
    captureDiff(`$(touch ${marker})`, tmp)
    expect(existsSync(marker)).toBe(false)
  })

  test("a backtick substitution in --base is never executed", () => {
    const marker = join(tmp, "pwned-backtick")
    captureDiff("`touch " + marker + "`", tmp)
    expect(existsSync(marker)).toBe(false)
  })

  test("an `&&`-chained command in --base is never executed", () => {
    const marker = join(tmp, "pwned-and")
    captureDiff(`HEAD && touch ${marker}`, tmp)
    expect(existsSync(marker)).toBe(false)
  })

  test("a hostile ref returns empty diff rather than throwing", () => {
    // git rejects the bogus ref → non-zero exit → captureDiff's soft-null
    // contract (return "") must hold, matching the pre-fix catch behavior.
    expect(captureDiff("HEAD; echo hi", tmp)).toBe("")
  })
})
