// Real-browser smoke: launches actual Playwright chromium against local
// fixture pages. GATED — only runs when SGC_QA_REAL=1 (so CI, which doesn't
// set it, skips). Verifies the makeBrowseRunner + launchPlaywrightSession path
// end-to-end: clean page -> pass; page that throws -> fail.
import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  makeBrowseRunner,
  launchPlaywrightSession,
} from "../../src/dispatcher/agents/playwright-runner"

const gate = process.env["SGC_QA_REAL"] === "1"
const maybe = gate ? describe : describe.skip

maybe("real-browser smoke (gated: SGC_QA_REAL=1)", () => {
  test("clean local page → pass + screenshot", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sgc-real-"))
    try {
      const page = join(dir, "clean.html")
      writeFileSync(page, "<!doctype html><title>ok</title><h1>hello</h1>")
      const run = makeBrowseRunner({ launch: launchPlaywrightSession, screenshotDir: dir })
      const r = await run({ target_url: "file://" + page, user_flows: [] })
      expect(r.verdict).toBe("pass")
      expect(r.evidence_refs.length).toBeGreaterThan(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)

  test("page with a thrown error → fail", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sgc-real-"))
    try {
      const page = join(dir, "err.html")
      writeFileSync(
        page,
        "<!doctype html><title>err</title><script>throw new Error('boom-real')</script>",
      )
      const run = makeBrowseRunner({ launch: launchPlaywrightSession, screenshotDir: dir })
      const r = await run({ target_url: "file://" + page, user_flows: [] })
      expect(r.verdict).toBe("fail")
      expect(r.failed_flows.some((f) => f.step === "console")).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
