import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  loadPlaywright,
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

  test("screenshot capture failure → surfaced as note, verdict still pass", async () => {
    const run = makeBrowseRunner({
      launch: async () => ({
        async smoke() {
          return { navOk: true, consoleErrors: [], screenshot: undefined }
        },
        async close() {},
      }),
      screenshotDir: shots(),
    })
    const r = await run({ target_url: "http://x/", user_flows: [] })
    expect(r.verdict).toBe("pass")
    expect(r.evidence_refs.length).toBe(0)
    expect(r.failed_flows.some((f) => f.step === "screenshot")).toBe(true)
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

// v2.0.1: the plugin's CLI (plugins/sgc/bin/sgc.mjs in Claude Code's plugin
// cache) has no node_modules above it, so `import("playwright")` failed there
// even when the project under test or a global npm install had Playwright,
// and `/sgc:qa <url> --browse` always reported `concern` (browser unavailable).
describe("loadPlaywright: where --browse finds Playwright", () => {
  /** A fake `playwright` package whose module.exports names where it was found. */
  function fakePlaywright(nodeModules: string, marker: string): void {
    const pkg = join(nodeModules, "playwright")
    mkdirSync(pkg, { recursive: true })
    writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "playwright", main: "index.js" }))
    writeFileSync(join(pkg, "index.js"), `module.exports = { chromium: { marker: ${JSON.stringify(marker)} } }`)
  }
  /** What `npm root -g` prints: <prefix>/lib/node_modules. */
  const globalRoot = () => join(shots(), "lib", "node_modules")
  const notNearCli = async (): Promise<never> => {
    throw new Error("Cannot find package 'playwright' imported from /plugin/bin/sgc.mjs")
  }

  test("next to the CLI first; the project and npm are not consulted", async () => {
    let asked = false
    const pw = await loadPlaywright({
      importNearCli: async () => ({ chromium: { marker: "cli" } }) as never,
      cwd: shots(),
      globalRoot: () => {
        asked = true
        return null
      },
    })
    expect((pw.chromium as unknown as { marker: string }).marker).toBe("cli")
    expect(asked).toBe(false)
  })

  test("then the project under test (cwd)", async () => {
    const project = shots()
    fakePlaywright(join(project, "node_modules"), "project")
    const pw = await loadPlaywright({ importNearCli: notNearCli, cwd: project, globalRoot: () => null })
    expect((pw.chromium as unknown as { marker: string }).marker).toBe("project")
  })

  test("then the global npm install of @sdsrs/sgc", async () => {
    const root = globalRoot()
    fakePlaywright(join(root, "@sdsrs", "sgc", "node_modules"), "global-sgc")
    const pw = await loadPlaywright({ importNearCli: notNearCli, cwd: shots(), globalRoot: () => root })
    expect((pw.chromium as unknown as { marker: string }).marker).toBe("global-sgc")
  })

  test("or a global `npm i -g playwright`", async () => {
    const root = globalRoot()
    fakePlaywright(root, "global-playwright")
    const pw = await loadPlaywright({ importNearCli: notNearCli, cwd: shots(), globalRoot: () => root })
    expect((pw.chromium as unknown as { marker: string }).marker).toBe("global-playwright")
  })

  test("nowhere → one error naming every place it looked and how to install", async () => {
    const project = shots()
    const root = shots()
    const err = await loadPlaywright({ importNearCli: notNearCli, cwd: project, globalRoot: () => root }).catch(
      (e: Error) => e,
    )
    expect(err).toBeInstanceOf(Error)
    const msg = (err as Error).message
    expect(msg).toContain(project)
    expect(msg).toContain(root)
    expect(msg).toContain("npm i -g @sdsrs/sgc")
  })
})
