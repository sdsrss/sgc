import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runLand, defaultStepRunners } from "../../src/dispatcher/land"
import type {
  CanaryStepResult,
  LandStepRunners,
  WatchStepResult,
} from "../../src/dispatcher/land"
import { createLogger, type Logger } from "../../src/dispatcher/logger"

let repoRoot: string
let stateRoot: string

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "gs7-land-"))
  stateRoot = join(repoRoot, ".sgc")
})

afterEach(() => {
  try { rmSync(repoRoot, { recursive: true, force: true }) } catch {}
})

function writePackageJson(name: string, version: string): void {
  writeFileSync(
    join(repoRoot, "package.json"),
    JSON.stringify({ name, version }),
    "utf8",
  )
}

function makeSteps(
  watch: WatchStepResult | (() => Promise<WatchStepResult>),
  canary?: CanaryStepResult | (() => Promise<CanaryStepResult>),
): { steps: LandStepRunners; watchSpy: ReturnType<typeof mock>; canarySpy: ReturnType<typeof mock> } {
  const watchSpy = mock(typeof watch === "function" ? watch : async () => watch)
  const canarySpy = mock(
    typeof canary === "function"
      ? canary
      : async () => canary ?? { status: "success" as const },
  )
  return {
    steps: {
      watchCiFailure: watchSpy as LandStepRunners["watchCiFailure"],
      canary: canarySpy as LandStepRunners["canary"],
    },
    watchSpy,
    canarySpy,
  }
}

describe("runLand", () => {
  test("placeholder — replaced in Task 2", () => {
    expect(true).toBe(true)
  })
})

describe("defaultStepRunners", () => {
  test("placeholder — replaced in Task 3", () => {
    expect(true).toBe(true)
  })
})
