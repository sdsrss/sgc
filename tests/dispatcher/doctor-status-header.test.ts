// Doctor check (L): plugins/sgc/CLAUDE.md status-header freshness.
// Guards the LLM-visible metadata drift that the 2026-06-08 audit found —
// the header had drifted to v1.20.0 while the package shipped v1.29.1.

import { expect, test } from "bun:test"
import { statusHeaderFreshness } from "../../src/commands/doctor"

const hdr = (v: string) => `# SGC\n\n## Implementation Status (v${v} — milestone notes)\n\nbody`

test("warns when the header version trails package.json (the audited v1.20.0 → v1.29.1 drift)", () => {
  const r = statusHeaderFreshness(hdr("1.20.0"), "1.29.1")
  expect(r.severity).toBe("warn")
  expect(r.msg).toContain("trails")
  expect(r.msg).toContain("1.20.0")
  expect(r.msg).toContain("1.29.1")
})

test("ok when header version equals package.json", () => {
  expect(statusHeaderFreshness(hdr("1.29.1"), "1.29.1").severity).toBe("ok")
})

test("ok when header version is ahead of package.json (pre-release header)", () => {
  expect(statusHeaderFreshness(hdr("1.30.0"), "1.29.1").severity).toBe("ok")
})

test("minor/patch trailing is detected, not just major", () => {
  expect(statusHeaderFreshness(hdr("1.29.0"), "1.29.1").severity).toBe("warn")
  expect(statusHeaderFreshness(hdr("1.28.9"), "1.29.1").severity).toBe("warn")
})

test("warns (does not throw) when no status header is present", () => {
  const r = statusHeaderFreshness("# SGC\n\nno header here", "1.29.1")
  expect(r.severity).toBe("warn")
  expect(r.msg).toContain("no")
})

test("warns when package.json version is unparseable", () => {
  expect(statusHeaderFreshness(hdr("1.29.1"), "garbage").severity).toBe("warn")
})

test("matches the real shipped CLAUDE.md header against the real package.json", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs")
  const { resolve } = require("node:path") as typeof import("node:path")
  const root = resolve(import.meta.dir, "..", "..")
  const claudeMd = readFileSync(resolve(root, "plugins", "sgc", "CLAUDE.md"), "utf8")
  const pkgVer = (JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string }).version
  // After the P1-1 fix the shipped header must not trail the package version.
  expect(statusHeaderFreshness(claudeMd, pkgVer).severity).toBe("ok")
})
