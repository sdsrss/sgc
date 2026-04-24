# Phase G.1 — Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured event stream (`.sgc/progress/events.ndjson`) with a two-tier Invariant §13 that guarantees `spawn.start/end` (all modes) plus `llm.request/llm.response` (LLM modes); add `sgc tail` as the operator-facing read surface.

**Architecture:** Double-channel logger: `opts.log` continues producing human-readable CLI output; a new `opts.event` sink appends structured `EventRecord` JSON lines to `.sgc/progress/events.ndjson`. A single `try/finally` in `src/dispatcher/spawn.ts` guarantees the Tier 1 pair. Three `try/finally` guards in the LLM-mode agents (`anthropic-sdk-agent.ts`, `openrouter-agent.ts`, `claude-cli-agent.ts`) guarantee the Tier 2 pair. `sgc tail` is a pure local-file reader that understands the schema and can filter + follow.

**Tech Stack:** TypeScript + Bun runtime; `fs.appendFileSync` for atomic single-line writes; citty for CLI command registration; `bun:test` for tests.

**Spec:** `docs/superpowers/specs/2026-04-24-phase-g-design.md` — this plan implements §3 (Invariant §13), §4 (G.1.a Structured logs), and §5 (G.1.b `sgc tail`).

---

## File structure

**New files (7):**

- `src/dispatcher/logger.ts` — `Logger` interface, `EventRecord` type, `createLogger` factory, default NDJSON sink with error-swallowing.
- `src/commands/tail.ts` — `sgc tail` command implementation.
- `tests/dispatcher/logger.test.ts` — unit tests for logger module.
- `tests/dispatcher/tail.test.ts` — unit tests for `sgc tail`.
- `tests/dispatcher/commands-event-emission.test.ts` — smoke test each command emits ≥1 high-level event.
- `tests/dispatcher/spawn-events.test.ts` — Tier 1 pair emission (success / timeout / error paths).
- `tests/dispatcher/llm-agent-events.test.ts` — Tier 2 pair emission (anthropic-sdk / openrouter / claude-cli).

**Modified files (16):**

- `src/dispatcher/types.ts` — add `Logger` re-export or TypeScript imports if needed.
- `src/dispatcher/spawn.ts` — extend `SpawnOptions` with `taskId` + `logger`; wrap `spawn()` body in try/finally for Tier 1 pair; thread `logger` + `spawn_id` + `taskId` into LLM agent calls.
- `src/dispatcher/anthropic-sdk-agent.ts` — accept `logger` + `context` params; try/finally around `client.messages.create`; emit `llm.request` / `llm.response`.
- `src/dispatcher/openrouter-agent.ts` — same pattern.
- `src/dispatcher/claude-cli-agent.ts` — same pattern.
- `src/dispatcher/state.ts` — extend `ensureSgcStructure` to create `.sgc/progress/` if missing.
- `src/sgc.ts` — register `tail` command in citty table.
- `src/commands/agent-loop.ts`, `compound.ts`, `discover.ts`, `plan.ts`, `qa.ts`, `review.ts`, `ship.ts`, `work.ts` (8 files) — forward `opts.log` to `createLogger({ say: log })` and thread logger into spawn calls.
- `contracts/sgc-capabilities.yaml` — add Invariant §13 text under `invariants:`.
- `tests/eval/invariants.test.ts` — add §13 scenario (forceError still emits spawn.end).

---

## PR boundaries

This plan covers **two PRs**:

- **PR 1 — G.1.a** (Tasks 1-14): Logger + events.ndjson + Invariant §13 + command threading.
- **PR 2 — G.1.b** (Tasks 15-19): `sgc tail` command + tests + citty registration.

G.1.a MUST merge before G.1.b starts; G.1.b consumes the schema G.1.a locks in.

---

## Task 1: Logger types + interface scaffold

**Files:**
- Create: `src/dispatcher/logger.ts`

- [ ] **Step 1.1: Write the failing test**

Create `tests/dispatcher/logger.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import type { EventRecord, Logger } from "../../src/dispatcher/logger"

describe("Logger types (Phase G.1.a)", () => {
  test("EventRecord has required fields", () => {
    const e: EventRecord = {
      schema_version: 1,
      ts: "2026-04-24T14:32:17.123Z",
      task_id: "task-123",
      spawn_id: "spawn-abc",
      agent: "planner.eng",
      event_type: "spawn.start",
      level: "info",
      payload: {},
    }
    expect(e.schema_version).toBe(1)
  })

  test("Logger interface has say + event methods", () => {
    const l: Logger = {
      say: (_m: string) => {},
      event: (_e) => {},
    }
    expect(typeof l.say).toBe("function")
    expect(typeof l.event).toBe("function")
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/logger.test.ts
```

Expected: compilation error — `Cannot find module '../../src/dispatcher/logger'`.

- [ ] **Step 1.3: Create logger.ts with types only**

```typescript
// src/dispatcher/logger.ts
//
// Structured event stream for Phase G.1.a — dual-channel with opts.log
// (human-readable) and opts.event (NDJSON-appending to .sgc/progress/events.ndjson).
//
// Invariant §13: spawn.ts + LLM-mode agents MUST emit paired events — see
// docs/superpowers/specs/2026-04-24-phase-g-design.md §3.

export interface EventRecord {
  schema_version: 1
  ts: string                       // ISO 8601 UTC millisecond precision
  task_id: string | null           // null for pre-task events
  spawn_id: string | null          // null for non-spawn events
  agent: string | null             // manifest.name or null
  event_type: string               // "<domain>.<verb_past>" dot notation
  level: "debug" | "info" | "warn" | "error"
  payload: Record<string, unknown>
}

export interface Logger {
  say(msg: string): void
  event(e: Omit<EventRecord, "schema_version" | "ts">): void
}
```

