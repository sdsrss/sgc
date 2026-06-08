import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  StateError,
  appendReview,
  ensureSgcStructure,
  parseFrontmatter,
  readCurrentTask,
  readFeatureList,
  readIntent,
  readReview,
  serializeFrontmatter,
  writeAtomic,
  writeCurrentTask,
  writeFeatureList,
  writeIntent,
  writePlanDoc,
  writeShip,
} from "../../src/dispatcher/state"
import type { IntentDoc, ReviewReport, ShipDoc } from "../../src/dispatcher/types"

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-state-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const TASK_ID = "01HXXXXXXXXXXXXXXXXXXXXXXX"

function makeIntent(overrides: Partial<IntentDoc> = {}): IntentDoc {
  return {
    task_id: TASK_ID,
    level: "L1",
    created_at: "2026-04-15T10:00:00Z",
    title: "Test task",
    motivation: "Sufficient motivation text describing this work to satisfy schema requirements which mandate twenty words minimum so this string is comfortably longer than the threshold for validation purposes",
    affected_readers: ["alice"],
    scope_tokens: ["read:decisions", "write:progress"],
    ...overrides,
  }
}

function makeReview(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    report_id: "01HZZZZZZZZZZZZZZZZZZZZZZZ",
    task_id: TASK_ID,
    stage: "code",
    reviewer_id: "reviewer.correctness",
    reviewer_version: "0.1",
    verdict: "pass",
    severity: "none",
    findings: [],
    created_at: "2026-04-15T10:30:00Z",
    ...overrides,
  }
}

describe("ensureSgcStructure", () => {
  test("creates 4 layers", () => {
    const r = ensureSgcStructure(tmp)
    expect(r).toBe(tmp)
    const { existsSync } = require("node:fs")
    for (const layer of ["decisions", "progress", "solutions", "reviews"]) {
      expect(existsSync(join(tmp, layer))).toBe(true)
    }
  })
})

describe("frontmatter round-trip", () => {
  test("parse + serialize round-trips data", () => {
    const data = { task_id: "01H", level: "L2", tags: ["a", "b"] }
    const text = serializeFrontmatter(data, "# Body\n\nHello.")
    const parsed = parseFrontmatter<typeof data>(text)
    expect(parsed.data).toEqual(data)
    expect(parsed.body).toBe("# Body\n\nHello.")
  })
  test("parseFrontmatter throws on missing fence", () => {
    expect(() => parseFrontmatter("plain markdown")).toThrow(StateError)
  })
  test("parseFrontmatter with source names the file + recovery hint (crash recovery)", () => {
    // A truncated/partially-written state file must produce an actionable
    // error, not a context-free "file missing YAML frontmatter".
    expect(() =>
      parseFrontmatter("---\nhalf written no close", "/x/.sgc/progress/current-task.md"),
    ).toThrow(/current-task\.md.*regenerable runtime state/s)
  })
  test("readCurrentTask on a corrupt file names the path", () => {
    const ctPath = join(tmp, "progress", "current-task.md")
    mkdirSync(join(tmp, "progress"), { recursive: true })
    writeFileSync(ctPath, "---\ntruncated frontmatter no closing fence")
    expect(() => readCurrentTask(tmp)).toThrow(/current-task\.md/)
  })
})

describe("intent.md — Invariant §2 (immutable)", () => {
  test("write + read round-trip", () => {
    ensureSgcStructure(tmp)
    writeIntent(makeIntent(), tmp)
    const read = readIntent(TASK_ID, tmp)
    expect(read.task_id).toBe(TASK_ID)
    expect(read.affected_readers).toEqual(["alice"])
  })
  test("second write throws IntentImmutable", () => {
    ensureSgcStructure(tmp)
    writeIntent(makeIntent(), tmp)
    expect(() => writeIntent(makeIntent({ title: "Mutated" }), tmp)).toThrow(StateError)
  })
  test("missing affected_readers throws SchemaViolation", () => {
    ensureSgcStructure(tmp)
    expect(() => writeIntent(makeIntent({ affected_readers: [] }), tmp)).toThrow(StateError)
  })
  test("motivation <20 words throws SchemaViolation (audit C3 fix)", () => {
    ensureSgcStructure(tmp)
    expect(() =>
      writeIntent(makeIntent({ motivation: "too short rationale text" }), tmp),
    ).toThrow(/≥20 words/)
  })
  test("L3 without user_signature throws", () => {
    ensureSgcStructure(tmp)
    expect(() => writeIntent(makeIntent({ level: "L3" }), tmp)).toThrow(StateError)
  })
  test("L3 with user_signature succeeds", () => {
    ensureSgcStructure(tmp)
    const signed = makeIntent({
      level: "L3",
      user_signature: { signed_at: "2026-04-15T11:00:00Z", signer_id: "alice" },
    })
    expect(() => writeIntent(signed, tmp)).not.toThrow()
  })
})

