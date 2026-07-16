// A1 / audit v1.37.0 Q-1 regression: a large `git diff` must not silently
// collapse to an empty diff and pass the review gate.
//
// captureDiff → spawnCaptureSync → spawnSync with Node's default 1 MiB
// maxBuffer. On overflow spawnSync sets `error` (ENOBUFS) and TRUNCATES; the
// old captureDiff mapped every non-zero exit to "" (soft-null), so a >1 MB
// changeset — the large feature/refactor that most needs review — reached the
// reviewers as an EMPTY diff and they returned pass. The gate self-disabled on
// the biggest changes.
//
// Fix: (1) raise spawnCaptureSync's maxBuffer ceiling; (2) captureDiff
// distinguishes "capture failed to complete" (spawn error / overflow → exit -1)
// from "git rejected the ref" (exit > 0) from "no changes" (exit 0, ""), and
// HARD-FAILS on the first rather than returning "".

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureDiff } from "../../src/commands/review"
import { spawnCaptureSync } from "../../src/dispatcher/subprocess"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-diff-capture-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function initRepoWithDiff(dir: string, bodyBytes: number): void {
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@t",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@t",
      },
    })
  git("init", "-q")
  writeFileSync(join(dir, "f.txt"), "seed\n")
  git("add", "f.txt")
  git("commit", "-q", "-m", "seed")
  // Uncommitted change larger than the injected cap → `git diff HEAD` emits it.
  writeFileSync(join(dir, "f.txt"), "x".repeat(bodyBytes) + "\n")
}

describe("spawnCaptureSync (A1: overflow is a capture failure, not silent truncation)", () => {
  test("stdout beyond maxBuffer resolves exitCode -1, not a truncated 0", () => {
    const r = spawnCaptureSync(
      [process.execPath, "-e", "process.stdout.write('x'.repeat(100000))"],
      { maxBuffer: 16 },
    )
    expect(r.exitCode).toBe(-1)
  })
})

describe("captureDiff (A1: distinguish capture-failed / ref-rejected / no-changes)", () => {
  test("a diff larger than the byte cap THROWS rather than returning empty", () => {
    initRepoWithDiff(tmp, 5000)
    expect(() => captureDiff("HEAD", tmp, 256)).toThrow(/capture failed/i)
  })

  test("a diff within the byte cap is returned in full (non-empty)", () => {
    initRepoWithDiff(tmp, 5000)
    const diff = captureDiff("HEAD", tmp, 64 * 1024 * 1024)
    expect(diff.length).toBeGreaterThan(5000)
    expect(diff).toContain("f.txt")
  })

  test("no changes (exit 0, empty stdout) still returns '' — not a failure", () => {
    initRepoWithDiff(tmp, 0)
    // revert the working-tree change so the tree is clean → empty diff
    writeFileSync(join(tmp, "f.txt"), "seed\n")
    expect(captureDiff("HEAD", tmp)).toBe("")
  })
})
