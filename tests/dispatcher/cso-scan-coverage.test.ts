// P3-12: cso's secret scan missed formats common in the repos it gates.
//
// `sk-` caught OpenAI but not Stripe's `sk_live_`; JWTs, Google API keys, npm
// tokens and Slack webhooks matched nothing at all. For a last-line pre-ship
// gate those are the shapes most likely to actually be sitting in a diff.
//
// The audit also claimed oversize files were "skipped with only a warn" and
// asked for that to become a finding. Half wrong, and the fix would have been
// harmful — see the oversize describe block below. The scan stays a heuristic;
// it does not claim to be gitleaks.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { execSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { scanSecrets } from "../../src/commands/cso"

let repo: string
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "sgc-cso-cov-"))
  execSync("git init -q", { cwd: repo })
  execSync("git config user.email t@t.t && git config user.name t", { cwd: repo, shell: "/bin/bash" })
})
afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

/**
 * Assemble a secret at runtime so the literal never sits in this file.
 *
 * Learned the hard way: GitHub push protection blocked the first version of
 * this test, because a fixture that looks exactly like a live Stripe key IS
 * one as far as any scanner can tell — including the ones guarding this repo.
 * A secret-scanner's own fixtures are the one place this problem is guaranteed
 * to bite. Concatenating at runtime keeps the value out of the blob while the
 * assertion still exercises the real pattern end to end.
 */
function fakeSecret(...parts: string[]): string {
  return parts.join("")
}

/** Write a tracked source file (the scan only reads git-known files). */
function src(name: string, content: string): void {
  const p = resolve(repo, name)
  mkdirSync(resolve(p, ".."), { recursive: true })
  writeFileSync(p, content, "utf8")
  execSync(`git add -A`, { cwd: repo })
}

describe("cso secret-scan pattern coverage (P3-12)", () => {
  test("Stripe live secret key is detected", () => {
    const key = fakeSecret("sk", "_", "live", "_", "51H8xQ2eZvKYlo2CabcdefghijklmnopQR")
    src("pay.ts", `const key = "${key}"\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("fail")
    expect(r.findings.join(" ")).toMatch(/stripe/i)
  })

  test("JWT is detected", () => {
    src(
      "token.ts",
      `const t = "${fakeSecret("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", ".", "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ", ".", "dQw4w9WgXcQdQw4w9WgXcQdQw4w9WgXcQdQw4w")}"\n`,
    )
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("fail")
    expect(r.findings.join(" ")).toMatch(/jwt/i)
  })

  test("Google API key is detected", () => {
    src("maps.ts", `const k = "${fakeSecret("AIza", "SyD-1234567890abcdefghijklmnopqrstu")}"\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("fail")
    expect(r.findings.join(" ")).toMatch(/google/i)
  })

  test("npm token is detected", () => {
    src(".npmrc.example", `//registry.npmjs.org/:_authToken=${fakeSecret("npm", "_", "abcdefghijklmnopqrstuvwxyz0123456789")}\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("fail")
    expect(r.findings.join(" ")).toMatch(/npm/i)
  })

  test("Slack webhook URL is detected", () => {
    const hook = fakeSecret("https://hooks.", "slack", ".com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX")
    src("notify.ts", `const hook = "${hook}"\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("fail")
    expect(r.findings.join(" ")).toMatch(/slack/i)
  })

  test("the value itself is never echoed into the report", () => {
    const secret = fakeSecret("sk", "_", "live", "_", "51H8xQ2eZvKYlo2CabcdefghijklmnopQR")
    src("pay.ts", `const key = "${secret}"\n`)
    const r = scanSecrets(repo)
    expect(JSON.stringify(r)).not.toContain(secret)
  })

  test("an existing pattern still works (no regression)", () => {
    src("aws.ts", `const k = "AKIAIOSFODNN7EXAMPLE"\n`)
    expect(scanSecrets(repo).verdict).toBe("fail")
  })

  test("clean source still passes", () => {
    src("ok.ts", `export const greeting = "hello"\n`)
    expect(scanSecrets(repo).verdict).toBe("pass")
  })
})

describe("cso oversize files are not silently trusted (P3-12)", () => {
  // The audit proposed upgrading the >200KB skip from `warn` to a finding
  // (i.e. fail the gate). Rejected, with evidence: this repo git-tracks its own
  // ~950KB bundle (plugins/sgc/bin/sgc.mjs), so `sgc cso` would fail on sgc
  // itself, every run, forever — and a gate that always fails gets ignored,
  // which is strictly worse than one that warns. The existing behavior is
  // already correct; these tests pin it so it stays that way.
  test("a file too large to scan downgrades the verdict away from `pass`", () => {
    src("big.ts", "// filler\n".repeat(30_000))
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("warn")
    expect(r.verdict).not.toBe("pass")
  })

  test("the unscanned file is named so the operator can check it by hand", () => {
    src("big.ts", "// filler\n".repeat(30_000))
    const r = scanSecrets(repo)
    expect(r.warnings.join(" ")).toContain("big.ts")
    expect(r.warnings.join(" ")).toMatch(/exceeds|cap|skipped/i)
  })
})