describe("ship.md", () => {
  test("write + read", () => {
    ensureSgcStructure(tmp)
    const ship: ShipDoc = {
      task_id: TASK_ID,
      shipped_at: "2026-04-15T12:00:00Z",
      outcome: "success",
      deviations: [],
      residuals: [],
      linked_reviews: ["report-id-1"],
    }
    writeShip(ship, "# Ship body", tmp)
  })
  test("outcome=reverted without rollback_ref throws", () => {
    ensureSgcStructure(tmp)
    expect(() =>
      writeShip(
        {
          task_id: TASK_ID,
          shipped_at: "2026-04-15T12:00:00Z",
          outcome: "reverted",
          deviations: [],
          residuals: [],
          linked_reviews: [],
        },
        "",
        tmp,
      ),
    ).toThrow(StateError)
  })
})

describe("progress files (mutable)", () => {
  test("current-task: write twice, second wins", () => {
    ensureSgcStructure(tmp)
    writeCurrentTask(
      {
        task_id: "01H_old",
        level: "L1",
        session_start: "2026-04-15T10:00:00Z",
        last_activity: "2026-04-15T10:00:00Z",
      },
      "",
      tmp,
    )
    writeCurrentTask(
      {
        task_id: "01H_new",
        level: "L2",
        session_start: "2026-04-15T11:00:00Z",
        last_activity: "2026-04-15T11:30:00Z",
      },
      "",
      tmp,
    )
    const ct = readCurrentTask(tmp)
    expect(ct?.task.task_id).toBe("01H_new")
    expect(ct?.task.level).toBe("L2")
  })
  test("readCurrentTask returns null when missing", () => {
    ensureSgcStructure(tmp)
    expect(readCurrentTask(tmp)).toBeNull()
  })
  test("feature-list round-trips", () => {
    ensureSgcStructure(tmp)
    writeFeatureList(
      {
        features: [
          { id: "f1", title: "A", status: "pending" },
          { id: "f2", title: "B", status: "in_progress", depends_on: ["f1"] },
        ],
      },
      "",
      tmp,
    )
    const r = readFeatureList(tmp)
    expect(r?.list.features.length).toBe(2)
    expect(r?.list.features[1]?.depends_on).toEqual(["f1"])
  })
})

describe("intent fused_verdict field", () => {
  test("accepts a valid fused_verdict and round-trips it", () => {
    ensureSgcStructure(tmp)
    const intent = makeIntent({ fused_verdict: "revise" })
    writeIntent(intent, tmp)
    expect(readIntent(TASK_ID, tmp).fused_verdict).toBe("revise")
  })
  test("rejects an out-of-enum fused_verdict", () => {
    ensureSgcStructure(tmp)
    const intent = makeIntent({ fused_verdict: "maybe" as unknown as IntentDoc["fused_verdict"] })
    expect(() => writeIntent(intent, tmp)).toThrow(/fused_verdict/)
  })
  test("pre-GS-3 intent without fused_verdict still validates", () => {
    ensureSgcStructure(tmp)
    const intent = makeIntent()
    expect(intent.fused_verdict).toBeUndefined()
    expect(() => writeIntent(intent, tmp)).not.toThrow()
  })
})

