// GitHub CLI bridge for `sgc ship --pr`.
//
// Spawns `gh pr create --title ... --body ...` and parses the PR URL
// from stdout. GhRunner interface is injectable so tests mock it
// without requiring the gh binary in PATH.
//
// Scope: PR creation only — no clone, no push (caller assumes the
// branch is already pushed). Matches D-dec-4 (a): ship-to-PR in
// D-phase; land-and-deploy + canary are E-phase.

export class GhRunnerError extends Error {
  constructor(
    message: string,
    public readonly stderr?: string,
    public readonly exitCode?: number,
  ) {
    super(message)
    this.name = "GhRunnerError"
  }
}

export interface PrCreateInput {
  title: string
  body: string
  draft?: boolean
}

export interface PrCreateResult {
  url: string
}

export interface GhRunner {
  createPr(input: PrCreateInput): Promise<PrCreateResult>
}

/**
 * Extract the PR URL from `gh pr create` stdout. The CLI typically
 * prints some setup lines followed by a final URL — we take the last
 * line starting with `http`.
 */
export function extractPrUrl(stdout: string): string | null {
  const lines = stdout.trim().split("\n").map((l) => l.trim())
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]!.startsWith("http")) return lines[i]!
  }
  return null
}

export const defaultGhRunner: GhRunner = {
  async createPr({ title, body, draft }) {
    const argv = ["gh", "pr", "create", "--title", title, "--body", body]
    if (draft) argv.push("--draft")
    const proc = Bun.spawn(argv, {
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    if (exitCode !== 0) {
      throw new GhRunnerError(
        `gh pr create failed (exit ${exitCode}): ${stderr.slice(0, 300)}`,
        stderr,
        exitCode,
      )
    }
    const url = extractPrUrl(stdout)
    if (!url) {
      throw new GhRunnerError(
        `gh pr create returned no URL. stdout: ${stdout.slice(0, 300)}`,
      )
    }
    return { url }
  },
}
