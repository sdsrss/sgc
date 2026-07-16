// C3 · ALG-5 — an unknown canary phase must fail loudly, not silently pass.
//
// The phase loop is an if / else-if over the CanaryPhase union with no final
// else. `opts.phases` originates from the CLI (`--phases a,b,c`, parsed as raw
// strings), so a value outside the union can reach the loop; before the fix it
// was silently skipped and the run still returned `status: "success"`.

import { describe, expect, it } from "bun:test"
import { runCanaryChecks, type CanaryPhase } from "../../src/dispatcher/canary"

function makeClock(initialMs: number): {
  now: () => number
  sleep: (ms: number) => Promise<void>
} {
  let cur = initialMs
  return { now: () => cur, sleep: async (ms: number) => { cur += ms } }
}

describe("C3/ALG-5: unknown canary phase", () => {
  it("rejects instead of reporting success", async () => {
    const clock = makeClock(0)
    await expect(
      runCanaryChecks({
        packageName: "@sdsrs/sgc",
        expectedVersion: "1.11.0",
        phases: ["npm_propagation", "bogus_phase" as CanaryPhase],
        npmView: async () => JSON.stringify("1.11.0"),
        npxSmoke: async () => ({ exitCode: 0, stdout: "1.11.0\n", stderr: "" }),
        now: clock.now,
        sleep: clock.sleep,
      }),
    ).rejects.toThrow(/unknown canary phase/i)
  })
})