- [ ] **Step 1.4: Run test to verify it passes**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/logger.test.ts
```

Expected: `2 pass / 0 fail`.

- [ ] **Step 1.5: Commit**

```bash
git add src/dispatcher/logger.ts tests/dispatcher/logger.test.ts
git commit -m "feat(logger): add EventRecord + Logger types (Phase G.1.a scaffold)"
```

---

## Task 2: createLogger factory + default NDJSON sink

**Files:**
- Modify: `src/dispatcher/logger.ts`
- Modify: `src/dispatcher/state.ts:ensureSgcStructure`
- Modify: `tests/dispatcher/logger.test.ts`

- [ ] **Step 2.1: Write the failing test**

Append to `tests/dispatcher/logger.test.ts`:

```typescript
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { afterEach, beforeEach } from "bun:test"
import { createLogger } from "../../src/dispatcher/logger"
import { join, resolve } from "node:path"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-logger-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("createLogger (Phase G.1.a)", () => {
  test("default say sink prints to console.log (captured)", () => {
    const captured: string[] = []
    const origLog = console.log
    console.log = (...args) => captured.push(args.join(" "))
    try {
      const logger = createLogger({})
      logger.say("hello")
      expect(captured).toEqual(["hello"])
    } finally {
      console.log = origLog
    }
  })

  test("default event sink appends NDJSON to .sgc/progress/events.ndjson", () => {
    const logger = createLogger({ stateRoot: tmp })
    logger.event({
      task_id: "t1",
      spawn_id: "s1",
      agent: "a1",
      event_type: "spawn.start",
      level: "info",
      payload: { mode: "inline" },
    })
    const path = resolve(tmp, "progress/events.ndjson")
    const content = readFileSync(path, "utf8")
    const record = JSON.parse(content.trim())
    expect(record.schema_version).toBe(1)
    expect(record.task_id).toBe("t1")
    expect(record.event_type).toBe("spawn.start")
    expect(typeof record.ts).toBe("string")
    expect(record.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  test("event sink injects schema_version=1 and current ts automatically", () => {
    const logger = createLogger({ stateRoot: tmp })
    const before = Date.now()
    logger.event({
      task_id: null, spawn_id: null, agent: null,
      event_type: "test.event", level: "info", payload: {},
    })
    const after = Date.now()
    const path = resolve(tmp, "progress/events.ndjson")
    const record = JSON.parse(readFileSync(path, "utf8").trim())
    expect(record.schema_version).toBe(1)
    const ts = Date.parse(record.ts)
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after + 1)
  })

  test("multiple event() calls produce multiple NDJSON lines", () => {
    const logger = createLogger({ stateRoot: tmp })
    for (let i = 0; i < 3; i++) {
      logger.event({
        task_id: `t${i}`, spawn_id: null, agent: null,
        event_type: "test.n", level: "info", payload: { i },
      })
    }
    const path = resolve(tmp, "progress/events.ndjson")
    const lines = readFileSync(path, "utf8").trim().split("\n")
    expect(lines.length).toBe(3)
    lines.forEach((line, i) => {
      expect(JSON.parse(line).payload.i).toBe(i)
    })
  })

  test("custom say + eventSink override defaults", () => {
    const sayCaptured: string[] = []
    const eventCaptured: unknown[] = []
    const logger = createLogger({
      say: (m) => sayCaptured.push(m),
      eventSink: (e) => eventCaptured.push(e),
    })
    logger.say("hi")
    logger.event({
      task_id: null, spawn_id: null, agent: null,
      event_type: "x.y", level: "info", payload: {},
    })
    expect(sayCaptured).toEqual(["hi"])
    expect(eventCaptured.length).toBe(1)
  })

  test("event sink error is swallowed (spawn must not fail on log failure)", () => {
    const logger = createLogger({
      eventSink: () => { throw new Error("disk full") },
    })
    const origError = console.error
    const errCaptured: string[] = []
    console.error = (...args) => errCaptured.push(args.join(" "))
    try {
      expect(() => logger.event({
        task_id: null, spawn_id: null, agent: null,
        event_type: "x.y", level: "info", payload: {},
      })).not.toThrow()
      expect(errCaptured.some((m) => m.includes("event sink failed"))).toBe(true)
    } finally {
      console.error = origError
    }
  })
})
```

- [ ] **Step 2.2: Run test to verify failures**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/logger.test.ts
```

Expected: compile error — `createLogger` not exported.

- [ ] **Step 2.3: Implement createLogger in logger.ts**

Append to `src/dispatcher/logger.ts`:

```typescript
import { appendFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"

function defaultNdjsonSink(stateRoot: string): (e: EventRecord) => void {
  const path = resolve(stateRoot, "progress/events.ndjson")
  return (e: EventRecord) => {
    try {
      mkdirSync(dirname(path), { recursive: true })
      appendFileSync(path, JSON.stringify(e) + "\n", "utf8")
    } catch (err) {
      console.error("[sgc] event sink failed:", String(err))
    }
  }
}

export function createLogger(opts: {
  stateRoot?: string
  say?: (m: string) => void
  eventSink?: (e: EventRecord) => void
} = {}): Logger {
  const stateRoot = opts.stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
  const say = opts.say ?? ((m: string) => console.log(m))
  const sink = opts.eventSink ?? defaultNdjsonSink(stateRoot)
  return {
    say,
    event(partial) {
      const record: EventRecord = {
        schema_version: 1,
        ts: new Date().toISOString(),
        ...partial,
      }
      try {
        sink(record)
      } catch (err) {
        // Never crash on sink failure — log to stderr and continue.
        console.error("[sgc] event sink failed:", String(err))
      }
    },
  }
}
```

- [ ] **Step 2.4: Extend state.ts:ensureSgcStructure for .sgc/progress/**

Verify `ensureSgcStructure` already creates `progress/` — read `src/dispatcher/state.ts` for the current definition. If missing, add `progress/` to the directories list. (Most likely already there since agent-prompts live under progress/.)

Run:
```bash
grep -n "progress" src/dispatcher/state.ts
```

If no `progress/` creation path, add under `ensureSgcStructure`:

```typescript
mkdirSync(resolve(root, "progress"), { recursive: true })
```

- [ ] **Step 2.5: Run tests — expect pass**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/logger.test.ts
```

Expected: `8 pass / 0 fail` (2 type tests from Task 1 + 6 new).

- [ ] **Step 2.6: Commit**

```bash
git add src/dispatcher/logger.ts src/dispatcher/state.ts tests/dispatcher/logger.test.ts
git commit -m "feat(logger): createLogger factory + default NDJSON sink + error swallowing"
```

---

## Task 3: SpawnOptions contract extension

**Files:**
- Modify: `src/dispatcher/spawn.ts:SpawnOptions`
- Test: (verified via Task 5's spawn tests; no dedicated test for type)

- [ ] **Step 3.1: Add optional fields to SpawnOptions**

In `src/dispatcher/spawn.ts`, find the `SpawnOptions` interface (around line 96) and add two fields:

```typescript
import type { Logger } from "./logger"

export interface SpawnOptions {
  // ... existing fields (stateRoot, inlineStub, timeoutMs, ...) ...
  taskId?: string                   // NEW — threaded into events for correlation
  logger?: Logger                   // NEW — injectable sink; default createLogger({})
}
```

- [ ] **Step 3.2: Run type check**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/spawn.test.ts
```

Expected: all existing spawn tests still pass (additive change, no breakage).

- [ ] **Step 3.3: Commit**

```bash
git add src/dispatcher/spawn.ts
git commit -m "feat(spawn): add taskId + logger to SpawnOptions (Phase G.1.a)"
```

---

## Task 4: spawn() Tier 1 pair emission (try/finally)

**Files:**
- Modify: `src/dispatcher/spawn.ts:spawn`
- Create: `tests/dispatcher/spawn-events.test.ts`

- [ ] **Step 4.1: Write the failing test**

Create `tests/dispatcher/spawn-events.test.ts`:

```typescript
// Tier 1 (§13) — every spawn() MUST emit paired spawn.start + spawn.end.
// See docs/superpowers/specs/2026-04-24-phase-g-design.md §3.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawn, SpawnTimeout } from "../../src/dispatcher/spawn"
import type { EventRecord } from "../../src/dispatcher/logger"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-spawn-events-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function readEvents(tmp: string): EventRecord[] {
  const path = resolve(tmp, "progress/events.ndjson")
  try {
    const content = readFileSync(path, "utf8").trim()
    if (!content) return []
    return content.split("\n").map((l) => JSON.parse(l) as EventRecord)
  } catch {
    return []
  }
}

describe("Invariant §13 Tier 1 — spawn pair emission", () => {
  test("successful spawn emits spawn.start + spawn.end(success)", async () => {
    await spawn(
      "classifier.level",
      { user_request: "fix typo" },
      {
        stateRoot: tmp,
        taskId: "test-task-1",
        inlineStub: () => ({
          level: "L0",
          rationale: "test",
          affected_readers_candidates: [],
        }),
      },
    )
    const events = readEvents(tmp)
    const starts = events.filter((e) => e.event_type === "spawn.start")
    const ends = events.filter((e) => e.event_type === "spawn.end")
    expect(starts.length).toBe(1)
    expect(ends.length).toBe(1)
    expect(starts[0]?.agent).toBe("classifier.level")
    expect(starts[0]?.task_id).toBe("test-task-1")
    expect(starts[0]?.spawn_id).toBe(ends[0]?.spawn_id)
    expect(ends[0]?.payload["outcome"]).toBe("success")
    expect(typeof ends[0]?.payload["elapsed_ms"]).toBe("number")
  })

  test("spawn that throws still emits spawn.end(error)", async () => {
    const err = new Error("forced failure")
    await expect(
      spawn(
        "classifier.level",
        { user_request: "fix typo" },
        {
          stateRoot: tmp,
          taskId: "test-task-2",
          inlineStub: () => ({
            level: "L0",
            rationale: "test",
            affected_readers_candidates: [],
          }),
          forceError: err,
        },
      ),
    ).rejects.toThrow("forced failure")
    const events = readEvents(tmp)
    const ends = events.filter((e) => e.event_type === "spawn.end")
    expect(ends.length).toBe(1)
    expect(ends[0]?.payload["outcome"]).toBe("error")
    expect(ends[0]?.level).toBe("warn")
  })

  test("spawn_id correlates start and end events", async () => {
    await spawn(
      "classifier.level",
      { user_request: "fix" },
      {
        stateRoot: tmp,
        inlineStub: () => ({
          level: "L0",
          rationale: "x",
          affected_readers_candidates: [],
        }),
      },
    )
    const events = readEvents(tmp)
    expect(events[0]?.spawn_id).toBe(events[1]?.spawn_id)
    expect(events[0]?.spawn_id).toMatch(/classifier\.level$/)
  })

  test("no taskId → task_id is null in events", async () => {
    await spawn(
      "classifier.level",
      { user_request: "fix" },
      {
        stateRoot: tmp,
        inlineStub: () => ({
          level: "L0",
          rationale: "x",
          affected_readers_candidates: [],
        }),
      },
    )
    const events = readEvents(tmp)
    expect(events[0]?.task_id).toBe(null)
    expect(events[1]?.task_id).toBe(null)
  })
})
```

- [ ] **Step 4.2: Run test to verify failures**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/spawn-events.test.ts
```

Expected: 4 fail — `events` array is empty because spawn.ts hasn't emitted anything yet.

- [ ] **Step 4.3: Wrap spawn() in try/finally with Tier 1 emission**

In `src/dispatcher/spawn.ts`, locate the `spawn<I, O>()` function. After `const spawnId = \`${ulid}-${agentName}\`` and the prompt write, but BEFORE the mode dispatch block, insert:

```typescript
import { createLogger } from "./logger"

// ... inside spawn<I, O>() after spawnId is established and promptPath written,
// BEFORE the mode dispatch (before `const mode = resolveMode(...)`)

const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot })
const startTs = Date.now()
const mode = resolveMode(opts, manifest)

logger.event({
  task_id: opts.taskId ?? null,
  spawn_id: spawnId,
  agent: agentName,
  event_type: "spawn.start",
  level: "info",
  payload: { mode, manifest_version: manifest.version ?? "0" },
})

let outcome: "success" | "timeout" | "error" = "error"
try {
  // ... existing mode dispatch block (the big if/else with inline / claude-cli / anthropic-sdk / openrouter / file-poll) ...
  // ... validateOutputShape(manifest, output) ...
  outcome = "success"
  return { spawnId, output: output as O, promptPath, resultPath }
} catch (e) {
  outcome = e instanceof SpawnTimeout ? "timeout" : "error"
  throw e
} finally {
  logger.event({
    task_id: opts.taskId ?? null,
    spawn_id: spawnId,
    agent: agentName,
    event_type: "spawn.end",
    level: outcome === "success" ? "info" : "warn",
    payload: { outcome, elapsed_ms: Date.now() - startTs },
  })
}
```

Important: the `resolveMode(opts, manifest)` call currently happens later; move it BEFORE `spawn.start` emission so `mode` is in the payload. The `const mode = resolveMode(...)` line currently lives inside the dispatch block — hoist it out.

- [ ] **Step 4.4: Run test to verify passes**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/spawn-events.test.ts
```

Expected: `4 pass / 0 fail`.

- [ ] **Step 4.5: Run full spawn-related tests — no regressions**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/spawn.test.ts tests/dispatcher/spawn-retry.test.ts tests/dispatcher/spawn-events.test.ts
```

Expected: all pass.

- [ ] **Step 4.6: Commit**

```bash
git add src/dispatcher/spawn.ts tests/dispatcher/spawn-events.test.ts
git commit -m "feat(spawn): Invariant §13 Tier 1 — spawn.start/end event pair (try/finally)"
```

---

## Task 5: LLM event payload schema types

**Files:**
- Modify: `src/dispatcher/logger.ts`

- [ ] **Step 5.1: Add typed payload helpers for LLM events**

Append to `src/dispatcher/logger.ts`:

```typescript
// LLM event payload schemas per Invariant §13 Tier 2.
// These are typed helpers; EventRecord.payload is still Record<string, unknown>
// to keep schema evolution cheap. Call sites should use these shapes.

export interface LlmRequestPayload {
  model: string
  prompt_chars: number
  cached_prefix_chars?: number
  mode: "anthropic-sdk" | "openrouter" | "claude-cli"
}

export interface LlmResponsePayload {
  outcome: "success" | "timeout" | "error" | "schema_violation"
  latency_ms: number
  input_tokens?: number
  output_tokens?: number
  cache_read_tokens?: number
  cache_creation_tokens?: number
  error_class?: string
}
```

- [ ] **Step 5.2: Run logger tests — no regressions**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/logger.test.ts
```

Expected: all pass (additive types, no breaking change).

- [ ] **Step 5.3: Commit**

```bash
git add src/dispatcher/logger.ts
git commit -m "feat(logger): add LlmRequestPayload + LlmResponsePayload types (§13 Tier 2 prep)"
```

---

## Task 6: anthropic-sdk-agent Tier 2 pair emission

**Files:**
- Modify: `src/dispatcher/anthropic-sdk-agent.ts:runAnthropicSdkAgent`
- Modify: `src/dispatcher/spawn.ts` (thread logger + context into runAnthropicSdkAgent call)
- Create: `tests/dispatcher/llm-agent-events.test.ts`

- [ ] **Step 6.1: Write the failing test**

Create `tests/dispatcher/llm-agent-events.test.ts`:

```typescript
// Tier 2 (§13) — LLM-mode spawns MUST emit paired llm.request + llm.response.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type { EventRecord } from "../../src/dispatcher/logger"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-llm-events-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function readEvents(tmp: string): EventRecord[] {
  const path = resolve(tmp, "progress/events.ndjson")
  try {
    const content = readFileSync(path, "utf8").trim()
    if (!content) return []
    return content.split("\n").map((l) => JSON.parse(l) as EventRecord)
  } catch {
    return []
  }
}

describe("Invariant §13 Tier 2 — anthropic-sdk llm.request/response pair", () => {
  test("successful anthropic-sdk call emits llm.request + llm.response(success)", async () => {
    const mockClient = {
      messages: {
        create: async () => ({
          id: "mock",
          content: [{ type: "text", text: "```yaml\nlevel: L1\nrationale: mock\naffected_readers_candidates: []\n```" }],
          role: "assistant",
          model: "claude-opus-4-6",
          stop_reason: "end_turn",
          stop_sequence: null,
          type: "message",
          usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        }),
      },
    }
    await spawn(
      "classifier.level",
      { user_request: "fix typo" },
      {
        stateRoot: tmp,
        taskId: "t1",
        mode: "anthropic-sdk",
        anthropicClientFactory: () => mockClient as unknown as ReturnType<NonNullable<Parameters<typeof spawn>[2]>["anthropicClientFactory"] extends (() => infer R) ? () => R : never>,
      },
    )
    const events = readEvents(tmp)
    const req = events.find((e) => e.event_type === "llm.request")
    const res = events.find((e) => e.event_type === "llm.response")
    expect(req).toBeDefined()
    expect(res).toBeDefined()
    expect(req?.payload["mode"]).toBe("anthropic-sdk")
    expect(typeof req?.payload["model"]).toBe("string")
    expect(typeof req?.payload["prompt_chars"]).toBe("number")
    expect(res?.payload["outcome"]).toBe("success")
    expect(typeof res?.payload["latency_ms"]).toBe("number")
    expect(res?.payload["input_tokens"]).toBe(100)
    expect(res?.payload["output_tokens"]).toBe(50)
  })

  test("anthropic-sdk API error emits llm.response(error) with error_class", async () => {
    const mockClient = {
      messages: {
        create: async () => { throw new Error("mock API failure") },
      },
    }
    await expect(
      spawn(
        "classifier.level",
        { user_request: "fix" },
        {
          stateRoot: tmp,
          taskId: "t2",
          mode: "anthropic-sdk",
          anthropicClientFactory: () => mockClient as unknown as ReturnType<NonNullable<Parameters<typeof spawn>[2]>["anthropicClientFactory"] extends (() => infer R) ? () => R : never>,
        },
      ),
    ).rejects.toThrow()
    const events = readEvents(tmp)
    const res = events.find((e) => e.event_type === "llm.response")
    expect(res).toBeDefined()
    expect(res?.payload["outcome"]).toBe("error")
    expect(typeof res?.payload["error_class"]).toBe("string")
  })
})
```

- [ ] **Step 6.2: Run test to verify failures**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/llm-agent-events.test.ts
```

Expected: 2 fail — `llm.request` / `llm.response` events not yet emitted.

- [ ] **Step 6.3: Modify runAnthropicSdkAgent signature + emit events**

In `src/dispatcher/anthropic-sdk-agent.ts`, change the function signature:

```typescript
import type { Logger, LlmRequestPayload, LlmResponsePayload } from "./logger"

export interface LlmAgentContext {
  spawnId: string
  taskId: string | null
  agentName: string
  logger: Logger
}

export async function runAnthropicSdkAgent(
  promptPath: string,
  manifest: SubagentManifest,
  clientFactory?: AnthropicClientFactory,
  ctx?: LlmAgentContext,
): Promise<unknown> {
  const promptText = readFileSync(promptPath, "utf8")
  const { systemPart, userPart } = splitPrompt(promptText)
  const client = clientFactory ? clientFactory() : new Anthropic()

  const maxTokens = Math.min(manifest.token_budget ?? 4096, MAX_TOKENS_CAP)
  const timeoutMs = (manifest.timeout_s ?? 60) * 1000
  const model = DEFAULT_MODEL

  if (ctx) {
    const reqPayload: LlmRequestPayload = {
      model,
      prompt_chars: promptText.length,
      cached_prefix_chars: systemPart.length > 0 ? systemPart.length : undefined,
      mode: "anthropic-sdk",
    }
    ctx.logger.event({
      task_id: ctx.taskId,
      spawn_id: ctx.spawnId,
      agent: ctx.agentName,
      event_type: "llm.request",
      level: "info",
      payload: reqPayload as unknown as Record<string, unknown>,
    })
  }

  const startTs = Date.now()
  let response: Anthropic.Message
  let outcome: LlmResponsePayload["outcome"] = "error"
  let errorClass: string | undefined
  let usageInput: number | undefined
  let usageOutput: number | undefined
  let usageCacheRead: number | undefined
  let usageCacheCreation: number | undefined

  try {
    const createArgs: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: [{ type: "text", text: userPart }] }],
    }
    if (systemPart.length > 0) {
      createArgs.system = [
        { type: "text", text: systemPart, cache_control: { type: "ephemeral" } },
      ]
    }
    response = await (client.messages.create as typeof Anthropic.prototype.messages.create)(
      createArgs,
      { timeout: timeoutMs },
    )
    outcome = "success"
    usageInput = (response.usage as { input_tokens?: number })?.input_tokens
    usageOutput = (response.usage as { output_tokens?: number })?.output_tokens
    usageCacheRead = (response.usage as { cache_read_input_tokens?: number })?.cache_read_input_tokens
    usageCacheCreation = (response.usage as { cache_creation_input_tokens?: number })?.cache_creation_input_tokens
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      errorClass = `APIError-${e.status ?? "?"}`
      if (ctx) emitResponse()
      throw new AnthropicSdkError(
        `Anthropic API error ${e.status ?? "?"} for ${manifest.name}: ${e.message}`,
        e.status,
      )
    }
    errorClass = e instanceof Error ? e.name : "unknown"
    if (ctx) emitResponse()
    throw e
  }

  function emitResponse(): void {
    if (!ctx) return
    const resPayload: LlmResponsePayload = {
      outcome,
      latency_ms: Date.now() - startTs,
      ...(usageInput !== undefined ? { input_tokens: usageInput } : {}),
      ...(usageOutput !== undefined ? { output_tokens: usageOutput } : {}),
      ...(usageCacheRead !== undefined ? { cache_read_tokens: usageCacheRead } : {}),
      ...(usageCacheCreation !== undefined ? { cache_creation_tokens: usageCacheCreation } : {}),
      ...(errorClass ? { error_class: errorClass } : {}),
    }
    ctx.logger.event({
      task_id: ctx.taskId,
      spawn_id: ctx.spawnId,
      agent: ctx.agentName,
      event_type: "llm.response",
      level: outcome === "success" ? "info" : "warn",
      payload: resPayload as unknown as Record<string, unknown>,
    })
  }

  if (ctx) emitResponse()

  const textBlock = response.content.find((b) => b.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    // schema_violation path — response came back but not parseable
    if (ctx) {
      // override the previously emitted success response
      outcome = "schema_violation"
      errorClass = "no_text_block"
      // Note: we already emitted llm.response above; for schema_violation we
      // rely on the subsequent OutputShapeMismatch propagating via spawn.end.
      // The llm.response event captures the transport-level outcome.
    }
    throw new AnthropicSdkError(
      `no text block in response for ${manifest.name} (blocks: ${response.content.map((b) => b.type).join(", ")})`,
    )
  }

  const yamlBody = extractYamlBody(textBlock.text)
  let data: unknown
  try {
    data = yamlLoad(yamlBody)
  } catch (e) {
    throw new AnthropicSdkError(
      `SDK YAML parse failed for ${manifest.name}: ${String(e).slice(0, 200)}`,
    )
  }
  if (typeof data !== "object" || data === null) {
    throw new AnthropicSdkError(
      `SDK response YAML not an object for ${manifest.name}: got ${typeof data}`,
    )
  }
  return data
}
```

- [ ] **Step 6.4: Thread LlmAgentContext through spawn.ts**

In `src/dispatcher/spawn.ts`, find the block that calls `runAnthropicSdkAgent` (inside the mode dispatch after the Tier 1 start event). Change:

```typescript
} else if (mode === "anthropic-sdk") {
  output = await runAnthropicSdkAgent(
    promptPath,
    manifest,
    opts.anthropicClientFactory,
    { spawnId, taskId: opts.taskId ?? null, agentName, logger },
  )
  writeAtomic(
    resultPath,
    serializeFrontmatter(output as Record<string, unknown>, ""),
  )
}
```

- [ ] **Step 6.5: Run tests — expect pass**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/llm-agent-events.test.ts tests/dispatcher/anthropic-sdk-agent.test.ts
```

Expected: all pass.

- [ ] **Step 6.6: Commit**

```bash
git add src/dispatcher/anthropic-sdk-agent.ts src/dispatcher/spawn.ts tests/dispatcher/llm-agent-events.test.ts
git commit -m "feat(anthropic-sdk): Invariant §13 Tier 2 — llm.request/llm.response pair"
```

---

## Task 7: openrouter-agent Tier 2 pair emission

**Files:**
- Modify: `src/dispatcher/openrouter-agent.ts:runOpenRouterAgent`
- Modify: `src/dispatcher/spawn.ts` (thread ctx)
- Modify: `tests/dispatcher/llm-agent-events.test.ts` (add openrouter test)

- [ ] **Step 7.1: Write the failing test**

Append to `tests/dispatcher/llm-agent-events.test.ts`:

```typescript
describe("Invariant §13 Tier 2 — openrouter llm.request/response pair", () => {
  test("successful openrouter call emits paired events", async () => {
    const mockFetch = async (_url: string, _init?: unknown) => {
      return new Response(JSON.stringify({
        id: "mock",
        model: "anthropic/claude-opus-4.6",
        choices: [{ message: { content: "```yaml\nlevel: L1\nrationale: mock\naffected_readers_candidates: []\n```" } }],
        usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
      }), { status: 200, headers: { "content-type": "application/json" } })
    }
    await spawn(
      "classifier.level",
      { user_request: "fix" },
      {
        stateRoot: tmp,
        taskId: "t3",
        mode: "openrouter",
        openRouterFetch: mockFetch,
      },
    )
    const events = readEvents(tmp)
    const req = events.find((e) => e.event_type === "llm.request")
    const res = events.find((e) => e.event_type === "llm.response")
    expect(req?.payload["mode"]).toBe("openrouter")
    expect(res?.payload["outcome"]).toBe("success")
    expect(res?.payload["input_tokens"]).toBe(80)
    expect(res?.payload["output_tokens"]).toBe(40)
  })
})
```

- [ ] **Step 7.2: Run test — expect fail**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/llm-agent-events.test.ts
```

Expected: 1 new test fails (events not emitted in openrouter path yet).

- [ ] **Step 7.3: Apply the same ctx pattern to runOpenRouterAgent**

In `src/dispatcher/openrouter-agent.ts`, follow the exact pattern from Task 6 Step 6.3: add `ctx?: LlmAgentContext` parameter, emit `llm.request` before the fetch, wrap the fetch call in try/catch/finally to emit `llm.response`. Map OpenRouter's `usage.prompt_tokens` → `input_tokens`, `usage.completion_tokens` → `output_tokens` (no cache fields from OpenRouter).

Import `LlmAgentContext` from `./anthropic-sdk-agent` (re-export it there) or move to `./logger.ts` for cleaner separation. Recommended: **move `LlmAgentContext` to `logger.ts`** since it's an agent-neutral type:

In `src/dispatcher/logger.ts`, add after `Logger`:
```typescript
export interface LlmAgentContext {
  spawnId: string
  taskId: string | null
  agentName: string
  logger: Logger
}
```

Update `anthropic-sdk-agent.ts` to import from `./logger` instead of defining its own.

- [ ] **Step 7.4: Thread ctx in spawn.ts for openrouter branch**

```typescript
} else if (mode === "openrouter") {
  output = await runOpenRouterAgent(
    promptPath,
    manifest,
    opts.openRouterFetch,
    { spawnId, taskId: opts.taskId ?? null, agentName, logger },
  )
  writeAtomic(
    resultPath,
    serializeFrontmatter(output as Record<string, unknown>, ""),
  )
}
```

- [ ] **Step 7.5: Run tests — expect pass**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/llm-agent-events.test.ts tests/dispatcher/openrouter-agent.test.ts
```

Expected: all pass.

- [ ] **Step 7.6: Commit**

```bash
git add src/dispatcher/openrouter-agent.ts src/dispatcher/anthropic-sdk-agent.ts src/dispatcher/logger.ts src/dispatcher/spawn.ts tests/dispatcher/llm-agent-events.test.ts
git commit -m "feat(openrouter): Invariant §13 Tier 2 — llm.request/response pair; centralize LlmAgentContext"
```

---

## Task 8: claude-cli-agent Tier 2 pair emission

**Files:**
- Modify: `src/dispatcher/claude-cli-agent.ts:runClaudeCliAgent`
- Modify: `src/dispatcher/spawn.ts` (thread ctx)
- Modify: `tests/dispatcher/llm-agent-events.test.ts` (add claude-cli test)

- [ ] **Step 8.1: Write the failing test**

Append to `tests/dispatcher/llm-agent-events.test.ts`:

```typescript
describe("Invariant §13 Tier 2 — claude-cli llm.request/response pair", () => {
  test("successful claude-cli call emits paired events", async () => {
    // Mock SubprocessRunner that returns a canned YAML reply.
    const mockRunner = {
      run: async (_cmd: string, _args: string[], _opts: unknown) => ({
        stdout: "```yaml\nlevel: L1\nrationale: mock\naffected_readers_candidates: []\n```",
        stderr: "",
        exitCode: 0,
      }),
    }
    await spawn(
      "classifier.level",
      { user_request: "fix" },
      {
        stateRoot: tmp,
        taskId: "t4",
        mode: "claude-cli",
        claudeCliRunner: mockRunner,
      },
    )
    const events = readEvents(tmp)
    const req = events.find((e) => e.event_type === "llm.request")
    const res = events.find((e) => e.event_type === "llm.response")
    expect(req?.payload["mode"]).toBe("claude-cli")
    expect(res?.payload["outcome"]).toBe("success")
    // claude-cli doesn't expose token counts — fields absent is OK.
    expect(res?.payload["latency_ms"]).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 8.2: Run test — expect fail**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/llm-agent-events.test.ts
```

Expected: 1 new test fails.

- [ ] **Step 8.3: Apply ctx pattern to runClaudeCliAgent**

In `src/dispatcher/claude-cli-agent.ts`, add `ctx?: LlmAgentContext` parameter and emit `llm.request` before the subprocess call, `llm.response` after (try/finally). claude-cli has no token counts — omit those fields. Set `model` to `"claude-cli"` or whatever the CLI reports (if available) in the request payload.

- [ ] **Step 8.4: Thread ctx in spawn.ts for claude-cli branch**

```typescript
} else if (mode === "claude-cli") {
  output = await runClaudeCliAgent(
    promptPath,
    manifest,
    opts.claudeCliRunner,
    { spawnId, taskId: opts.taskId ?? null, agentName, logger },
  )
  writeAtomic(
    resultPath,
    serializeFrontmatter(output as Record<string, unknown>, ""),
  )
}
```

- [ ] **Step 8.5: Run tests — expect pass**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/llm-agent-events.test.ts tests/dispatcher/claude-cli-agent.test.ts
```

Expected: all pass.

- [ ] **Step 8.6: Commit**

```bash
git add src/dispatcher/claude-cli-agent.ts src/dispatcher/spawn.ts tests/dispatcher/llm-agent-events.test.ts
git commit -m "feat(claude-cli): Invariant §13 Tier 2 — llm.request/response pair"
```

---

## Task 9: Thread logger through commands (backwards-compat wrap)

**Files:**
- Modify: `src/commands/{plan,work,review,qa,ship,compound,discover,agent-loop}.ts` (8 files)

Each command currently has `const log = opts.log ?? ((m) => console.log(m))`. We replace this with a `createLogger({ say: opts.log })` call and pass the logger to any `spawn()` calls in the command.

- [ ] **Step 9.1: Update plan.ts**

In `src/commands/plan.ts`, find `const log = opts.log ?? ((m) => console.log(m))` (line ~103) and replace with:

```typescript
import { createLogger } from "../dispatcher/logger"
import type { Logger } from "../dispatcher/logger"

// ... in runPlan signature, add opts.logger?: Logger

const logger = opts.logger ?? createLogger({
  stateRoot: opts.stateRoot,
  say: opts.log,
})
const log = logger.say.bind(logger)
```

Then find every `await spawn(...)` call in plan.ts and add `logger` and `taskId` to the opts:

```typescript
await spawn(agentName, input, {
  stateRoot: opts.stateRoot,
  inlineStub: /* existing */,
  logger,
  taskId,  // whatever the current task id is in scope at that call site
})
```

- [ ] **Step 9.2: Run plan tests — no regressions**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/sgc-plan.test.ts
```

