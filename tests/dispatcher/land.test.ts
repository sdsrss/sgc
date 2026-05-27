import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runLand, defaultStepRunners, deriveLandInputs, LandError } from "../../src/dispatcher/land"
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

describe("deriveLandInputs", () => {
  test("T2a: reads package.json#name + version when no overrides", async () => {
    writePackageJson("@sdsrs/sgc", "1.14.0")
    const out = await deriveLandInputs({ repoRoot })
    expect(out).toEqual({ packageName: "@sdsrs/sgc", version: "1.14.0" })
  })

  test("T2b: --package override; version still from package.json", async () => {
    writePackageJson("@sdsrs/sgc", "1.14.0")
    const out = await deriveLandInputs({ repoRoot, package: "custom-pkg" })
    expect(out).toEqual({ packageName: "custom-pkg", version: "1.14.0" })
  })

  test("T2c: --version override; package still from package.json", async () => {
    writePackageJson("@sdsrs/sgc", "1.14.0")
    const out = await deriveLandInputs({ repoRoot, version: "1.15.0" })
    expect(out).toEqual({ packageName: "@sdsrs/sgc", version: "1.15.0" })
  })

  test("T2d: both flags given; package.json not read", async () => {
    // no package.json written
    const out = await deriveLandInputs({
      repoRoot,
      package: "foo",
      version: "9.9.9",
    })
    expect(out).toEqual({ packageName: "foo", version: "9.9.9" })
  })

  test("T2e: missing package.json + no --package → LandError cannot_derive_package", async () => {
    await expect(deriveLandInputs({ repoRoot, version: "1.14.0" })).rejects.toBeInstanceOf(
      LandError,
    )
    try {
      await deriveLandInputs({ repoRoot, version: "1.14.0" })
    } catch (e) {
      expect((e as LandError).code).toBe("cannot_derive_package")
    }
  })

  test("T2f: missing package.json + no --version → LandError cannot_derive_version", async () => {
    await expect(deriveLandInputs({ repoRoot, package: "foo" })).rejects.toBeInstanceOf(
      LandError,
    )
    try {
      await deriveLandInputs({ repoRoot, package: "foo" })
    } catch (e) {
      expect((e as LandError).code).toBe("cannot_derive_version")
    }
  })

  test("T2g: malformed package.json + no overrides → LandError cannot_derive_package", async () => {
    writeFileSync(join(repoRoot, "package.json"), "{ not json", "utf8")
    await expect(deriveLandInputs({ repoRoot })).rejects.toBeInstanceOf(LandError)
  })
})

describe("defaultStepRunners", () => {
  test("T3a: returns object with watchCiFailure + canary as functions", () => {
    const runners = defaultStepRunners()
    expect(typeof runners.watchCiFailure).toBe("function")
    expect(typeof runners.canary).toBe("function")
  })
})

