// P2-2 regression: bundle-hash parity must not cry STALE over a bun mismatch.
//
// The check rebuilds the bundle and compares hashes. `bun build` output is not
// byte-stable across bun versions, so on any machine whose bun differs from
// CI's pinned one it fails with:
//
//     ✗ committed bundle STALE — run `npm run build:cli` and commit
//
// Measured on this repo at v1.31.8: bun 1.3.5 (CI's pin) rebuilds the committed
// bundle byte-for-byte; bun 1.3.11 does not. So the message was not merely
// noisy — it was actively harmful. It tells the developer to rebuild and
// commit, and doing so replaces a correct artifact with one CI's own
// `git diff --exit-code` gate then rejects. A false alarm that manufactures a
// real failure is worse than no check.
//
// The fix: compare the toolchain first. Same bun as CI → a hash mismatch is
// real, fail. Different bun → we cannot conclude anything, so warn and name the
// version needed.

import { describe, expect, test } from "bun:test"
import { ciPinnedBunVersion, bundleMatchSeverity, bundleStaleSeverity } from "../../src/commands/doctor"

const WORKFLOW = `
name: test
on: [push]
jobs:
  test:
    steps:
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.5"
      - run: bun test
`

describe("ciPinnedBunVersion (P2-2)", () => {
  test("extracts the pinned version from a setup-bun workflow", () => {
    expect(ciPinnedBunVersion(WORKFLOW)).toBe("1.3.5")
  })

  test("tolerates unquoted values", () => {
    expect(ciPinnedBunVersion("        bun-version: 1.2.0\n")).toBe("1.2.0")
  })

  test("returns null when no pin is present (nothing to compare against)", () => {
    expect(ciPinnedBunVersion("name: test\non: [push]\n")).toBeNull()
  })
})

describe("bundleStaleSeverity (P2-2)", () => {
  test("same bun as CI → a hash mismatch is a REAL stale bundle → fail", () => {
    const r = bundleStaleSeverity("1.3.5", "1.3.5")
    expect(r.severity).toBe("fail")
    expect(r.msg).toMatch(/STALE/)
    expect(r.msg).toMatch(/build:cli/)
  })

  test("different bun from CI → inconclusive → warn, naming the version needed", () => {
    const r = bundleStaleSeverity("1.3.11", "1.3.5")
    expect(r.severity).toBe("warn")
    // Must NOT tell the developer to rebuild-and-commit: that is what breaks CI.
    expect(r.msg).not.toMatch(/STALE/)
    expect(r.msg).toContain("1.3.5") // the version that CAN answer the question
    expect(r.msg).toContain("1.3.11") // what they have
  })

  test("unknown CI pin → cannot compare → fall back to fail (no silent pass)", () => {
    // Conservative: if we can't read the pin, keep the old strict behavior
    // rather than downgrade a possibly-real staleness to a warning.
    expect(bundleStaleSeverity("1.3.11", null).severity).toBe("fail")
  })

  test("unknown local bun → cannot compare → fall back to fail", () => {
    expect(bundleStaleSeverity(null, "1.3.5").severity).toBe("fail")
  })
})

// v2.0.0: the converse case. During v1.38.5 a bundle built by local bun 1.4.2
// was committed; doctor rebuilt it with the same 1.4.2, saw a match and said
// OK, while CI (bun 1.3.5) rejected it twice. A match only certifies CI's
// parity gate when it was produced by CI's bun.
describe("bundleMatchSeverity (v2.0.0)", () => {
  test("hash match under a different bun than CI's pin → warn, naming both versions", () => {
    const r = bundleMatchSeverity("1.4.2", "1.3.5")
    expect(r.severity).toBe("warn")
    expect(r.msg).toContain("1.4.2")
    expect(r.msg).toContain("1.3.5")
    expect(r.msg).not.toMatch(/✓/)
  })

  test("hash match under CI's bun → ok", () => {
    const r = bundleMatchSeverity("1.3.5", "1.3.5")
    expect(r.severity).toBe("ok")
    expect(r.msg).toMatch(/matches source rebuild/)
  })

  test("unknown pin or unknown local bun → ok (a match is still evidence; nothing to compare)", () => {
    expect(bundleMatchSeverity(null, "1.3.5").severity).toBe("ok")
    expect(bundleMatchSeverity("1.4.2", null).severity).toBe("ok")
  })
})
