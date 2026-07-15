import { describe, expect, test } from "bun:test"
import { deriveCliFact, DERIVED_AGENT_IDS, CLI_FACT_MARKER } from "../../src/dispatcher/agent-facts"
import { cliFactDrift, readAgentMdFiles, runDoctor, rewriteCliFact } from "../../src/commands/doctor"
import { resolve, join } from "node:path"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { load as yamlLoad } from "js-yaml"
const ROOT = resolve(import.meta.dir, "../..")

/** Minimal hasSource=true fixture root: just the stub entry. Every other
 *  hasSource-gated check in runDoctor either skips on a missing target file
 *  or reports its own fail/warn row for one (verified: metrics baseline does
 *  exactly this at doctor.ts:813) rather than throwing — so this is enough to
 *  reach check (O) without any other section crashing first. */
function makeDoctorRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "sgc-doctor-agent-facts-"))
  mkdirSync(join(root, "src"), { recursive: true })
  writeFileSync(join(root, "src", "sgc.ts"), "// stub entry so hasSource is true\n")
  return root
}

const md = (id: string, desc: string) => ({
  id, file: `plugins/sgc/agents/${id.replace(".", "/")}.md`,
  text: `---\nname: ${id.replace(".", "-")}\ndescription: ${JSON.stringify(desc)}\n---\n\nbody\n`,
})

describe("deriveCliFact — the four shapes", () => {
  test("covers exactly the 9 in-scope ids", () => {
    expect([...DERIVED_AGENT_IDS].sort()).toEqual([
      "janitor.archive", "reviewer.adversarial", "reviewer.infra",
      "reviewer.maintainability", "reviewer.migration", "reviewer.performance",
      "reviewer.security", "reviewer.spec", "reviewer.tests",
    ])
  })

  test("every clause starts with the marker", () => {
    for (const id of DERIVED_AGENT_IDS) {
      expect(deriveCliFact(id).startsWith(CLI_FACT_MARKER)).toBe(true)
    }
  })

  test("LLM-backed with fallback (security) names the prompt AND the fallback terms", () => {
    const f = deriveCliFact("reviewer.security")
    expect(f).toContain("prompts/reviewer-security.md")
    expect(f).toContain("auth|jwt|token")
    expect(f).toContain("signature|encrypt|decrypt")   // the M4 omission
    expect(f).toContain("medium severity")
  })

  test("term-list matcher (performance) advertises exactly its terms, incl. O(n…)", () => {
    const f = deriveCliFact("reviewer.performance")
    expect(f).toContain("O(n…)")
    expect(f).toContain("debounce|throttle")
    expect(f).not.toContain("prompts/")   // no LLM path
  })

  test("threshold + marker list (maintainability) carries BOTH facts", () => {
    const f = deriveCliFact("reviewer.maintainability")
    expect(f).toContain("120")
    expect(f).toContain("@ts-ignore")
    expect(f).toContain("low severity")
  })

  test("tests names a file-path check, never a keyword matcher, and states its severity like its siblings", () => {
    const f = deriveCliFact("reviewer.tests")
    expect(f).toContain("file-path")
    expect(f).not.toMatch(/keyword/i)
    // Every other fallback clause names its severity (medium/high/low above);
    // omitting it here would be an unexplained asymmetry a reader would notice
    // and this heuristic really does report TESTS_SEVERITY when it fires.
    expect(f).toContain("medium severity")
  })

  test("CLI-never-runs (adversarial, spec, archive) says so and names no matcher", () => {
    for (const id of ["reviewer.adversarial", "reviewer.spec", "janitor.archive"]) {
      const f = deriveCliFact(id)
      expect(f).toMatch(/never (runs|produces)/i)
      expect(f).not.toContain("severity")
    }
  })

  test("an out-of-scope id throws rather than inventing a clause", () => {
    expect(() => deriveCliFact("planner.ceo")).toThrow(/not in the derived set/)
  })
})