describe("runLand", () => {
  test("T4: happy path — watch green + canary green → exit 0", async () => {
    writePackageJson("@sdsrs/sgc", "1.14.0")
    const { steps, watchSpy, canarySpy } = makeSteps(
      { status: "success" },
      { status: "success" },
    )
    const stdoutChunks: string[] = []
    const stderrChunks: string[] = []
    const logger = createLogger({ stateRoot })
    const result = await runLand({
      repoRoot,
      stateRoot,
      steps,
      logger,
      stdoutWrite: (c) => stdoutChunks.push(c),
      stderrWrite: (c) => stderrChunks.push(c),
    })
    expect(result.exitCode).toBe(0)
    expect(result.step).toBe("complete")
    expect(result.package).toBe("@sdsrs/sgc")
    expect(result.version).toBe("1.14.0")
    expect(watchSpy).toHaveBeenCalledTimes(1)
    expect(canarySpy).toHaveBeenCalledTimes(1)
    expect(stdoutChunks.join("")).toContain("land complete: @sdsrs/sgc@1.14.0")
    expect(stdoutChunks.join("")).toContain("[1/2] watch-ci-failure")
    expect(stdoutChunks.join("")).toContain("[2/2] canary")
  })

  test("T5a: watch capture → exit 1, canary NOT called, stderr guidance", async () => {
    writePackageJson("@sdsrs/sgc", "1.14.0")
    const { steps, watchSpy, canarySpy } = makeSteps({
      status: "failure",
      captured: {
        action: "captured",
        path: "/x/.sgc/ship-failures/2026-05-27-abc1234.md",
      },
    })
    const stderrChunks: string[] = []
    const result = await runLand({
      repoRoot,
      stateRoot,
      steps,
      stderrWrite: (c) => stderrChunks.push(c),
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(result.step).toBe("watch-ci-failure")
    expect(watchSpy).toHaveBeenCalledTimes(1)
    expect(canarySpy).toHaveBeenCalledTimes(0)
    const stderr = stderrChunks.join("")
    expect(stderr).toContain("land failed at watch-ci-failure")
    expect(stderr).toContain("/x/.sgc/ship-failures/2026-05-27-abc1234.md")
    expect(stderr).toContain("fix CI; rerun sgc land")
  })

  test("T5b: watch timeout is NOT captured but is failure for chain", async () => {
    writePackageJson("@sdsrs/sgc", "1.14.0")
    const { steps, watchSpy, canarySpy } = makeSteps({ status: "timeout" })
    const stderrChunks: string[] = []
    const result = await runLand({
      repoRoot,
      stateRoot,
      steps,
      stderrWrite: (c) => stderrChunks.push(c),
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(result.step).toBe("watch-ci-failure")
    expect(watchSpy).toHaveBeenCalledTimes(1)
    expect(canarySpy).toHaveBeenCalledTimes(0)
    expect(stderrChunks.join("")).toContain("land failed at watch-ci-failure")
  })

  test("T6a: canary capture → exit 1, stderr canary guidance", async () => {
    writePackageJson("@sdsrs/sgc", "1.14.0")
    const { steps, watchSpy, canarySpy } = makeSteps(
      { status: "success" },
      {
        status: "failure",
        failedPhase: "smoke_install",
        captured: {
          action: "captured",
          path: "/x/.sgc/canaries/2026-05-27-abc1234-smoke_install.md",
        },
      },
    )
    const stderrChunks: string[] = []
    const result = await runLand({
      repoRoot,
      stateRoot,
      steps,
      stderrWrite: (c) => stderrChunks.push(c),
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(result.step).toBe("canary")
    expect(watchSpy).toHaveBeenCalledTimes(1)
    expect(canarySpy).toHaveBeenCalledTimes(1)
    const stderr = stderrChunks.join("")
    expect(stderr).toContain("land failed at canary")
    expect(stderr).toContain("/x/.sgc/canaries/2026-05-27-abc1234-smoke_install.md")
    expect(stderr).toContain("check npm registry propagation")
  })

  test("T6b: canary timeout → exit 1 (no capture path)", async () => {
    writePackageJson("@sdsrs/sgc", "1.14.0")
    const { steps } = makeSteps({ status: "success" }, { status: "timeout" })
    const stderrChunks: string[] = []
    const result = await runLand({
      repoRoot,
      stateRoot,
      steps,
      stderrWrite: (c) => stderrChunks.push(c),
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(result.step).toBe("canary")
    expect(stderrChunks.join("")).toContain("land failed at canary")
  })

  test("T7a: watchCiFailure throws → exit 1, error_class + error_message in event", async () => {
    writePackageJson("@sdsrs/sgc", "1.14.0")
    const watchSpy = mock(async () => { throw new Error("gh: command not found") })
    const canarySpy = mock(async () => ({ status: "success" as const }))
    const steps = {
      watchCiFailure: watchSpy as LandStepRunners["watchCiFailure"],
      canary: canarySpy as LandStepRunners["canary"],
    }
    const stderrChunks: string[] = []
    const result = await runLand({
      repoRoot,
      stateRoot,
      steps,
      stderrWrite: (c) => stderrChunks.push(c),
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(result.step).toBe("watch-ci-failure")
    expect(canarySpy).toHaveBeenCalledTimes(0)
    expect(stderrChunks.join("")).toContain("land error in watch-ci-failure")
    expect(stderrChunks.join("")).toContain("gh: command not found")
  })

  test("T7b: canary throws → exit 1, watch already completed", async () => {
    writePackageJson("@sdsrs/sgc", "1.14.0")
    const watchSpy = mock(async () => ({ status: "success" as const }))
    const canarySpy = mock(async () => { throw new Error("npm registry unreachable") })
    const steps = {
      watchCiFailure: watchSpy as LandStepRunners["watchCiFailure"],
      canary: canarySpy as LandStepRunners["canary"],
    }
    const stderrChunks: string[] = []
    const result = await runLand({
      repoRoot,
      stateRoot,
      steps,
      stderrWrite: (c) => stderrChunks.push(c),
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(result.step).toBe("canary")
    expect(stderrChunks.join("")).toContain("land error in canary")
    expect(stderrChunks.join("")).toContain("npm registry unreachable")
  })

  test("T8: arg-error → exit 1, land.start NOT emitted, no step runner called", async () => {
    // no package.json; no overrides
    const { steps, watchSpy, canarySpy } = makeSteps({ status: "success" })
    const stderrChunks: string[] = []
    // capture events via custom Logger
    const events: Array<{ event_type: string }> = []
    const logger: Logger = {
      say: () => {},
      event: (e) => { events.push(e as { event_type: string }) },
    } as Logger
    const result = await runLand({
      repoRoot,
      stateRoot,
      logger,
      steps,
      stderrWrite: (c) => stderrChunks.push(c),
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(result.step).toBe("arg-error")
    expect(watchSpy).toHaveBeenCalledTimes(0)
    expect(canarySpy).toHaveBeenCalledTimes(0)
    expect(events.filter((e) => e.event_type === "land.start").length).toBe(0)
    expect(events.filter((e) => e.event_type === "land.failed").length).toBe(0)
    expect(stderrChunks.join("")).toContain("land error: cannot derive package name")
  })
})