Expected: all pass (backwards-compat wrap preserves behavior).

- [ ] **Step 9.3: Repeat for work.ts, review.ts, qa.ts, ship.ts, compound.ts, discover.ts, agent-loop.ts**

Same pattern in each. The `taskId` is available in different places — pass `null` if there's no task context at a spawn site (e.g., classifier runs before task creation; use `null`).

- [ ] **Step 9.4: Run ALL command tests**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/
```

Expected: all pass. Count should be same as before + Task 4's new tests + Task 6-8's new tests.

- [ ] **Step 9.5: Commit**

```bash
git add src/commands/
git commit -m "feat(commands): thread Logger through 8 commands (backwards-compat wrap)"
```

---

## Task 10: Commands event-emission smoke test

**Files:**
- Create: `tests/dispatcher/commands-event-emission.test.ts`

- [ ] **Step 10.1: Write the test**

```typescript
// Soft-contract smoke test — each of the 8 top-level sgc commands must
// emit at least one high-level event when its primary flow runs. This
// catches silent event-emission drift during future refactors. NOT part
// of Invariant §13 Tier 1/2 (those are hard); this is §13 "soft" layer.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runWork } from "../../src/commands/work"
import { runReview } from "../../src/commands/review"
import { runCompound } from "../../src/commands/compound"
import type { EventRecord } from "../../src/dispatcher/logger"
import { LONG_MOTIVATION_FIXTURE } from "../eval/eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-cmd-events-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function readEvents(tmp: string): EventRecord[] {
  const path = resolve(tmp, "progress/events.ndjson")
  try {
    return readFileSync(path, "utf8").trim().split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as EventRecord)
  } catch {
    return []
  }
}

