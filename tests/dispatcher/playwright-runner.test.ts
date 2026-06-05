import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  makeBrowseRunner,
  type BrowserSession,
  type LaunchSession,
  type SmokeResult,
} from "../../src/dispatcher/agents/playwright-runner"

const dirs: string[] = []
const shots = () => {
  const d = mkdtempSync(join(tmpdir(), "sgc-pw-"))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

/** Fake session: smoke() returns a scripted result per url; the screenshot
 *  path passed in is echoed back unless the script overrides it. */
function fakeLaunch(
  script: Record<string, SmokeResult> | ((url: string) => SmokeResult),
): LaunchSession {
  return async (): Promise<BrowserSession> => ({
    async smoke(url, screenshotPath) {
      const r =
        typeof script === "function"
          ? script(url)
          : (script[url] ?? { navOk: true, consoleErrors: [] })
      return { ...r, screenshot: r.screenshot ?? screenshotPath }
    },
    async close() {},
  })
}

describe("playwright makeBrowseRunner", () => {
  test("empty target_url → fail, without launching a browser", async () => {
    let launched = false
    const run = makeBrowseRunner({
      launch: async () => {
        launched = true
        return { async smoke() { return { navOk: true, consoleErrors: [] } }, async close() {} }
      },
      screenshotDir: shots(),
    })
    const r = await run({ target_url: "", user_flows: [] })
    expect(r.verdict).toBe("fail")
    expect(r.failed_flows[0]?.observed).toMatch(/empty/)
    expect(launched).toBe(false)
  })

  test("clean smoke → pass + screenshot evidence", async () => {
    const run = makeBrowseRunner({
      launch: fakeLaunch({ "http://x/": { navOk: true, consoleErrors: [] } }),
      screenshotDir: shots(),
    })
    const r = await run({ target_url: "http://x/", user_flows: [] })
    expect(r.verdict).toBe("pass")
    expect(r.evidence_refs.length).toBe(1)
    expect(r.failed_flows.length).toBe(0)
  })

  test("console/page error → fail with the error text", async () => {
    const run = makeBrowseRunner({
      launch: fakeLaunch({ "http://x/": { navOk: true, consoleErrors: ["pageerror: boom-xyz"] } }),
      screenshotDir: shots(),
    })
    const r = await run({ target_url: "http://x/", user_flows: [] })
    expect(r.verdict).toBe("fail")
    expect(r.failed_flows.some((f) => f.step === "console" && /boom-xyz/.test(f.observed))).toBe(true)
  })

  test("nav failure → fail (goto)", async () => {
    const run = makeBrowseRunner({
      launch: fakeLaunch({ "http://x/": { navOk: false, navError: "net::ERR_CONNECTION_REFUSED", consoleErrors: [] } }),
      screenshotDir: shots(),
    })
    const r = await run({ target_url: "http://x/", user_flows: [] })
    expect(r.verdict).toBe("fail")
    expect(r.failed_flows[0]?.step).toBe("goto")
  })

  test("launch throws (playwright missing / browser not installed) → concern, never pass", async () => {
    const run = makeBrowseRunner({
      launch: async () => {
        throw new Error("Cannot find package 'playwright'")
      },
      screenshotDir: shots(),
    })
    const r = await run({ target_url: "http://x/", user_flows: ["/a"] })
    expect(r.verdict).toBe("concern")
    expect(r.failed_flows[0]?.observed).toMatch(/browser unavailable/)
  })

  test("path-like flow navigated; prose flow recorded as note; verdict pass", async () => {
    const seen: string[] = []
    const run = makeBrowseRunner({
      launch: async () => ({
        async smoke(url, sp) {
          seen.push(url)
          return { navOk: true, consoleErrors: [], screenshot: sp }
        },
        async close() {},
      }),
      screenshotDir: shots(),
    })
    const r = await run({ target_url: "http://localhost:3000", user_flows: ["/dashboard", "login"] })
    expect(seen).toContain("http://localhost:3000/dashboard")
    expect(seen).not.toContain("login")
    expect(r.failed_flows.some((f) => f.step === "note" && f.flow === "login")).toBe(true)
    expect(r.verdict).toBe("pass")
  })

  test("multi-target mixed: first clean, second nav-fail → fail; first screenshot kept", async () => {
    const run = makeBrowseRunner({
      launch: fakeLaunch((url) =>
        url.endsWith("/b")
          ? { navOk: false, navError: "boom", consoleErrors: [] }
          : { navOk: true, consoleErrors: [] },
      ),
      screenshotDir: shots(),
    })
    const r = await run({ target_url: "http://a/", user_flows: ["http://a/b"] })
    expect(r.verdict).toBe("fail")
    expect(r.failed_flows.some((f) => f.step === "goto")).toBe(true)
    expect(r.evidence_refs.length).toBeGreaterThanOrEqual(1) // first target produced a screenshot
  })

  test("session.close() is always called", async () => {
    let closed = false
    const run = makeBrowseRunner({
      launch: async () => ({
        async smoke(_u, sp) { return { navOk: true, consoleErrors: [], screenshot: sp } },
        async close() { closed = true },
      }),
      screenshotDir: shots(),
    })
    await run({ target_url: "http://x/", user_flows: [] })
    expect(closed).toBe(true)
  })
})
