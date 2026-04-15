import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
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
  writeCurrentTask,
  writeFeatureList,
  writeIntent,
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
