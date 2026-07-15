// M4 (code-review follow-up to P3-12): three defects the P3-12 fix left behind.
//
// 1. The scan skipped every file over 200KB. In this repo the only file that
//    trips that cap is `plugins/sgc/bin/sgc.mjs` — which, after P3-9 trimmed
//    `files[]`, is the ONLY code file published to npm. The gate skipped the
//    one artifact that reaches users, to save 4ms. Worse, the bundle is
//    generated: bundlers inline `process.env.X` at build time, so a secret can
//    exist in the bundle while `src/` (which IS scanned) is clean.
//
// 2. `sk-[A-Za-z0-9]{20,}` never matched OpenAI's current keys. `sk-proj-` has
//    been the default since 2024, and `proj` is only four chars before the `-`
//    breaks the class. The pattern most likely to fire in a real diff fired on
//    nothing, while its comment claimed it caught OpenAI.
//
// 3. Canonical PUBLIC documentation examples failed the gate: jwt.io's
//    front-page token, Slack's own docs webhook URL, Google's docs API key.
//    That is the exact failure mode the `sk_test_` exclusion was written to
//    avoid — a gate that flags safe-to-commit values trains operators to ignore
//    it. P3-12 reasoned that out for Stripe and then didn't apply it to the
//    three patterns it added.
//
// The fix for (3) is NOT to stop scanning `.md`: README.md and CHANGELOG.md are
// in `files[]` — they ship. Excluding them would recreate defect (1). Instead
// each pattern declares whether it is common in documentation; only those
// downgrade to a warning inside docs, and only there.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { execSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { scanSecrets } from "../../src/commands/cso"

let repo: string
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "sgc-cso-tier-"))
  execSync("git init -q", { cwd: repo })
  execSync("git config user.email t@t.t && git config user.name t", { cwd: repo, shell: "/bin/bash" })
})
afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
  delete process.env.SGC_CSO_MAX_SCAN_BYTES
})

/** Assemble at runtime — a fixture shaped like a live key IS one to any scanner. */
function fakeSecret(...parts: string[]): string {
  return parts.join("")
}

function src(name: string, content: string): void {
  const p = resolve(repo, name)
  mkdirSync(resolve(p, ".."), { recursive: true })
  writeFileSync(p, content, "utf8")
  execSync("git add -A", { cwd: repo })
}

const STRIPE_LIVE = fakeSecret("sk", "_", "live", "_", "51H8xQ2eZvKYlo2CabcdefghijklmnopQR")
const JWT = [
  fakeSecret("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"),
  fakeSecret("eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ"),
  fakeSecret("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"),
].join(".")
const SLACK_HOOK = fakeSecret(
  "https://hooks.",
  "slack",
  ".com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
)
const GOOGLE_KEY = fakeSecret("AIza", "SyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY")

// ─── A1: the published artifact must be inside the gate ───────────────────

