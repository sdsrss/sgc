// `sgc land` — post-publish ship chain orchestrator.
//
// GS-7 (f10). Thin wrapper around src/dispatcher/land.ts runLand;
// translates LandResult.exitCode → process.exit.

import { runLand } from "../dispatcher/land"

export interface LandCliOptions {
  package?: string
  version?: string
  /** Test injection seam. */
  repoRoot?: string
  /** Test injection seam. */
  stateRoot?: string
  /** Test injection seam. */
  stdoutWrite?: (chunk: string) => void
  /** Test injection seam. */
  stderrWrite?: (chunk: string) => void
}

export interface LandCliResult {
  exitCode: 0 | 1
}

export async function runLandCli(
  opts: LandCliOptions = {},
): Promise<LandCliResult> {
  const result = await runLand({
    package: opts.package,
    version: opts.version,
    repoRoot: opts.repoRoot,
    stateRoot: opts.stateRoot,
    stdoutWrite: opts.stdoutWrite,
    stderrWrite: opts.stderrWrite,
  })
  return { exitCode: result.exitCode }
}
