import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { execSync } from "node:child_process"
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  aggregateVerdict,
  auditDependencies,
  detectAnomalies,
  ensureCsoDir,
  runCso,
  scanSecrets,
  type CsoCheckResult,
} from "../../src/commands/cso"

let tmp: string
let repoRoot: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-cso-"))
  repoRoot = mkdtempSync(join(tmpdir(), "sgc-cso-repo-"))
  // Initialize as git repo so scanSecrets' ls-files works
  execSync("git init -q && git config user.email t@t && git config user.name t", {
    cwd: repoRoot,
    stdio: "ignore",
  })
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
  rmSync(repoRoot, { recursive: true, force: true })
})

const stub = (
  name: string,
  verdict: "pass" | "warn" | "fail",
  findings: string[] = [],
  warnings: string[] = [],
): CsoCheckResult => ({ name, verdict, findings, warnings })

describe("cso — aggregateVerdict", () => {
  test("all pass → pass", () => {
    expect(aggregateVerdict([stub("a", "pass"), stub("b", "pass")])).toBe("pass")
  })
  test("any warn (no fail) → warn", () => {
    expect(aggregateVerdict([stub("a", "pass"), stub("b", "warn")])).toBe("warn")
  })
  test("any fail dominates warn + pass → fail", () => {
    expect(aggregateVerdict([stub("a", "warn"), stub("b", "fail"), stub("c", "pass")])).toBe("fail")
  })
  test("empty list → pass (no checks = nothing to block)", () => {
    expect(aggregateVerdict([])).toBe("pass")
  })
})

describe("cso — ensureCsoDir", () => {
  test("creates .sgc/cso/ under stateRoot", () => {
    const dir = ensureCsoDir(tmp)
    expect(existsSync(dir)).toBe(true)
    expect(dir.endsWith("/cso")).toBe(true)
  })
})

describe("cso — scanSecrets", () => {
  test("clean repo → pass with 0 findings", () => {
    writeFileSync(resolve(repoRoot, "README.md"), "# nothing here\n")
    execSync("git add . && git commit -q -m init", { cwd: repoRoot, stdio: "ignore" })
    const r = scanSecrets(repoRoot)
    expect(r.verdict).toBe("pass")
    expect(r.findings).toEqual([])
  })

  test("AKIA pattern in committed file → fail", () => {
    writeFileSync(
      resolve(repoRoot, "config.env"),
      "AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE\n",
    )
    execSync("git add . && git commit -q -m secret", { cwd: repoRoot, stdio: "ignore" })
    const r = scanSecrets(repoRoot)
    expect(r.verdict).toBe("fail")
    expect(r.findings.length).toBeGreaterThan(0)
    expect(r.findings[0]).toContain("config.env")
    expect(r.findings[0]).toContain("AWS access key")
  })

  test("excludes .sgc/cso/ self-reference (last-report.json mentioning AKIA)", () => {
    mkdirSync(resolve(repoRoot, ".sgc/cso"), { recursive: true })
    writeFileSync(
      resolve(repoRoot, ".sgc/cso/last-report.json"),
      JSON.stringify({ finding: "AKIAIOSFODNN7EXAMPLE" }),
    )
    writeFileSync(resolve(repoRoot, "README.md"), "ok\n")
    execSync("git add -f . && git commit -q -m mixed", { cwd: repoRoot, stdio: "ignore" })
    const r = scanSecrets(repoRoot)
    // .sgc/cso/ scan-excluded; README is clean
    expect(r.verdict).toBe("pass")
  })

  test("private key block → fail", () => {
    writeFileSync(
      resolve(repoRoot, "id_rsa"),
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBA...\n-----END RSA PRIVATE KEY-----\n",
    )
    execSync("git add . && git commit -q -m key", { cwd: repoRoot, stdio: "ignore" })
    const r = scanSecrets(repoRoot)
    expect(r.verdict).toBe("fail")
    expect(r.findings.some((f) => f.includes("private key block"))).toBe(true)
  })

  test("non-git directory → warn (graceful, no crash)", () => {
    const noGit = mkdtempSync(join(tmpdir(), "sgc-cso-nogit-"))
    try {
      const r = scanSecrets(noGit)
      expect(r.verdict).toBe("warn")
      expect(r.warnings.some((w) => w.includes("git ls-files failed"))).toBe(true)
    } finally {
      rmSync(noGit, { recursive: true, force: true })
    }
  })
})

describe("cso — auditDependencies", () => {
  test("repo without package.json → warn (tools likely return non-JSON / fail)", () => {
    const r = auditDependencies(repoRoot)
    // Either warn (tool missing or unparseable) or pass (tool ran clean).
    // We don't strictly assert which since CI may have either bun or npm.
    expect(["warn", "pass"]).toContain(r.verdict)
  })
})