describe("M4/A1 · the scan cap no longer excludes the file we publish", () => {
  test("a bundle-sized file (~1MB) is scanned, not skipped", () => {
    // Mirrors plugins/sgc/bin/sgc.mjs (974,696 bytes at v1.33.0): the only code
    // file in `files[]`. Under the old 200KB cap this returned `warn` with the
    // secret undetected.
    const filler = "// generated bundle filler\n".repeat(37_000) // ~1.0MB
    src("bin/bundle.mjs", `${filler}const k = "${STRIPE_LIVE}"\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("fail")
    expect(r.findings.join(" ")).toMatch(/stripe/i)
  })

  test("a genuinely pathological blob is still skipped, with the file named", () => {
    const filler = "x".repeat(3_000_000) // 3MB > 2MB cap
    src("blob.bin", filler)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("warn")
    expect(r.warnings.join(" ")).toContain("blob.bin")
    expect(r.warnings.join(" ")).toMatch(/exceeds|cap|skipped/i)
  })

  test("SGC_CSO_MAX_SCAN_BYTES lets an operator opt out of the new default", () => {
    // §2-EXT released-artifact checklist: a user-visible default change needs an
    // explicit revert path. Restoring the old cap must restore the old outcome.
    process.env.SGC_CSO_MAX_SCAN_BYTES = "200000"
    const filler = "// filler\n".repeat(37_000)
    src("bin/bundle.mjs", `${filler}const k = "${STRIPE_LIVE}"\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("warn")
    expect(r.findings.length).toBe(0)
  })
})

// ─── A2: OpenAI's actual key formats ──────────────────────────────────────

describe("M4/A2 · OpenAI keys in the format OpenAI actually issues", () => {
  test("sk-proj- (the default since 2024) is detected", () => {
    const key = fakeSecret("sk-", "proj", "-", "abcdEFGH1234ijklMNOP5678qrstUVWX90abcdEFGH1234ijkl")
    src("ai.ts", `const k = "${key}"\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("fail")
    expect(r.findings.join(" ")).toMatch(/openai/i)
  })

  test("sk-svcacct- is detected", () => {
    const key = fakeSecret("sk-", "svcacct", "-", "abcdEFGH1234ijklMNOP5678qrstUVWX90")
    src("ai.ts", `const k = "${key}"\n`)
    expect(scanSecrets(repo).verdict).toBe("fail")
  })

  test("an unquoted .env assignment is caught (the generic pattern needs quotes)", () => {
    const key = fakeSecret("sk-", "proj", "-", "abcdEFGH1234ijklMNOP5678qrstUVWX90abcdEFGH1234ijkl")
    src(".env.example", `OPENAI_API_KEY=${key}\n`)
    expect(scanSecrets(repo).verdict).toBe("fail")
  })

  test("the legacy sk- format still works (no regression)", () => {
    const key = fakeSecret("sk-", "abcdEFGH1234ijklMNOP5678qrstUVWX90")
    src("ai.ts", `const k = "${key}"\n`)
    expect(scanSecrets(repo).verdict).toBe("fail")
  })
})

// ─── A3: documentation context ────────────────────────────────────────────

describe("M4/A3 · canonical public doc examples warn, they do not fail the ship", () => {
  test("jwt.io's front-page token in docs/ warns instead of failing", () => {
    src("docs/auth.md", `Decode this example:\n\n    ${JWT}\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("warn")
    expect(r.findings.length).toBe(0)
    expect(r.warnings.join(" ")).toMatch(/docs\/auth\.md/)
    expect(r.warnings.join(" ")).toMatch(/JWT/i)
  })

  test("Slack's own docs webhook URL in a README warns", () => {
    src("README.md", `POST to ${SLACK_HOOK}\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("warn")
    expect(r.findings.length).toBe(0)
  })

  test("Google's docs API key in docs/ warns", () => {
    src("docs/maps.md", `key=${GOOGLE_KEY}\n`)
    expect(scanSecrets(repo).verdict).toBe("warn")
  })

  test("the SAME JWT in source code still fails — only docs are contextual", () => {
    src("token.ts", `const t = "${JWT}"\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("fail")
    expect(r.findings.join(" ")).toMatch(/jwt/i)
  })

  test("a Stripe live key in README.md still FAILS — README ships in files[]", () => {
    // The whole point of not excluding *.md: README.md and CHANGELOG.md are
    // published. A value that is never legitimate in prose stays a finding
    // wherever it appears.
    src("README.md", `Set your key to ${STRIPE_LIVE}\n`)
    const r = scanSecrets(repo)
    expect(r.verdict).toBe("fail")
    expect(r.findings.join(" ")).toMatch(/stripe/i)
  })

  test("an npm token in CHANGELOG.md still FAILS", () => {
    const tok = fakeSecret("npm", "_", "abcdefghijklmnopqrstuvwxyz0123456789")
    src("CHANGELOG.md", `- fixed auth using ${tok}\n`)
    expect(scanSecrets(repo).verdict).toBe("fail")
  })

  test("an AWS key in docs/ still FAILS — never legitimate in prose", () => {
    src("docs/deploy.md", `Use AKIAIOSFODNN7EXAMPLE\n`)
    expect(scanSecrets(repo).verdict).toBe("fail")
  })
})

// ─── A4: vendor coverage inside the families P3-12 claimed ────────────────

describe("M4/A4 · the rest of each vendor family P3-12 added", () => {
  const cases: { label: string; file: string; value: string; want: RegExp }[] = [
    {
      label: "Stripe webhook signing secret",
      file: "hook.ts",
      value: fakeSecret("whsec", "_", "abcdefghijklmnopqrstuvwxyz012345"),
      want: /stripe/i,
    },
    {
      label: "Slack app-level token",
      file: "slack.ts",
      value: fakeSecret("xapp", "-1-A0123456789-1234567890123-abcdef0123456789"),
      want: /slack/i,
    },
    {
      label: "Slack Workflow Builder webhook",
      file: "wf.ts",
      value: fakeSecret(
        "https://hooks.",
        "slack",
        ".com/triggers/T0123456789/1234567890123/abcdef0123456789abcdef01",
      ),
      want: /slack/i,
    },
    {
      label: "Google OAuth client secret",
      file: "oauth.ts",
      value: fakeSecret("GOCSPX", "-abcdefghijklmnopqrstuvwx"),
      want: /google/i,
    },
    {
      label: "GitHub fine-grained PAT",
      file: "gh.ts",
      value: fakeSecret("github", "_", "pat", "_", "11ABCDEFG0abcdefghijklmnopqrstuvwxyz0123456789ABCDEF"),
      want: /github/i,
    },
    {
      label: "GitHub OAuth token (gho_)",
      file: "gho.ts",
      value: fakeSecret("gho", "_", "abcdefghijklmnopqrstuvwxyz0123456789AB"),
      want: /github/i,
    },
  ]

  for (const c of cases) {
    test(`${c.label} is detected`, () => {
      src(c.file, `const v = "${c.value}"\n`)
      const r = scanSecrets(repo)
      expect(r.verdict).toBe("fail")
      expect(r.findings.join(" ")).toMatch(c.want)
    })
  }
})

// ─── A5: no pattern may echo the value it matched ─────────────────────────

describe("M4/A5 · no pattern echoes the matched value into the report", () => {
  const secrets: { label: string; file: string; value: string }[] = [
    { label: "Stripe live", file: "a.ts", value: STRIPE_LIVE },
    { label: "JWT", file: "b.ts", value: JWT },
    { label: "Google", file: "c.ts", value: GOOGLE_KEY },
    { label: "npm", file: "d.ts", value: fakeSecret("npm", "_", "abcdefghijklmnopqrstuvwxyz0123456789") },
    { label: "Slack webhook", file: "e.ts", value: SLACK_HOOK },
    {
      label: "OpenAI proj",
      file: "f.ts",
      value: fakeSecret("sk-", "proj", "-", "abcdEFGH1234ijklMNOP5678qrstUVWX90abcdEFGH1234ijkl"),
    },
  ]

  for (const s of secrets) {
    test(`${s.label}: the value never appears in the serialized report`, () => {
      src(s.file, `const v = "${s.value}"\n`)
      const r = scanSecrets(repo)
      expect(JSON.stringify(r)).not.toContain(s.value)
    })
  }

  test("a doc-context warning does not echo the value either", () => {
    src("docs/x.md", `example: ${JWT}\n`)
    const r = scanSecrets(repo)
    expect(JSON.stringify(r)).not.toContain(JWT)
  })
})
