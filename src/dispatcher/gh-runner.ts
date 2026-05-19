// GitHub CLI + git-read bridge for `sgc ship --pr`.
//
// Two responsibilities:
//   1. GhRunner — spawns `gh pr create --title ... --body ...` and parses
//      the PR URL from stdout. Injectable for tests.
//   2. UpstreamCheck — reads the current branch + its tracking ref via
//      `git rev-parse`. The ship gate uses this for F-4 fail-fast: if
//      the local branch has no upstream, abort before writing ship.md
//      so the operator can `git push -u` and retry cleanly.
//
// Scope: PR creation + git-read only — no push, no clone (those are
// caller responsibility; the fail-fast keeps that contract honest).
// Matches D-dec-4 (a): ship-to-PR in D-phase; land-and-deploy + canary
// are E-phase.

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

export interface UpstreamInfo {
  /** Current branch name, e.g. "feat/my-branch". `(HEAD detached)` if detached. */
  branch: string
  /** Tracking ref like "origin/feat/my-branch", or null when no upstream is configured. */
  upstream: string | null
}

export type UpstreamCheck = () => Promise<UpstreamInfo>

export class UpstreamCheckError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UpstreamCheckError"
  }
}

async function gitOutput(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), code }
}

/**
 * Reads the current branch + its upstream via `git rev-parse`. Runs in cwd.
 * Throws UpstreamCheckError when cwd is not a git work tree.
 * Returns `upstream: null` when the branch has no `@{upstream}` configured
 * (the F-4 fail-fast case).
 */
export const defaultUpstreamCheck: UpstreamCheck = async () => {
  const inside = await gitOutput(["rev-parse", "--is-inside-work-tree"])
  if (inside.code !== 0 || inside.stdout !== "true") {
    throw new UpstreamCheckError(
      `not inside a git work tree (cwd=${process.cwd()}); cannot ship --pr without a repo`,
    )
  }
  const branchRes = await gitOutput(["rev-parse", "--abbrev-ref", "HEAD"])
  const branch = branchRes.code === 0 ? branchRes.stdout : "(unknown)"
  const upstreamRes = await gitOutput([
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}",
  ])
  const upstream = upstreamRes.code === 0 && upstreamRes.stdout.length > 0
    ? upstreamRes.stdout
    : null
  return { branch, upstream }
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
