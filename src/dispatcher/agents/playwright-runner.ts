// src/dispatcher/agents/playwright-runner.ts
//
// Real-browser QA smoke backed by Playwright (in-process). Opt-in via
// SGC_QA_REAL=1 / --browse; the default qa.browser path stays the stub.
//
// Per navigation target: open a page, listen for pageerror + console.error,
// goto(waitUntil:"load"), screenshot. Verdict: nav failure / HTTP>=400 -> fail;
// console/page errors -> fail; clean load -> pass; browser/playwright
// unavailable -> concern (NEVER false-pass). Prose flows (not a URL/path) are
// recorded as labels, not navigated (no LLM to synthesize clicks).
//
// `playwright` is a dependency of sgc and is --external in the bundle, so the
// dynamic import resolves at runtime from node_modules; if it (or a browser)
// is missing the launch throws and we degrade to `concern`.
import { join } from "node:path"
import type {
  BrowseRunner,
  FailedFlow,
  QaBrowserInput,
  QaBrowserOutput,
  QaVerdict,
} from "./qa-browser"

export interface SmokeResult {
  navOk: boolean
  navError?: string
  consoleErrors: string[]
  screenshot?: string
}

export interface BrowserSession {
  smoke(url: string, screenshotPath: string): Promise<SmokeResult>
  close(): Promise<void>
}

/** Launches a browser and returns a reusable session. Throws when Playwright
 *  or a browser binary is unavailable (caught by makeBrowseRunner -> concern). */
export type LaunchSession = () => Promise<BrowserSession>

function firstLine(s: string): string {
  return (s.split("\n").find((l) => l.trim().length > 0) ?? "").trim()
}

function safeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "target"
}

function joinUrl(base: string, path: string): string {
  try {
    return new URL(path, base).toString()
  } catch {
    return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "")
  }
}

interface NavTarget {
  label: string
  url: string
}

function planTargets(input: QaBrowserInput): { targets: NavTarget[]; prose: string[] } {
  const targets: NavTarget[] = [{ label: "(target)", url: input.target_url }]
  const prose: string[] = []
  for (const f of input.user_flows) {
    if (/^https?:\/\//i.test(f)) targets.push({ label: f, url: f })
    else if (f.startsWith("/")) targets.push({ label: f, url: joinUrl(input.target_url, f) })
    else prose.push(f)
  }
  return { targets, prose }
}

export function makeBrowseRunner(opts: {
  launch: LaunchSession
  screenshotDir: string
}): BrowseRunner {
  const { launch, screenshotDir } = opts
  return async (input: QaBrowserInput): Promise<QaBrowserOutput> => {
    if (!input.target_url || input.target_url.trim() === "") {
      return {
        verdict: "fail",
        evidence_refs: [],
        failed_flows: [
          {
            flow: "(all)",
            step: "setup",
            observed:
              "target_url is empty — pass the URL as a positional argument: " +
              "`sgc qa <url> --flows <a,b>` (it is positional, not `--target`)",
          },
        ],
      }
    }

    let session: BrowserSession
    try {
      session = await launch()
    } catch (e) {
      // Playwright missing, browser not installed, or launch failed — the gate
      // could not run, so concern (never false-pass).
      return {
        verdict: "concern",
        evidence_refs: [],
        failed_flows: [
          {
            flow: "(all)",
            step: "launch",
            observed: `browser unavailable: ${firstLine((e as Error)?.message ?? String(e))}`,
          },
        ],
      }
    }

    const { targets, prose } = planTargets(input)
    const evidence_refs: string[] = []
    const failed_flows: FailedFlow[] = []
    let navOk = 0

    try {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i]!
        const shot = join(screenshotDir, `qa-${i}-${safeLabel(t.label)}.png`)
        const r = await session.smoke(t.url, shot)
        if (r.screenshot) evidence_refs.push(r.screenshot)
        if (!r.navOk) {
          failed_flows.push({
            flow: t.label,
            step: "goto",
            observed: `navigation failed: ${firstLine(r.navError ?? "unknown")}`,
          })
          continue
        }
        navOk++
        for (const e of r.consoleErrors) {
          failed_flows.push({ flow: t.label, step: "console", observed: e })
        }
        if (!r.screenshot) {
          failed_flows.push({
            flow: t.label,
            step: "screenshot",
            observed: "screenshot capture failed (evidence omitted)",
          })
        }
      }
    } finally {
      try {
        await session.close()
      } catch {
        // best-effort teardown
      }
    }

    const notes: FailedFlow[] = prose.map((f) => ({
      flow: f,
      step: "note",
      observed: "recorded as label; not individually navigated (no path/URL)",
    }))

    // Only goto/console failures count toward the verdict; screenshot misses
    // and prose notes are surfaced but do not flip pass->fail.
    const realFailures = failed_flows.filter((f) => f.step === "goto" || f.step === "console")
    const verdict: QaVerdict = navOk === 0 || realFailures.length > 0 ? "fail" : "pass"

    return { verdict, evidence_refs, failed_flows: [...failed_flows, ...notes] }
  }
}

/** Production launcher: dynamic-import Playwright and launch chromium. Set
 *  SGC_QA_BROWSER=chrome to use the system Chrome channel (no playwright
 *  browser download). chromiumSandbox:false handles Ubuntu 23.10+ AppArmor. */
export async function launchPlaywrightSession(
  env: NodeJS.ProcessEnv = process.env,
): Promise<BrowserSession> {
  const pw = (await import("playwright")) as typeof import("playwright")
  const channel = env["SGC_QA_BROWSER"] === "chrome" ? "chrome" : undefined
  const browser = await pw.chromium.launch({
    headless: true,
    chromiumSandbox: false,
    ...(channel ? { channel } : {}),
  })
  const context = await browser.newContext()
  return {
    async smoke(url, screenshotPath) {
      const page = await context.newPage()
      const consoleErrors: string[] = []
      page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`))
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(`console.error: ${m.text()}`)
      })
      let navOk = true
      let navError: string | undefined
      try {
        const resp = await page.goto(url, { waitUntil: "load", timeout: 30_000 })
        if (resp && resp.status() >= 400) {
          navOk = false
          navError = `HTTP ${resp.status()}`
        }
      } catch (e) {
        navOk = false
        navError = (e as Error)?.message ?? String(e)
      }
      await page.waitForTimeout(150) // settle + let late console errors flush
      // Screenshot is best-effort evidence; retry once to absorb cold-start flake.
      let screenshot: string | undefined
      for (let attempt = 0; attempt < 2 && !screenshot; attempt++) {
        if (attempt > 0) await page.waitForTimeout(200)
        try {
          await page.screenshot({ path: screenshotPath })
          screenshot = screenshotPath
        } catch {
          // best-effort; retried once, then give up (verdict still stands)
        }
      }
      await page.close()
      return { navOk, navError, consoleErrors, screenshot }
    },
    async close() {
      try {
        await browser.close()
      } catch {
        // best-effort
      }
    },
  }
}