describe("cso — detectAnomalies", () => {
  test("missing events.ndjson → warn", () => {
    const r = detectAnomalies(tmp)
    expect(r.verdict).toBe("warn")
    expect(r.warnings.some((w) => w.includes("not found"))).toBe(true)
  })

  test("empty events.ndjson → warn", () => {
    const eventsPath = resolve(tmp, "progress/events.ndjson")
    mkdirSync(resolve(tmp, "progress"), { recursive: true })
    writeFileSync(eventsPath, "")
    const r = detectAnomalies(tmp)
    expect(r.verdict).toBe("warn")
    expect(r.warnings.some((w) => w.includes("empty"))).toBe(true)
  })

  test("paired spawn.start + spawn.end → pass", () => {
    const eventsPath = resolve(tmp, "progress/events.ndjson")
    mkdirSync(resolve(tmp, "progress"), { recursive: true })
    const lines = [
      JSON.stringify({
        schema_version: 1,
        ts: "2026-05-28T00:00:00.000Z",
        task_id: "T1",
        spawn_id: "S1",
        agent: "planner.eng",
        event_type: "spawn.start",
        level: "info",
        payload: {},
      }),
      JSON.stringify({
        schema_version: 1,
        ts: "2026-05-28T00:00:01.000Z",
        task_id: "T1",
        spawn_id: "S1",
        agent: "planner.eng",
        event_type: "spawn.end",
        level: "info",
        payload: {},
      }),
    ]
    writeFileSync(eventsPath, lines.join("\n") + "\n")
    const r = detectAnomalies(tmp)
    expect(r.verdict).toBe("pass")
    expect(r.findings).toEqual([])
  })

  test("unpaired spawn.start → fail with finding citing spawn_id", () => {
    const eventsPath = resolve(tmp, "progress/events.ndjson")
    mkdirSync(resolve(tmp, "progress"), { recursive: true })
    const line = JSON.stringify({
      schema_version: 1,
      ts: "2026-05-28T00:00:00.000Z",
      task_id: "T1",
      spawn_id: "ORPHAN-S2",
      agent: "planner.ceo",
      event_type: "spawn.start",
      level: "info",
      payload: {},
    })
    writeFileSync(eventsPath, line + "\n")
    const r = detectAnomalies(tmp)
    expect(r.verdict).toBe("fail")
    expect(r.findings.length).toBe(1)
    expect(r.findings[0]).toContain("ORPHAN-S2")
  })

  test("malformed json line → warn but continues scanning", () => {
    const eventsPath = resolve(tmp, "progress/events.ndjson")
    mkdirSync(resolve(tmp, "progress"), { recursive: true })
    const lines = [
      "not-valid-json",
      JSON.stringify({
        schema_version: 1,
        ts: "2026-05-28T00:00:00.000Z",
        task_id: null,
        spawn_id: null,
        agent: null,
        event_type: "logger.flush",
        level: "info",
        payload: {},
      }),
    ]
    appendFileSync(eventsPath, lines.join("\n") + "\n")
    const r = detectAnomalies(tmp)
    // No spawn events, no unpaired → pass on findings; malformed → warning
    expect(r.findings).toEqual([])
    expect(r.warnings.some((w) => w.includes("malformed"))).toBe(true)
  })
})

describe("cso — runCso end-to-end", () => {
  test("writes timestamped report + last-report.json", async () => {
    const { report, reportPath, lastReportPath } = await runCso({
      stateRoot: tmp,
      repoRoot,
      log: () => {},
    })
    expect(existsSync(reportPath)).toBe(true)
    expect(reportPath).toMatch(/\/cso\/\d{4}-\d{2}-\d{2}-\d{4}-[a-z0-9]{6}\.md$/)
    expect(existsSync(lastReportPath)).toBe(true)
    const parsed = JSON.parse(readFileSync(lastReportPath, "utf8"))
    expect(parsed.verdict).toBe(report.verdict)
    expect(parsed.checks.length).toBe(3)
    expect(parsed.checks.map((c: CsoCheckResult) => c.name).sort()).toEqual([
      "dependency-audit",
      "events-anomaly",
      "secret-scan",
    ])
  })

  test("report frontmatter has generated_at + verdict + slug", async () => {
    const { reportPath } = await runCso({
      stateRoot: tmp,
      repoRoot,
      log: () => {},
    })
    const md = readFileSync(reportPath, "utf8")
    expect(md).toMatch(/^---\n/)
    expect(md).toContain("verdict:")
    expect(md).toContain("generated_at:")
    expect(md).toContain("slug:")
    expect(md).toContain("# CSO security review")
  })

  test("append-only: second runCso writes a NEW file, does not overwrite first", async () => {
    const r1 = await runCso({ stateRoot: tmp, repoRoot, log: () => {} })
    // Sleep briefly so the timestamp slug differs
    await new Promise((res) => setTimeout(res, 1100))
    const r2 = await runCso({ stateRoot: tmp, repoRoot, log: () => {} })
    expect(r1.reportPath).not.toBe(r2.reportPath)
    expect(existsSync(r1.reportPath)).toBe(true)
    expect(existsSync(r2.reportPath)).toBe(true)
    // last-report.json points at the latest run
    const last = JSON.parse(readFileSync(r1.lastReportPath, "utf8"))
    expect(last.generated_at).toBe(r2.report.generated_at)
  })
})