describe("doctor check (O) — the clause is asserted, not sniffed", () => {
  test("a description ending in the derived clause passes", () => {
    const good = `Does a useful thing. ${deriveCliFact("reviewer.performance")}`
    expect(cliFactDrift([md("reviewer.performance", good)])).toEqual([])
  })

  test("a stale clause fails AND the message carries the exact expected string", () => {
    const stale = `Does a useful thing. ${CLI_FACT_MARKER} something someone typed by hand.`
    const drifts = cliFactDrift([md("reviewer.performance", stale)])
    expect(drifts).toHaveLength(1)
    expect(drifts[0]).toContain(deriveCliFact("reviewer.performance"))
  })

  test("a missing clause fails", () => {
    const drifts = cliFactDrift([md("reviewer.performance", "Does a useful thing.")])
    expect(drifts).toHaveLength(1)
    expect(drifts[0]).toMatch(/no `Separate fact for sgc CLI users:` clause/)
  })

  test("a clause that LEADS fails — a routing field must not open with a disclaimer", () => {
    // M5's F1/F2: "NOT IMPLEMENTED" as the leading token is a phrase engineered to
    // stop the router in a field whose only job is to start it.
    const leads = `${deriveCliFact("reviewer.performance")} Does a useful thing.`
    const drifts = cliFactDrift([md("reviewer.performance", leads)])
    expect(drifts.length).toBeGreaterThan(0)
    expect(drifts.join(" ")).toMatch(/capability sentence must come first/)
  })

  test("out-of-scope agent files are ignored, not failed", () => {
    expect(cliFactDrift([md("planner.ceo", "Product gate reviewer.")])).toEqual([])
  })
})

