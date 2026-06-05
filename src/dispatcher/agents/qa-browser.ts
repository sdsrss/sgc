// qa.browser — real-browser e2e stub + opt-in seam.
//
// The default qa.browser is a stub (matches the manifest contract) that never
// rubber-stamps the L2+ QA gate. The real-browser path is opt-in
// (--browse / SGC_QA_REAL=1) and backed by Playwright — see playwright-runner.ts
// (makeBrowseRunner + launchPlaywrightSession); runQa injects it as
// opts.browseRunner. Tests inject a fake browseRunner.
//
// Stub verdicts:
//   - no user_flows given → concern (can't validate nothing)
//   - target_url empty → fail (setup broken)
//   - otherwise → concern (stub mode — prevents L2+ QA gate rubber-stamp)
//
// (A non-functional gstack-derived browse binary was previously vendored under
// plugins/sgc/browse/; removed once the Playwright runner replaced it.)

export interface QaBrowserInput {
  target_url: string
  user_flows: string[]
}

export type QaVerdict = "pass" | "concern" | "fail"

export interface FailedFlow {
  flow: string
  step: string
  observed: string
}

export interface QaBrowserOutput {
  verdict: QaVerdict
  evidence_refs: string[]
  failed_flows: FailedFlow[]
}

export interface BrowseRunner {
  (input: QaBrowserInput): Promise<QaBrowserOutput>
}

export interface QaBrowserOptions {
  /** Real-browser runner injected on the opt-in path (--browse / SGC_QA_REAL=1)
   *  with a Playwright runner (see playwright-runner.ts); tests inject a fake. */
  browseRunner?: BrowseRunner
}

export async function qaBrowser(
  input: QaBrowserInput,
  opts: QaBrowserOptions = {},
): Promise<QaBrowserOutput> {
  if (opts.browseRunner) {
    return opts.browseRunner(input)
  }
  if (!input.target_url || input.target_url.trim() === "") {
    return {
      verdict: "fail",
      evidence_refs: [],
      failed_flows: [
        { flow: "(all)", step: "setup", observed: "target_url is empty" },
      ],
    }
  }
  if (!Array.isArray(input.user_flows) || input.user_flows.length === 0) {
    return {
      verdict: "concern",
      evidence_refs: [],
      failed_flows: [
        {
          flow: "(none)",
          step: "input",
          observed: "no user_flows provided — nothing to validate",
        },
      ],
    }
  }
  // Stub: no browser runner — return concern, not pass.
  // Prevents L2+ QA gate from being a rubber stamp.
  return {
    verdict: "concern",
    evidence_refs: [],
    failed_flows: [
      {
        flow: "(all)",
        step: "runner",
        observed:
          "no browser runner — real-browser QA is opt-in: pass --browse or " +
          "set SGC_QA_REAL=1 (Playwright; install a browser with " +
          "`npx playwright install chromium`). Running stub mode " +
          "(verdict: concern — gate not rubber-stamped).",
      },
    ],
  }
}
