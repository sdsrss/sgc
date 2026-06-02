// CE-3 promote (sibling spec tasks/specs/ce-3-promote-helper.md) —
// promoteShipFailure tests. RED-first: all of these fail before the
// new module exists; they pin Invariant §3 + idempotency semantics.

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  promoteShipFailure,
  PromoteError,
} from "../../src/dispatcher/compound-promote"
import {
  ensureSgcStructure,
  parseFrontmatter,
  serializeFrontmatter,
  writeSolution,
} from "../../src/dispatcher/state"
import { computeSignature } from "../../src/dispatcher/dedup"
import type { DedupStamp, SolutionEntry } from "../../src/dispatcher/types"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-promote-"))
  ensureSgcStructure(stateRoot)
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

// ── fixtures ────────────────────────────────────────────────────────────────

interface ShipFailureFixture {
  slug?: string
  prevention_seed?: string
  promoted_to?: string
  workflow_name?: string
  commit_sha?: string
  summary?: string
}

/**
 * Write a `<stateRoot>/ship-failures/<slug>.md` mirroring the shape
 * produced by captureShipFailure but parameterized for test control.
 * Defaults are valid for happy-path promote (prevention_seed edited).
 */
function writeShipFailureFixture(opts: ShipFailureFixture = {}): {
  slug: string
  path: string
} {
  const slug = opts.slug ?? "2026-05-22-9c8bc57"
  const dir = join(stateRoot, "ship-failures")
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${slug}.md`)
  const fm: Record<string, unknown> = {
    kind: "ship-failure",
    captured_at: "2026-05-22T12:00:00.000Z",
    commit_sha: opts.commit_sha ?? "9c8bc57aabbccddeeff112233445566778899aabb",
    tag: "v1.5.0",
    workflow_run_id: "26273501194",
    workflow_run_url:
      "https://github.com/sdsrss/sgc/actions/runs/26273501194",
    workflow_name: opts.workflow_name ?? "publish-npm",
    conclusion: "failure",
    prevention_seed:
      opts.prevention_seed ??
      "On publish failure, re-run with --verbose and copy the failing-step output before retrying.",
  }
  if (opts.promoted_to !== undefined) {
    fm["promoted_to"] = opts.promoted_to
  }
  const body = [
    "## Failure context",
    "",
    `- workflow: ${fm["workflow_name"]}`,
    `- run id:   ${fm["workflow_run_id"]}`,
    "",
    "## $GITHUB_STEP_SUMMARY excerpt",
    "",
    opts.summary ?? "FAIL tests/publish > version-mismatch",
    "",
    "## Next steps for operator",
    "",
    "- Investigate the failing step.",
    "",
  ].join("\n")
  writeFileSync(path, serializeFrontmatter(fm, body), "utf8")
  return { slug, path }
}

const OK_STAMP: DedupStamp = {
  compound_related_spawn_id: "01TESTSTAMP0000000000-compound.related",
  threshold_met_or_forced: true,
  reason: "new_entry",
}

function seedExistingSolutionWithSameProblem(problem: string): void {
  // Signature equality wins inside similarity() — pin the seed signature
  // to computeSignature(problem) so the promote helper's candidate
  // (computed from the same problem string) collides at score 1.0
  // regardless of tag jaccard. This isolates the dedup-test from
  // category/tag heuristic drift.
  const entry: SolutionEntry = {
    id: "01HEXISTING0000000000000000",
    signature: computeSignature(problem),
    category: "other",
    problem,
    symptoms: ["matches the to-be-promoted record"],
    what_didnt_work: [],
    solution: "(seeded)",
    prevention: "(seeded prevention text)",
    tags: ["untagged"],
    first_seen: "2026-05-22T00:00:00Z",
    last_updated: "2026-05-22T00:00:00Z",
    times_referenced: 0,
    source_task_ids: ["01HOLDTASK000000000000000"],
  }
  writeSolution(entry, "seeded-duplicate", OK_STAMP, "", stateRoot)
}

// ── tests ────────────────────────────────────────────────────────────────

describe("promoteShipFailure — error paths", () => {
  it("missing ship-failure file → PromoteError MissingShipFailure", async () => {
    await expect(
      promoteShipFailure({ slug: "does-not-exist", stateRoot }),
    ).rejects.toMatchObject({
      code: "MissingShipFailure",
    })
  })

  it("placeholder prevention_seed (TODO: operator-fill) → PromoteError PlaceholderPreventionSeed", async () => {
    writeShipFailureFixture({
      prevention_seed:
        "TODO: operator-fill; captured failure of publish-npm at 9c8bc57. Convert via `sgc compound`.",
    })
    await expect(
      promoteShipFailure({ slug: "2026-05-22-9c8bc57", stateRoot }),
    ).rejects.toMatchObject({
      code: "PlaceholderPreventionSeed",
    })
  })

  it("already-promoted (promoted_to: set) → PromoteError AlreadyPromoted", async () => {
    writeShipFailureFixture({
      promoted_to: "build/some-earlier-slug",
    })
    await expect(
      promoteShipFailure({ slug: "2026-05-22-9c8bc57", stateRoot }),
    ).rejects.toMatchObject({
      code: "AlreadyPromoted",
    })
  })

  it("dedup match with no --force → PromoteError DuplicateMatch; no solutions/ write; no ship-failure mutation", async () => {
    const fix = writeShipFailureFixture({
      summary: "PUBLISH FAILURE: npm 401 unauthorized",
    })
    const fileBefore = readFileSync(fix.path, "utf8")
    // Seed an existing solution whose `problem` field matches the
    // problem_summary that compoundContextHeuristic will derive from
    // the ship-failure intent payload. The promote helper hands
    // `<summary>\n\n<workflow_name>` (the spec-locked input shape) to
    // compoundContextHeuristic; problem_summary = input.slice(0,400).
    seedExistingSolutionWithSameProblem(
      "PUBLISH FAILURE: npm 401 unauthorized\n\npublish-npm",
    )
    await expect(
      promoteShipFailure({ slug: fix.slug, stateRoot }),
    ).rejects.toMatchObject({ code: "DuplicateMatch" })
    // File-level invariants on the refuse path:
    expect(readFileSync(fix.path, "utf8")).toBe(fileBefore)
  })
})

describe("promoteShipFailure — happy path", () => {
  it("writes new solution + mutates ship-failure with promoted_to; dedupAction=new_entry", async () => {
    const fix = writeShipFailureFixture({
      summary: "FRESH FAILURE: no prior corpus collisions here",
      prevention_seed:
        "Run `bun test` locally before tagging; surface manifest-sync failures pre-push.",
    })
    const r = await promoteShipFailure({ slug: fix.slug, stateRoot })
    expect(r.dedupAction).toBe("new_entry")
    expect(r.shipFailurePath).toBe(fix.path)
    expect(r.solutionPath).toMatch(/solutions\/.+\.md$/)
    // Solution landed on disk.
    expect(existsSync(r.solutionPath)).toBe(true)
    // Solution's prevention field is the operator's edited seed.
    const sol = parseFrontmatter<SolutionEntry>(
      readFileSync(r.solutionPath, "utf8"),
    )
    expect(sol.data.prevention).toContain(
      "Run `bun test` locally before tagging",
    )
    // Ship-failure file gained `promoted_to:` pointing at the solution
    // ref (category/slug, NOT absolute path — corpus-portable).
    const sf = parseFrontmatter<Record<string, unknown>>(
      readFileSync(fix.path, "utf8"),
    )
    expect(typeof sf.data["promoted_to"]).toBe("string")
    const promotedRef = sf.data["promoted_to"] as string
    expect(promotedRef.split("/").length).toBe(2) // <category>/<slug>
    expect(r.solutionPath).toContain(`/${promotedRef}.md`)
  })
})

describe("promoteShipFailure — --force semantics", () => {
  it("--force bypasses DuplicateMatch refuse → writes new entry; dedupAction=user_forced", async () => {
    const fix = writeShipFailureFixture({
      summary: "PUBLISH FAILURE: npm 401 unauthorized",
    })
    seedExistingSolutionWithSameProblem(
      "PUBLISH FAILURE: npm 401 unauthorized\n\npublish-npm",
    )
    const r = await promoteShipFailure({
      slug: fix.slug,
      stateRoot,
      force: true,
    })
    expect(r.dedupAction).toBe("user_forced")
    expect(existsSync(r.solutionPath)).toBe(true)
    // promoted_to: stamped even on forced write.
    const sf = parseFrontmatter<Record<string, unknown>>(
      readFileSync(fix.path, "utf8"),
    )
    expect(typeof sf.data["promoted_to"]).toBe("string")
  })

  it("--force does NOT bypass AlreadyPromoted (orthogonal guard)", async () => {
    writeShipFailureFixture({
      promoted_to: "build/some-earlier-slug",
    })
    await expect(
      promoteShipFailure({
        slug: "2026-05-22-9c8bc57",
        stateRoot,
        force: true,
      }),
    ).rejects.toMatchObject({ code: "AlreadyPromoted" })
  })
})

describe("PromoteError shape", () => {
  it("is an Error subclass with readonly .code", async () => {
    try {
      await promoteShipFailure({ slug: "x", stateRoot })
      throw new Error("expected promoteShipFailure to reject")
    } catch (err) {
      expect(err).toBeInstanceOf(PromoteError)
      expect(err).toBeInstanceOf(Error)
      expect((err as PromoteError).code).toBe("MissingShipFailure")
    }
  })
})

// ── TDD-ledger red-green promote (Phase 2a) ──────────────────────────────────

function writeRedGreenFixture(root: string, slug: string, seed: string): void {
  ensureSgcStructure(root)
  const dir = join(root, "red-green")
  mkdirSync(dir, { recursive: true })
  const fm = [
    "---",
    "kind: red-green",
    "captured_at: 2026-06-02T00:00:00.000Z",
    "task_id: T-ABCD1234",
    "feature_id: f1",
    "level: 2",
    "prior_red: tests/orders.test.ts::coupon_once",
    "red_output: expected 90.00 got 100.00",
    "verify_command: bun test orders",
    `prevention_seed: ${seed}`,
    "---",
    "## RED→GREEN",
    "",
  ].join("\n")
  writeFileSync(join(dir, `${slug}.md`), fm, "utf8")
}

describe("promoteRedGreen (--from-red-green)", () => {
  it("promotes a filled capture into a solution + writes promoted_to back", async () => {
    const root = mkdtempSync(join(tmpdir(), "sgc-rg-promote-"))
    writeRedGreenFixture(
      root,
      "coupon-bug-t-abcd1",
      "Apply coupon exactly once; assert idempotent subtract.",
    )
    const { runRedGreenPromote } = await import("../../src/commands/compound")
    const res = await runRedGreenPromote({ slug: "coupon-bug-t-abcd1", stateRoot: root })
    expect(res.solutionPath).toContain("solutions")
    expect(existsSync(res.solutionPath)).toBe(true)
    const after = readFileSync(join(root, "red-green", "coupon-bug-t-abcd1.md"), "utf8")
    expect(after).toContain("promoted_to:")
    rmSync(root, { recursive: true, force: true })
  })

  it("refuses an unfilled prevention_seed placeholder", async () => {
    const root = mkdtempSync(join(tmpdir(), "sgc-rg-ph-"))
    writeRedGreenFixture(root, "ph-t-abcd1", "TODO: operator-fill the reusable prevention")
    const { runRedGreenPromote } = await import("../../src/commands/compound")
    await expect(
      runRedGreenPromote({ slug: "ph-t-abcd1", stateRoot: root }),
    ).rejects.toThrow(/placeholder|prevention_seed/i)
    rmSync(root, { recursive: true, force: true })
  })

  it("is idempotent — re-promote refuses (AlreadyPromoted)", async () => {
    const root = mkdtempSync(join(tmpdir(), "sgc-rg-rerun-"))
    writeRedGreenFixture(root, "rerun-t-abcd1", "Lock the row before the coupon subtract.")
    const { runRedGreenPromote } = await import("../../src/commands/compound")
    await runRedGreenPromote({ slug: "rerun-t-abcd1", stateRoot: root })
    await expect(
      runRedGreenPromote({ slug: "rerun-t-abcd1", stateRoot: root }),
    ).rejects.toThrow(/already|promoted_to/i)
    rmSync(root, { recursive: true, force: true })
  })

  it("rejects a missing capture with MissingRedGreen", async () => {
    const root = mkdtempSync(join(tmpdir(), "sgc-rg-missing-"))
    ensureSgcStructure(root)
    const { runRedGreenPromote } = await import("../../src/commands/compound")
    try {
      await runRedGreenPromote({ slug: "nope", stateRoot: root })
      throw new Error("expected rejection")
    } catch (err) {
      expect(err).toBeInstanceOf(PromoteError)
      expect((err as PromoteError).code).toBe("MissingRedGreen")
    }
    rmSync(root, { recursive: true, force: true })
  })
})