// Found in review of 9c3f9a7, closed in the same commit. Both findings trace
// to the same root cause: check (O)'s runDoctor block assumed readAgentMdFiles
// always succeeds and always returns all 9 in-scope files — neither is
// guaranteed, and check (N) right above it already learned the first lesson
// the hard way (see its own try/catch's docblock).
describe("doctor check (O) — survives a broken registry and doesn't overclaim its count", () => {
  test("a broken symlink under plugins/sgc/agents/ fails check (O) without crashing the rest of runDoctor", async () => {
    const root = makeDoctorRoot()
    try {
      const agentsDir = join(root, "plugins", "sgc", "agents", "reviewer")
      mkdirSync(agentsDir, { recursive: true })
      // readdirSync lists a broken symlink; readFileSync on it throws ENOENT —
      // that throw used to propagate straight out of runDoctor (check N's own
      // docblock names this exact failure mode; check O reintroduced it).
      symlinkSync(join(root, "does-not-exist.md"), join(agentsDir, "broken.md"))

      const report = await runDoctor({ repoRoot: root, log: () => {} })

      expect(report.rows.some((r) => r.severity === "fail" && /CLI-fact/i.test(r.msg))).toBe(true)
      // Checks after (O) — e.g. (M) — must still have run; a crash here would
      // have ended the whole report at (O) and never reached them.
      expect(report.rows.some((r) => /README/i.test(r.msg))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("a missing in-scope file is a fail, not a quiet success claiming all 9 matched", async () => {
    const root = makeDoctorRoot()
    try {
      const agentsDir = join(root, "plugins", "sgc", "agents", "reviewer")
      mkdirSync(agentsDir, { recursive: true })
      // Only 1 of the 9 derived files exists, and it's correct. The other 8
      // (including janitor.archive) are entirely absent — the "delete
      // security.md" scenario, generalized.
      writeFileSync(
        join(agentsDir, "performance.md"),
        `---\nname: reviewer-performance\ndescription: ${JSON.stringify(`Does a thing. ${deriveCliFact("reviewer.performance")}`)}\n---\n\nbody\n`,
      )

      const report = await runDoctor({ repoRoot: root, log: () => {} })

      // Every missing derived id is its own reported failure...
      for (const id of DERIVED_AGENT_IDS) {
        if (id === "reviewer.performance") continue
        expect(report.rows.some((r) => r.severity === "fail" && r.msg.includes(id))).toBe(true)
      }
      // ...and the healthy-looking "✓ 9 ... match the code" claim never fires
      // when only 1 of the 9 was actually seen.
      expect(report.rows.some((r) => /agent CLI-fact clauses match the code/.test(r.msg))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe("--write-descriptions — regenerates the fact, never the capability", () => {
  const CAP = "Performance review of a diff — algorithmic complexity and N+1 patterns."
  const file = (desc: string) =>
    `---\nname: reviewer-performance\ndescription: ${JSON.stringify(desc)}\n---\n\n# Body\n\nUnchanged.\n`

  test("a stale clause is replaced and the capability sentence survives byte-for-byte", () => {
    const out = rewriteCliFact(file(`${CAP} ${CLI_FACT_MARKER} stale junk.`), "reviewer.performance")
    expect(out).toContain(CAP)
    expect(out).toContain(deriveCliFact("reviewer.performance"))
    expect(out).not.toContain("stale junk")
    expect(out).toContain("# Body")      // body untouched
  })

  test("a missing clause is appended after the capability sentence", () => {
    const out = rewriteCliFact(file(CAP), "reviewer.performance")
    expect(out).toContain(`${CAP} ${deriveCliFact("reviewer.performance")}`)
  })

  test("it is idempotent — running it twice changes nothing", () => {
    const once = rewriteCliFact(file(CAP), "reviewer.performance")
    expect(rewriteCliFact(once, "reviewer.performance")).toBe(once)
  })

  test("output round-trips through the drift check", () => {
    const out = rewriteCliFact(file(`${CAP} ${CLI_FACT_MARKER} junk.`), "reviewer.performance")
    expect(cliFactDrift([{ id: "reviewer.performance", file: "x.md", text: out }])).toEqual([])
  })

  // The team's own stated attack surface for this task: does rewriteCliFact
  // touch anything OTHER than the clause, and is idempotency real or an
  // artifact of the one fixture above (simple capability, single id)?

  test("the name key is preserved exactly, not just the description", () => {
    const out = rewriteCliFact(file(`${CAP} ${CLI_FACT_MARKER} stale junk.`), "reviewer.performance")
    expect(out).toMatch(/^name: reviewer-performance$/m)
  })

  test("idempotent on a second id whose clause has a different shape (LLM-backed, not term-list)", () => {
    const secFile =
      `---\nname: reviewer-security\ndescription: ${JSON.stringify("Adversarial security review.")}\n---\n\n# Body\n\nUnchanged.\n`
    const once = rewriteCliFact(secFile, "reviewer.security")
    expect(once).toContain(deriveCliFact("reviewer.security"))
    expect(rewriteCliFact(once, "reviewer.security")).toBe(once)
  })

  test("a capability sentence containing a literal double-quote round-trips intact", () => {
    // A literal " in the value is legitimately \"-escaped in the YAML-double-quoted
    // OUTPUT text — checking the raw text for the unescaped substring would fail on
    // correct output. Parse the frontmatter back, same as cliFactDrift/doctor do,
    // and check the VALUE, not the file's escaped representation of it.
    const quoted = `Flags the literal word "TODO" in added lines.`
    const out = rewriteCliFact(file(`${quoted} ${CLI_FACT_MARKER} stale junk.`), "reviewer.performance")
    const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(out)?.[1]
    const parsedDesc = (yamlLoad(block!) as { description: string }).description
    expect(parsedDesc).toContain(quoted)
    expect(parsedDesc).toContain(deriveCliFact("reviewer.performance"))
    // And it stays idempotent with that punctuation in play, not just with CAP.
    expect(rewriteCliFact(out, "reviewer.performance")).toBe(out)
  })
})

describe("Task 7 — every M4/M5 defect class now requires editing code to reproduce", () => {
  const withDesc = (id: string, desc: string) => ({
    id, file: "x.md",
    text: `---\nname: x\ndescription: ${JSON.stringify(desc)}\n---\nbody\n`,
  })
  const CAP = "Does the thing."

  test("M4: a term dropped from the advertised list (signature|encrypt|decrypt)", () => {
    const mangled = deriveCliFact("reviewer.security").replace("|signature|encrypt|decrypt", "")
    expect(mangled).not.toBe(deriveCliFact("reviewer.security"))   // the replace actually landed
    expect(cliFactDrift([withDesc("reviewer.security", `${CAP} ${mangled}`)])).toHaveLength(1)
  })

  test("M4: an advertised term the matcher cannot match (O(n))", () => {
    // The inverse now: O(n…) can only appear in the clause because it is in
    // PERFORMANCE_TERMS, and Task 2's frozen probes prove the regex matches it.
    const mangled = deriveCliFact("reviewer.performance").replace("|O(n…)", "")
    expect(mangled).not.toBe(deriveCliFact("reviewer.performance"))   // the replace actually landed
    expect(cliFactDrift([withDesc("reviewer.performance", `${CAP} ${mangled}`)])).toHaveLength(1)
  })

  test("M5: a severity that disagrees with the code", () => {
    const mangled = deriveCliFact("reviewer.migration").replace("high severity", "low severity")
    expect(mangled).not.toBe(deriveCliFact("reviewer.migration"))   // the replace actually landed
    expect(cliFactDrift([withDesc("reviewer.migration", `${CAP} ${mangled}`)])).toHaveLength(1)
  })

  test("M4: the mechanism mislabelled (tests called a keyword matcher)", () => {
    // [^,]*, not the plan's [^;]* — the clause has grown a trailing ", at medium
    // severity" since the plan was written, and there's no semicolon after "a
    // file-path check" to stop a [^;]* match, so it would eat that too and
    // conflate this test with the severity-mismatch one above. Verified against
    // today's deriveCliFact("reviewer.tests") output before trusting it: the
    // mechanism phrase itself has no comma, so [^,]* stops exactly where the
    // mechanism description ends and the severity clause begins.
    const mangled = deriveCliFact("reviewer.tests").replace(/a file-path check[^,]*/, "a keyword matcher")
    expect(mangled).not.toBe(deriveCliFact("reviewer.tests"))   // the replace actually landed
    expect(cliFactDrift([withDesc("reviewer.tests", `${CAP} ${mangled}`)])).toHaveLength(1)
  })

  test("M5 F1/F2: the disclaimer moved to the front", () => {
    const mangled = `${deriveCliFact("janitor.archive")} ${CAP}`
    expect(mangled).not.toBe(deriveCliFact("janitor.archive"))
    const drifts = cliFactDrift([withDesc("janitor.archive", mangled)])
    expect(drifts.join(" ")).toMatch(/capability sentence must come first/)
  })

  test("M5 F3: an invented pointer to a non-LLM surface (the cso redirect)", () => {
    const mangled = `${deriveCliFact("reviewer.security")} For semantic analysis use \`sgc cso\`.`
    expect(mangled).not.toBe(deriveCliFact("reviewer.security"))
    expect(cliFactDrift([withDesc("reviewer.security", `${CAP} ${mangled}`)])).toHaveLength(1)
  })

  test("a prompt_path flip must change the clause — the metric cannot be moved by a label", () => {
    // reviewer.security has a prompt_path; reviewer.performance does not. Their
    // clauses must therefore differ in shape, not just in wording. This tests
    // deriveCliFact directly, not the gate — no mangled, no cliFactDrift call,
    // and it must stay green when check (O) is disabled (Step 2).
    expect(deriveCliFact("reviewer.security")).toContain("with an API key it runs")
    expect(deriveCliFact("reviewer.performance")).not.toContain("with an API key it runs")
  })
})

test("THE REAL 9 FILES are in sync with the derivation", () => {
  // The one test that binds the derivation to what actually ships. Every other
  // test in this file works on constructed fixtures; this one reads the repo.
  expect(cliFactDrift(readAgentMdFiles(ROOT))).toEqual([])
})