describe("reviews — append-only per (task, stage, reviewer)", () => {
  test("append succeeds + read", () => {
    ensureSgcStructure(tmp)
    appendReview(makeReview(), "# Review body", tmp)
    const r = readReview(TASK_ID, "code", "reviewer.correctness", tmp)
    expect(r?.report.verdict).toBe("pass")
  })
  test("second append for same triple throws AppendOnly", () => {
    ensureSgcStructure(tmp)
    appendReview(makeReview(), "", tmp)
    expect(() => appendReview(makeReview(), "", tmp)).toThrow(StateError)
  })
  test("different stage allowed", () => {
    ensureSgcStructure(tmp)
    appendReview(makeReview({ stage: "code" }), "", tmp)
    expect(() => appendReview(makeReview({ stage: "qa" }), "", tmp)).not.toThrow()
  })
  test("different reviewer allowed", () => {
    ensureSgcStructure(tmp)
    appendReview(makeReview({ reviewer_id: "reviewer.correctness" }), "", tmp)
    expect(() =>
      appendReview(makeReview({ reviewer_id: "reviewer.security" }), "", tmp),
    ).not.toThrow()
  })
  test("override.reason <40 chars throws (Invariant §5)", () => {
    ensureSgcStructure(tmp)
    expect(() =>
      appendReview(
        makeReview({
          verdict: "fail",
          override: { by: "alice", at: "2026-04-15T10:00:00Z", reason: "ok" },
        }),
        "",
        tmp,
      ),
    ).toThrow(StateError)
  })
  test("override.reason ≥40 chars accepted", () => {
    ensureSgcStructure(tmp)
    expect(() =>
      appendReview(
        makeReview({
          verdict: "fail",
          override: {
            by: "alice",
            at: "2026-04-15T10:00:00Z",
            reason: "explicit override after manual verification of behavior",
          },
        }),
        "",
        tmp,
      ),
    ).not.toThrow()
  })
})

describe("writeAtomic (STAB-4: tmp cleanup + collision-safe naming)", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-atomic-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("writes content atomically and leaves no tmp residue", () => {
    const target = join(tmp, "ok.txt")
    writeAtomic(target, "hello")
    expect(readFileSync(target, "utf8")).toBe("hello")
    expect(readdirSync(tmp).filter((f) => f.includes(".tmp."))).toEqual([])
  })

  test("cleans up tmp file when rename fails (target is a directory)", () => {
    // renameSync(file, existingDir) throws EISDIR; tmp must not leak.
    const target = join(tmp, "collide")
    mkdirSync(target)
    expect(() => writeAtomic(target, "content")).toThrow()
    const residue = readdirSync(tmp).filter((f) => f.includes(".tmp."))
    expect(residue).toEqual([])
  })

  test("two successive writes to same path do not collide on tmp name", () => {
    // Pre-fix tmp name was `${path}.tmp.${pid}.${Date.now()}` — two writes in
    // the same millisecond produced the same tmp path. Successive writes must
    // each land cleanly with the latest content and no residue.
    const target = join(tmp, "rapid.txt")
    for (let i = 0; i < 50; i++) writeAtomic(target, `v${i}`)
    expect(readFileSync(target, "utf8")).toBe("v49")
    expect(readdirSync(tmp).filter((f) => f.includes(".tmp."))).toEqual([])
  })
})

import type { FeatureList } from "../../src/dispatcher/types"

test("feature-list round-trips files/steps/prior_art_refs", () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-state-deep-"))
  ensureSgcStructure(root)
  const list: FeatureList = {
    features: [
      {
        id: "f1",
        title: "add cursor pagination",
        status: "pending",
        files: { create: ["src/page.ts"], modify: ["src/api.ts"], test: ["tests/page.test.ts"] },
        steps: [
          { kind: "test", text: "write failing test" },
          { kind: "verify-red", text: "run it", run: "bun test", expect: "FAIL" },
          { kind: "guard", text: "guard against off-by-one" },
        ],
        prior_art_refs: ["perf/pagination-cursor"],
      },
    ],
  }
  writeFeatureList(list, "", root)
  const back = readFeatureList(root)
  expect(back).not.toBeNull()
  const f = back!.list.features[0]!
  expect(f.files).toEqual({ create: ["src/page.ts"], modify: ["src/api.ts"], test: ["tests/page.test.ts"] })
  expect(f.steps).toHaveLength(3)
  expect(f.steps![1]).toEqual({ kind: "verify-red", text: "run it", run: "bun test", expect: "FAIL" })
  expect(f.prior_art_refs).toEqual(["perf/pagination-cursor"])
})

test("writePlanDoc writes under docs/superpowers/plans relative to base", () => {
  const root = mkdtempSync(join(tmpdir(), "sgc-plandoc-"))
  const p = writePlanDoc("native-deep-planning", "2026-06-03", "# Plan\n", root)
  expect(p).toContain("docs/superpowers/plans/2026-06-03-native-deep-planning.md")
  expect(existsSync(p)).toBe(true)
  expect(readFileSync(p, "utf8")).toBe("# Plan\n")
})