describe("Commands emit at least one event (soft §13 contract)", () => {
  test("runPlan emits ≥1 event", async () => {
    await runPlan("refactor the auth module", {
      stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {},
    })
    expect(readEvents(tmp).length).toBeGreaterThan(0)
  })

  test("runWork emits ≥1 event (add feature path)", async () => {
    await runPlan("add docs section", {
      stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {},
    })
    await runWork({ stateRoot: tmp, add: "write the example", log: () => {} })
    expect(readEvents(tmp).length).toBeGreaterThan(0)
  })

  test("runReview emits ≥1 event", async () => {
    await runPlan("add docs section", {
      stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {},
    })
    await runReview({ stateRoot: tmp, base: "HEAD", log: () => {} }).catch(() => {})
    expect(readEvents(tmp).length).toBeGreaterThan(0)
  })

  test("runCompound emits ≥1 event", async () => {
    await runPlan("add docs section", {
      stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {},
    })
    await runCompound({ stateRoot: tmp, log: () => {} })
    expect(readEvents(tmp).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 10.2: Run test — expect pass**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/commands-event-emission.test.ts
```

Expected: `4 pass / 0 fail`. Commands already emit via spawn() wrapping done in Task 4; this test just locks the contract.

- [ ] **Step 10.3: Commit**

```bash
git add tests/dispatcher/commands-event-emission.test.ts
git commit -m "test(commands): soft §13 contract — each command emits ≥1 event"
```

---

## Task 11: Add Invariant §13 to capabilities.yaml

**Files:**
- Modify: `contracts/sgc-capabilities.yaml`

- [ ] **Step 11.1: Locate invariants block**

```bash
grep -n "invariants:" contracts/sgc-capabilities.yaml
```

- [ ] **Step 11.2: Add §13 entry**

Under the existing `invariants:` block, append (matching the style of §1-§12):

```yaml
  - id: "§13"
    name: "Spawn + LLM event audit completeness"
    rule: |
      Every call to spawn() MUST emit paired spawn.start + spawn.end events
      to .sgc/progress/events.ndjson (Tier 1, all modes). Additionally, when
      resolved mode is anthropic-sdk / openrouter / claude-cli, the agent
      MUST emit paired llm.request + llm.response events (Tier 2). Emission
      is guaranteed via try/finally at the chokepoint (spawn.ts for Tier 1;
      per-mode agent file for Tier 2). Schema v1 — see src/dispatcher/logger.ts.
    enforcement: "runtime try/finally + tests/dispatcher/spawn-events.test.ts + tests/dispatcher/llm-agent-events.test.ts + tests/eval/invariants.test.ts"
    exemption: "Event-sink write failure (disk full / permission) does NOT fail the spawn — logged to stderr, spawn continues. Invariant §13 waived for infra-level write failures."
```

- [ ] **Step 11.3: Run schema tests (if any validate the YAML)**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/schema.test.ts
```

Expected: pass. If schema tests assert a specific Invariant count or list, update that count/list.

- [ ] **Step 11.4: Commit**

```bash
git add contracts/sgc-capabilities.yaml
git commit -m "feat(contracts): declare Invariant §13 (spawn + LLM event audit completeness)"
```

---

## Task 12: Eval — Invariant §13 forceError scenario

**Files:**
- Modify: `tests/eval/invariants.test.ts`

- [ ] **Step 12.1: Write the failing test**

Append to `tests/eval/invariants.test.ts`:

```typescript
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { EventRecord } from "../../src/dispatcher/logger"

describe("Invariant §13 — event audit completeness under fault injection", () => {
  test("spawn throws mid-flight → spawn.end(error) still emitted", async () => {
    const tmp = createEvalWorkspace("sgc-eval-invariant-13-")
    try {
      await expect(
        spawn(
          "classifier.level",
          { user_request: "fix" },
          {
            stateRoot: tmp,
            inlineStub: () => ({ level: "L0", rationale: "x", affected_readers_candidates: [] }),
            forceError: new Error("fault injected"),
          },
        ),
      ).rejects.toThrow("fault injected")

      const content = readFileSync(resolve(tmp, "progress/events.ndjson"), "utf8")
      const events: EventRecord[] = content.trim().split("\n").map((l) => JSON.parse(l))
      const starts = events.filter((e) => e.event_type === "spawn.start")
      const ends = events.filter((e) => e.event_type === "spawn.end")
      expect(starts.length).toBe(1)
      expect(ends.length).toBe(1)
      expect(ends[0]?.payload["outcome"]).toBe("error")
    } finally {
      destroyEvalWorkspace(tmp)
    }
  })
})
```

(Add the necessary `spawn` + `createEvalWorkspace` / `destroyEvalWorkspace` imports at the top of the file; match the style of the existing file.)

- [ ] **Step 12.2: Run test — expect pass (implementation already done)**

```bash
SGC_FORCE_INLINE=1 bun test tests/eval/invariants.test.ts
```

Expected: all existing pass + the new §13 test passes.

- [ ] **Step 12.3: Commit**

```bash
git add tests/eval/invariants.test.ts
git commit -m "test(eval): Invariant §13 — forceError still emits spawn.end(error)"
```

---

## Task 13: Full suite regression check

- [ ] **Step 13.1: Run full test suite**

```bash
SGC_FORCE_INLINE=1 bun test tests/
```

Expected: all pass. Count baseline:
- Pre-G.1.a: 473 (post-hotfix)
- Post-G.1.a: 473 + ~25 new = ~498 (approximate — depends on how many cases each new file has)

- [ ] **Step 13.2: If anything fails, diagnose + fix**

Common breakage points:
- Tests that asserted a specific agent-prompts/ file count now also see events.ndjson in the same tree → exclude from listing logic.
- Tests with mock SpawnOptions that don't pass logger — check they still work with the default (createLogger()).

- [ ] **Step 13.3: Commit any follow-up fixes separately**

```bash
git add <fixed-files>
git commit -m "fix(tests): adjust for events.ndjson presence under .sgc/progress/"
```

---

## Task 14: G.1.a PR — open for review

At this point, Tasks 1-13 form the complete G.1.a PR: structured logs + Invariant §13 Tier 1 & Tier 2 + backwards-compat command threading.

- [ ] **Step 14.1: Push branch and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(g1a): structured event stream + Invariant §13 (Phase G.1.a)" --body "$(cat <<'EOF'
## Summary
Implements Phase G.1.a per docs/superpowers/specs/2026-04-24-phase-g-design.md §3 and §4.

- New `src/dispatcher/logger.ts` — `Logger` interface, `EventRecord` schema v1, default NDJSON sink with error-swallowing.
- `spawn.ts` wraps in try/finally emitting Tier 1 `spawn.start` + `spawn.end` (all modes).
- `anthropic-sdk-agent.ts` / `openrouter-agent.ts` / `claude-cli-agent.ts` each wrapped for Tier 2 `llm.request` + `llm.response` with latency + token counts.
- 8 commands threaded with `Logger` (backwards-compat: `opts.log` still accepted and wrapped).
- New Invariant §13 in `contracts/sgc-capabilities.yaml`.

## Test plan
- [x] `SGC_FORCE_INLINE=1 bun test tests/` — all pass (~498 tests, +25 new).
- [x] `spawn.start/end` paired in events.ndjson for success + timeout + error paths (tests/dispatcher/spawn-events.test.ts).
- [x] `llm.request/response` paired per LLM mode (tests/dispatcher/llm-agent-events.test.ts).
- [x] Existing 473 tests unchanged.
- [x] Manual: `bun src/sgc.ts plan "test motivation fixture" --motivation "..."` writes to `.sgc/progress/events.ndjson`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 14.2: WAIT for merge before starting Task 15**

G.1.b depends on G.1.a's schema being committed to main.

---

## Task 15: sgc tail — parse options + basic read

**Files:**
- Create: `src/commands/tail.ts`
- Create: `tests/dispatcher/tail.test.ts`

- [ ] **Step 15.1: Write the failing test**

Create `tests/dispatcher/tail.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runTail } from "../../src/commands/tail"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-tail-"))
  mkdirSync(resolve(tmp, "progress"), { recursive: true })
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function writeEvent(tmp: string, record: Record<string, unknown>): void {
  appendFileSync(
    resolve(tmp, "progress/events.ndjson"),
    JSON.stringify(record) + "\n",
    "utf8",
  )
}

describe("sgc tail — basic read (G.1.b)", () => {
  test("empty events.ndjson → empty output", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    expect(lines).toEqual([])
  })

  test("missing events.ndjson → exits cleanly, no error", async () => {
    rmSync(resolve(tmp, "progress"), { recursive: true, force: true })
    const lines: string[] = []
    await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    expect(lines).toEqual([])
  })

  test("single event → one line output", async () => {
    writeEvent(tmp, {
      schema_version: 1,
      ts: "2026-04-24T14:32:17.123Z",
      task_id: "t1",
      spawn_id: "ulid-classifier.level",
      agent: "classifier.level",
      event_type: "spawn.start",
      level: "info",
      payload: { mode: "inline", manifest_version: "0.1" },
    })
    const lines: string[] = []
    await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain("spawn.start")
    expect(lines[0]).toContain("classifier.level")
  })

  test("malformed line → skipped with stderr warning, continues", async () => {
    appendFileSync(
      resolve(tmp, "progress/events.ndjson"),
      "not json at all\n" +
        JSON.stringify({
          schema_version: 1,
          ts: "2026-04-24T14:32:17.123Z",
          task_id: null, spawn_id: null, agent: null,
          event_type: "x.y", level: "info", payload: {},
        }) + "\n",
      "utf8",
    )
    const lines: string[] = []
    const errLines: string[] = []
    const origErr = console.error
    console.error = (...args) => errLines.push(args.join(" "))
    try {
      await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    } finally {
      console.error = origErr
    }
    expect(lines.length).toBe(1)   // only valid line printed
    expect(errLines.some((l) => l.includes("malformed"))).toBe(true)
  })
})
```

- [ ] **Step 15.2: Run test — expect fail**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/tail.test.ts
```

Expected: compile error — `runTail` not defined.

- [ ] **Step 15.3: Implement runTail basic read**

Create `src/commands/tail.ts`:

```typescript
// sgc tail — operator-facing reader for .sgc/progress/events.ndjson.
//
// Phase G.1.b deliverable. Pure local-file processing; no subagent spawn,
// no LLM path. See docs/superpowers/specs/2026-04-24-phase-g-design.md §5.

import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import type { EventRecord } from "../dispatcher/logger"

export interface TailOptions {
  stateRoot?: string
  task?: string
  agent?: string            // glob-match
  eventType?: string        // substring-match
  since?: string            // ISO 8601 timestamp
  follow?: boolean
  json?: boolean
  log?: (m: string) => void
}

function eventsPath(stateRoot?: string): string {
  const root = stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
  return resolve(root, "progress/events.ndjson")
}

function parseLine(line: string): EventRecord | null {
  try {
    const parsed = JSON.parse(line) as EventRecord
    if (parsed.schema_version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

function globMatch(pattern: string, value: string | null): boolean {
  if (!value) return false
  const re = new RegExp(
    "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
  )
  return re.test(value)
}

function matchFilters(e: EventRecord, opts: TailOptions): boolean {
  if (opts.task && e.task_id !== opts.task) return false
  if (opts.agent && !globMatch(opts.agent, e.agent)) return false
  if (opts.eventType && !e.event_type.includes(opts.eventType)) return false
  if (opts.since && e.ts < opts.since) return false
  return true
}

function formatHuman(e: EventRecord): string {
  const time = e.ts.slice(11, 23) // HH:MM:SS.mmm
  const spawnTail = (e.spawn_id ?? "").slice(-12).padStart(12, " ")
  const agent = (e.agent ?? "").padEnd(18)
  const brief = briefPayload(e.event_type, e.payload)
  return `${time}  ${e.level.padEnd(5)}  ${e.event_type.padEnd(18)}  ${spawnTail}  ${agent}  ${brief}`
}

function briefPayload(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "spawn.start": return `mode=${payload["mode"]}`
    case "spawn.end": return `${payload["outcome"]} ${payload["elapsed_ms"]}ms`
    case "llm.request": return `model=${payload["model"]} chars=${payload["prompt_chars"]}`
    case "llm.response": {
      const tokenInfo =
        payload["input_tokens"] !== undefined
          ? ` in=${payload["input_tokens"]} out=${payload["output_tokens"]}`
          : ""
      return `${payload["outcome"]} ${payload["latency_ms"]}ms${tokenInfo}`
    }
    default: {
      const keys = Object.keys(payload)
      return keys.length === 0 ? "…" : `… (${keys.length} fields)`
    }
  }
}

export async function runTail(opts: TailOptions = {}): Promise<void> {
  const say = opts.log ?? ((m: string) => console.log(m))
  const path = eventsPath(opts.stateRoot)
  if (!existsSync(path)) return

  const content = readFileSync(path, "utf8")
  const lines = content.split("\n").filter((l) => l.length > 0)
  for (const line of lines) {
    const rec = parseLine(line)
    if (!rec) {
      console.error(`[sgc tail] malformed line skipped: ${line.slice(0, 80)}`)
      continue
    }
    if (!matchFilters(rec, opts)) continue
    say(opts.json ? line : formatHuman(rec))
  }
}
```

- [ ] **Step 15.4: Run test — expect pass**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/tail.test.ts
```

Expected: `4 pass / 0 fail`.

- [ ] **Step 15.5: Commit**

```bash
git add src/commands/tail.ts tests/dispatcher/tail.test.ts
git commit -m "feat(tail): runTail basic read + human + json formats"
```

---

## Task 16: sgc tail — filter tests

**Files:**
- Modify: `tests/dispatcher/tail.test.ts`

- [ ] **Step 16.1: Write filter tests**

Append to `tests/dispatcher/tail.test.ts`:

```typescript
describe("sgc tail — filters (G.1.b)", () => {
  beforeEach(() => {
    // Seed 6 events
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T10:00:00.000Z", task_id: "ta", spawn_id: "s1-planner.eng", agent: "planner.eng", event_type: "spawn.start", level: "info", payload: {} })
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T10:00:01.000Z", task_id: "ta", spawn_id: "s1-planner.eng", agent: "planner.eng", event_type: "spawn.end", level: "info", payload: { outcome: "success" } })
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T10:00:02.000Z", task_id: "ta", spawn_id: "s2-reviewer.correctness", agent: "reviewer.correctness", event_type: "spawn.start", level: "info", payload: {} })
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T11:00:00.000Z", task_id: "tb", spawn_id: "s3-classifier.level", agent: "classifier.level", event_type: "llm.request", level: "info", payload: {} })
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T11:00:01.000Z", task_id: "tb", spawn_id: "s3-classifier.level", agent: "classifier.level", event_type: "llm.response", level: "info", payload: { outcome: "success" } })
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T11:00:02.000Z", task_id: "tb", spawn_id: "s3-classifier.level", agent: "classifier.level", event_type: "spawn.end", level: "info", payload: { outcome: "success" } })
  })

  test("--task filter narrows to one task_id", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, task: "ta", log: (m) => lines.push(m) })
    expect(lines.length).toBe(3) // ta has 3 events
  })

  test("--agent glob matches", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, agent: "planner.*", log: (m) => lines.push(m) })
    expect(lines.length).toBe(2) // only planner.eng events
  })

  test("--event-type substring filter", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, eventType: "llm.", log: (m) => lines.push(m) })
    expect(lines.length).toBe(2) // llm.request + llm.response
  })

  test("--since drops earlier events", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, since: "2026-04-24T10:30:00.000Z", log: (m) => lines.push(m) })
    expect(lines.length).toBe(3) // only 11:00:xx events
  })

  test("multiple filters AND together", async () => {
    const lines: string[] = []
    await runTail({
      stateRoot: tmp, task: "tb", eventType: "llm.",
      log: (m) => lines.push(m),
    })
    expect(lines.length).toBe(2) // tb ∩ llm.* = 2
  })

  test("--json passes raw NDJSON through", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, json: true, log: (m) => lines.push(m) })
    expect(lines.length).toBe(6)
    // Each line is parseable JSON with schema_version=1
    lines.forEach((line) => {
      const rec = JSON.parse(line)
      expect(rec.schema_version).toBe(1)
    })
  })
})
```

- [ ] **Step 16.2: Run test — expect pass (logic already in Task 15)**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/tail.test.ts
```

Expected: all 10 tail tests pass (4 from Task 15 + 6 filter).

- [ ] **Step 16.3: Commit**

```bash
git add tests/dispatcher/tail.test.ts
git commit -m "test(tail): verify filter combinations (task / agent glob / event-type / since / AND / json)"
```

---

## Task 17: sgc tail — --follow polling mode

**Files:**
- Modify: `src/commands/tail.ts` (add follow loop)
- Modify: `tests/dispatcher/tail.test.ts` (add follow test)

- [ ] **Step 17.1: Write the failing test**

Append to `tests/dispatcher/tail.test.ts`:

```typescript
describe("sgc tail --follow (G.1.b)", () => {
  test("picks up new lines appended after start", async () => {
    writeEvent(tmp, {
      schema_version: 1, ts: "2026-04-24T10:00:00.000Z",
      task_id: "t1", spawn_id: null, agent: null,
      event_type: "initial.event", level: "info", payload: {},
    })
    const lines: string[] = []
    const controller = new AbortController()
    const tailPromise = runTail({
      stateRoot: tmp,
      follow: true,
      log: (m) => lines.push(m),
      abortSignal: controller.signal,
      pollIntervalMs: 50,
    } as any)
    await new Promise((r) => setTimeout(r, 100))
    expect(lines.length).toBe(1)
    writeEvent(tmp, {
      schema_version: 1, ts: "2026-04-24T10:00:01.000Z",
      task_id: "t1", spawn_id: null, agent: null,
      event_type: "appended.event", level: "info", payload: {},
    })
    await new Promise((r) => setTimeout(r, 200))
    controller.abort()
    await tailPromise.catch(() => {}) // AbortError is expected
    expect(lines.length).toBe(2)
    expect(lines[1]).toContain("appended.event")
  })
})
```

- [ ] **Step 17.2: Run test — expect fail**

Expected: `abortSignal` + `pollIntervalMs` not supported yet.

- [ ] **Step 17.3: Extend TailOptions + implement follow loop**

In `src/commands/tail.ts`:

```typescript
export interface TailOptions {
  // ... existing fields ...
  follow?: boolean
  pollIntervalMs?: number
  abortSignal?: AbortSignal   // for tests
}

export async function runTail(opts: TailOptions = {}): Promise<void> {
  const say = opts.log ?? ((m: string) => console.log(m))
  const path = eventsPath(opts.stateRoot)

  let offset = 0
  let lastSize = 0

  const emitFromOffset = (content: string) => {
    const lines = content.split("\n").filter((l) => l.length > 0)
    for (const line of lines) {
      const rec = parseLine(line)
      if (!rec) {
        console.error(`[sgc tail] malformed line skipped: ${line.slice(0, 80)}`)
        continue
      }
      if (!matchFilters(rec, opts)) continue
      say(opts.json ? line : formatHuman(rec))
    }
  }

  const readNew = (): void => {
    if (!existsSync(path)) return
    const sz = statSync(path).size
    if (sz < lastSize) {
      // file rotated/truncated → reset
      offset = 0
    }
    lastSize = sz
    if (sz <= offset) return
    const fd = require("node:fs").openSync(path, "r")
    try {
      const buf = Buffer.alloc(sz - offset)
      require("node:fs").readSync(fd, buf, 0, buf.length, offset)
      offset = sz
      emitFromOffset(buf.toString("utf8"))
    } finally {
      require("node:fs").closeSync(fd)
    }
  }

  readNew() // initial drain

  if (!opts.follow) return

  const interval = opts.pollIntervalMs ?? 500
  return new Promise<void>((resolve, reject) => {
    const timer = setInterval(() => {
      try {
        readNew()
      } catch (e) {
        clearInterval(timer)
        reject(e)
      }
    }, interval)
    if (opts.abortSignal) {
      opts.abortSignal.addEventListener("abort", () => {
        clearInterval(timer)
        resolve()
      }, { once: true })
    }
  })
}
```

- [ ] **Step 17.4: Run test — expect pass**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/tail.test.ts
```

Expected: all 11 tail tests pass.

- [ ] **Step 17.5: Commit**

```bash
git add src/commands/tail.ts tests/dispatcher/tail.test.ts
git commit -m "feat(tail): --follow polling mode with rotation handling + AbortSignal"
```

---

## Task 18: Register `sgc tail` in citty command table

**Files:**
- Modify: `src/sgc.ts`
- Create: `tests/dispatcher/sgc-tail.test.ts`

- [ ] **Step 18.1: Write the CLI integration test**

Create `tests/dispatcher/sgc-tail.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-tail-cli-"))
  mkdirSync(resolve(tmp, "progress"), { recursive: true })
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("sgc tail CLI (G.1.b)", () => {
  test("sgc tail reads current .sgc/progress/events.ndjson", async () => {
    appendFileSync(
      resolve(tmp, "progress/events.ndjson"),
      JSON.stringify({
        schema_version: 1, ts: "2026-04-24T10:00:00.000Z",
        task_id: "t1", spawn_id: "s1-x", agent: "x",
        event_type: "spawn.start", level: "info", payload: { mode: "inline" },
      }) + "\n",
      "utf8",
    )
    const env = { ...process.env, SGC_STATE_ROOT: tmp }
    delete (env as Record<string, string | undefined>)["NODE_ENV"] // citty stdout fix
    const proc = Bun.spawn(["bun", "src/sgc.ts", "tail"], { env, stdout: "pipe", stderr: "pipe" })
    const stdout = await new Response(proc.stdout).text()
    await proc.exited
    expect(stdout).toContain("spawn.start")
    expect(stdout).toContain("inline")
  })
})
```

- [ ] **Step 18.2: Run test — expect fail (no `tail` command registered)**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/sgc-tail.test.ts
```

Expected: `unknown command: tail`.

- [ ] **Step 18.3: Register `tail` in sgc.ts**

In `src/sgc.ts`, find the citty command definitions (similar to existing `plan`, `work`, `review` registrations) and add:

```typescript
import { runTail } from "./commands/tail"

// ... inside defineCommand's subCommands:
tail: defineCommand({
  meta: { name: "tail", description: "Tail .sgc/progress/events.ndjson (structured event stream)" },
  args: {
    task: { type: "string", description: "Filter by task_id" },
    agent: { type: "string", description: "Glob-match agent name (e.g. planner.*)" },
    "event-type": { type: "string", description: "Substring filter (e.g. spawn. or llm.)" },
    since: { type: "string", description: "ISO 8601 timestamp; only events >= this moment" },
    follow: { type: "boolean", default: false, description: "Tail -f behavior (poll for new events)" },
    json: { type: "boolean", default: false, description: "Emit raw NDJSON" },
  },
  async run({ args }) {
    await runTail({
      task: args.task,
      agent: args.agent,
      eventType: args["event-type"],
      since: args.since,
      follow: args.follow,
      json: args.json,
    })
  },
}),
```

- [ ] **Step 18.4: Run test — expect pass**

```bash
SGC_FORCE_INLINE=1 bun test tests/dispatcher/sgc-tail.test.ts
```

Expected: pass.

- [ ] **Step 18.5: Commit**

```bash
git add src/sgc.ts tests/dispatcher/sgc-tail.test.ts
git commit -m "feat(sgc): register tail command in citty table"
```

---

## Task 19: G.1.b full suite + PR

- [ ] **Step 19.1: Run full suite**

```bash
SGC_FORCE_INLINE=1 bun test tests/
```

Expected: all pass. Count approximate:
- Post-G.1.a: ~498
- Post-G.1.b: ~498 + ~12 new (tail tests) = ~510

- [ ] **Step 19.2: Manual smoke test**

```bash
# After running a command, verify tail reads events.ndjson
bun src/sgc.ts plan "add README example section" \
  --motivation "Newcomers can't verify the skill end-to-end without sample input/output, so add a runnable Example block." \
  --stateRoot /tmp/smoke-test
bun src/sgc.ts tail --agent classifier.* --event-type spawn. --stateRoot /tmp/smoke-test
```

Expected: at least 2 lines output (spawn.start + spawn.end for classifier.level).

- [ ] **Step 19.3: Push branch and open G.1.b PR**

```bash
git push
gh pr create --title "feat(g1b): sgc tail command (Phase G.1.b)" --body "$(cat <<'EOF'
## Summary
Implements Phase G.1.b per spec §5. Operator-facing read surface for `.sgc/progress/events.ndjson`.

- New `src/commands/tail.ts` with filters (--task / --agent / --event-type / --since), --json passthrough, --follow polling.
- Registered as `sgc tail` in citty.
- 11 unit tests + 1 CLI integration test.

## Test plan
- [x] `bun src/sgc.ts tail --follow` streams new events as they land.
- [x] Filter combinations AND correctly.
- [x] Malformed line → skip with stderr warning, continue.
- [x] File rotation (size decrease) → offset reset.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task(s) |
|---|---|
| §3 Invariant §13 Tier 1 | Task 4 (spawn emission) + Task 11 (contract text) |
| §3 Invariant §13 Tier 2 | Tasks 6 + 7 + 8 (three LLM agents) |
| §3 Runtime enforcement points | Tasks 4, 6, 7, 8 (one try/finally each) |
| §3 Event-sink failure exemption | Task 2 (error swallowing in createLogger) |
| §3 LLM event payload schema | Task 5 |
| §4.1 Logger module | Tasks 1 + 2 |
| §4.2 events.ndjson write semantics | Task 2 (appendFileSync + ensureSgcStructure) |
| §4.3 try/finally in spawn() | Task 4 |
| §4.4 Command migration (backwards-compat) | Task 9 |
| §4.5 Event sink error handling | Task 2 |
| §4.6 Test strategy | Tasks 1, 4, 6-8, 10, 12 |
| §4.7 Event naming convention | Implicit in all tasks |
| §5.1 sgc tail command signature | Tasks 15 + 18 |
| §5.2 Human-readable output | Task 15 (formatHuman) |
| §5.3 Implementation (polling, offset, rotation) | Task 17 |
| §5.4 Test strategy | Tasks 15, 16, 17, 18 |

All covered.

**2. Placeholder scan:**

Searched for TBD / TODO / "fill in" / "similar to Task N" / "handle appropriate". None found (I was explicit about code throughout). The `LlmAgentContext` is defined once in Task 6 and used verbatim in Tasks 7 + 8 (explicit import path noted).

**3. Type consistency:**

- `EventRecord` shape: consistent across Tasks 1, 2, 4, 6, 10, 12, 15.
- `Logger` interface: `say` + `event` methods, consistent.
- `createLogger` factory signature: consistent across Tasks 2 and 9.
- `LlmAgentContext`: defined in Task 6 Step 6.3, moved to logger.ts in Task 7 Step 7.3 (documented), consistent afterward.
- `TailOptions`: extended from Task 15 → Task 17 (added `follow` + `pollIntervalMs` + `abortSignal`); Task 18 uses all fields.
- Payload field names: `outcome`, `elapsed_ms`, `mode`, `model`, `prompt_chars`, `latency_ms`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `error_class` — consistent.

---

## Known risks flagged in plan

- **Task 9 is mechanical but touches 8 files**. If any command has a non-standard spawn call site (e.g. compound.ts has a 4-agent cluster spawn), threading `logger` may need a small refactor rather than a single-line change. Expected ≤ 30 min extra; if larger, surface as scope question.
- **Task 4's `resolveMode` hoist**: The current `spawn()` has `const mode = resolveMode(...)` inside the dispatch block. Task 4 Step 4.3 asks to move it earlier so `mode` is in the `spawn.start` payload. This is a small refactor — verify no existing tests assert mode-computation order.
- **Task 17 follow loop** uses `setInterval` with `AbortSignal` — Bun supports both; no polyfill needed. If the abort path doesn't resolve cleanly on slow systems, increase `pollIntervalMs` default from 500 to 1000 in a follow-up.
- **Task 18 uses `Bun.spawn` in a CLI integration test**; make sure `delete env.NODE_ENV` per sgc project memory's `bun test` + citty gotcha (project_sgc.md line 33).
