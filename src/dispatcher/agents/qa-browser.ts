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
//   - otherwise → concern (stub mode — prevents L2+ QA gate rubber-stamp)
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
  /** Programmatic seam to shell out to the browse binary. The SGC_QA_REAL /
   * --browse opt-in named in the comments above is reserved but not yet wired —
   * today only tests inject this; production `runQa` never constructs one. */
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
          "no browser runner — real-browser QA is not yet wired (the " +
          "SGC_QA_REAL / --browse opt-in is reserved, not active). Use " +
          "gs:/browse for real-browser QA. Running stub mode " +
          "(verdict: concern — gate not rubber-stamped).",
      },
    ],
  }
}
