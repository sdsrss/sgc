// P3-5 regression: `agent-loop --submit` must run the §1 output leak scan.
//
// spawn() scans every subagent's output for solutions/ content before accepting
// it (spawn.ts) — that scan is what makes §1's "reviewers are amnesiac"
// enforceable rather than advisory, since a pinned scope is only prompt text to
// an LLM. The `--submit` path validated §9 shape and then wrote the file
// directly, skipping the scan.
//
// In the normal file-poll flow this is masked: the polling spawn() re-validates
// after pollForResult returns. But a submission made with no live poller — the
// documented use of --submit for an external actor fulfilling a spawn by hand —
// lands the result on disk with nothing having checked it. Defense-in-depth is
// not defense-in-depth if the second layer only runs when the first one already
// did.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runAgentLoop } from "../../src/commands/agent-loop"
import { promptPath, resultPath } from "../../src/dispatcher/spawn-protocol"
import { createLogger, type EventRecord, type Logger } from "../../src/dispatcher/logger"
import { ensureSgcStructure } from "../../src/dispatcher/state"

let tmp: string
const SPAWN_ID = "01LEAKPROBE0000000000000-reviewer.correctness"
const SECRET_LINE = "Validate password presence before calling authenticate() on the login path"

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-submit-leak-"))
  ensureSgcStructure(tmp)
  // A solution in the corpus the reviewer is forbidden to have read (§1).
  const sdir = resolve(tmp, "solutions", "auth")
  mkdirSync(sdir, { recursive: true })
  writeFileSync(
    resolve(sdir, "npe-login.md"),
    `---\nid: 01X\ncategory: auth\n---\n\n${SECRET_LINE}\n`,
    "utf8",
  )
  // A pending spawn awaiting an external actor's result.
  const pp = promptPath(SPAWN_ID, tmp)
  mkdirSync(resolve(pp, ".."), { recursive: true })
  writeFileSync(pp, "system\n\n---\n\nreview this diff\n", "utf8")
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const cleanYaml = `verdict: pass
severity: none
findings: []
`

const leakingYaml = `verdict: concern
severity: low
findings:
  - location: auth.ts:42
    description: "${SECRET_LINE}"
    suggestion: guard it
`

describe("agent-loop --submit runs the §1 leak scan (P3-5)", () => {
  test("a submission quoting solutions/ content is rejected", async () => {
    await expect(
      runAgentLoop({
        stateRoot: tmp,
        submit: SPAWN_ID,
        readStdin: async () => leakingYaml,
        log: () => {},
      }),
    ).rejects.toThrow(/§1|leak|solutions/i)
  })

  test("the rejected submission is NOT written to disk", async () => {
    await runAgentLoop({
      stateRoot: tmp,
      submit: SPAWN_ID,
      readStdin: async () => leakingYaml,
      log: () => {},
    }).catch(() => {})
    // §1 must fail closed: a rejected result must not be readable by the
    // dispatcher on the next poll.
    let exists = true
    try {
      readFileSync(resultPath(SPAWN_ID, tmp), "utf8")
    } catch {
      exists = false
    }
    expect(exists).toBe(false)
  })

  test("a clean submission still lands (the gate is not a wall)", async () => {
    const r = await runAgentLoop({
      stateRoot: tmp,
      submit: SPAWN_ID,
      readStdin: async () => cleanYaml,
      log: () => {},
    })
    expect(r.action).toBe("submit")
    expect(readFileSync(resultPath(SPAWN_ID, tmp), "utf8")).toContain("verdict: pass")
  })
})

// M4: the gate fired, but silently.
//
// spawn()'s equivalent rejection surfaces as spawn.end{outcome:"error"}, so an
// operator running `sgc tail` sees §1 violations. This path only threw. The
// result: a violation arriving through the ONE path with no live poller — which
// is the entire reason --submit exists — left no audit trace. A security gate
// whose trips are not recorded cannot be shown to have ever worked.
describe("agent-loop --submit records the §1 rejection (M4)", () => {
  function capture(): { logger: Logger; events: EventRecord[] } {
    const events: EventRecord[] = []
    const logger = createLogger({ stateRoot: tmp, say: () => {}, eventSink: (e) => events.push(e) })
    return { logger, events }
  }

  test("a rejected submission emits an event naming the agent and the invariant", async () => {
    const { logger, events } = capture()
    await runAgentLoop({
      stateRoot: tmp,
      submit: SPAWN_ID,
      readStdin: async () => leakingYaml,
      log: () => {},
      logger,
    }).catch(() => {})

    const rejected = events.filter((e) => e.event_type === "submit.rejected")
    expect(rejected.length).toBe(1)
    const e = rejected[0] as EventRecord
    expect(e.level).toBe("error")
    expect(e.agent).toBe("reviewer.correctness")
    expect(e.spawn_id).toBe(SPAWN_ID)
    expect(e.payload.reason).toBe("invariant_1_output_leak")
    expect(e.payload.match_count).toBe(1)
  })

  test("the event does not carry the leaked content itself", async () => {
    // The samples are the solution text the reviewer was not allowed to see.
    // Copying them into the event stream would leak them a second time, into a
    // file that `sgc tail` prints and cso reads.
    const { logger, events } = capture()
    await runAgentLoop({
      stateRoot: tmp,
      submit: SPAWN_ID,
      readStdin: async () => leakingYaml,
      log: () => {},
      logger,
    }).catch(() => {})
    expect(JSON.stringify(events)).not.toContain(SECRET_LINE)
  })

  test("a clean submission emits no rejection", async () => {
    const { logger, events } = capture()
    await runAgentLoop({
      stateRoot: tmp,
      submit: SPAWN_ID,
      readStdin: async () => cleanYaml,
      log: () => {},
      logger,
    })
    expect(events.filter((e) => e.event_type === "submit.rejected").length).toBe(0)
  })
})
