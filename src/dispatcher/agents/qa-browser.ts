// qa.browser — real-browser e2e stub.
//
// Real qa.browser drives `plugins/sgc/browse/dist/browse` against a target
// URL, executes user flows, captures screenshots + console errors + page
// timings. MVP ships the stub (matches manifest contract) + injectable
// runner so production path can shell out to the browse binary via env.
//
// Stub verdicts:
//   - no user_flows given → concern (can't validate nothing)
//   - target_url empty → fail (setup broken)
//   - otherwise → pass (placeholder until real binary bridge)
//
// Real binary bridge: inject opts.browseRunner that spawns
// plugins/sgc/browse/dist/browse with JSON flow input and returns the
// parsed QA result. Not wired by default because chromium launch is
// environment-dependent (see plugins/sgc/browse/test failures on
// Ubuntu 23.10+ AppArmor restrictions).

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
  /** Injected by opt-in / SGC_QA_REAL=1 to shell out to browse binary. */
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
  return {
    verdict: "pass",
    evidence_refs: [],
    failed_flows: [],
  }
}
