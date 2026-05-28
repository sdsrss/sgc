// clarifier.discover — pre-plan discovery.
//
// LLM mode (P2#7c, mirrors G.2.a planner.eng): when ANTHROPIC_API_KEY or
// OPENROUTER_API_KEY is set, spawn.ts:resolveMode routes through
// `prompts/clarifier-discover.md`. Output shape (topic + goal_question +
// 4 question-category arrays + suggested_next) is scalar + array[string]
// throughout — validateOutputShape catches missing fields and wrong
// inner types without a per-agent DSL coerce.
//
// Heuristic fallback (`clarifierDiscoverHeuristic`): keyword detection
// tunes the question set per domain hint (auth/data/perf/api/ui). Used
// when no key is set and via SGC_FORCE_INLINE=1 in tests.
//
// Output is consumed by the user directly — `sgc discover` prints it and
// suggests the follow-up `sgc plan` command. No state writes.
//
// Pattern: gstack office-hours forcing-questions + CE discovery flow,
// re-authored. One goal question, then up to 5 each of constraints /
// scope / edge-cases / acceptance.

// GS-6 (v1.16.0): closed enum of question-framing templates. Layered on top
// of the existing domain-hint pattern — when present, a template adds
// framing-specific questions (product = office-hours wedge, scope =
// cut-line forcing, anti-pattern = pre-mortem failure-mode). Templates
// change question CONTENT, not the output schema. Source-of-truth lives
// here; --template flag in commands/discover.ts validates against it.
export const DISCOVER_TEMPLATES = ["product", "scope", "anti-pattern"] as const
export type DiscoverTemplate = (typeof DISCOVER_TEMPLATES)[number]

export interface ClarifierDiscoverInput {
  topic: string
  current_task_summary: string
  /** GS-6: optional framing template. When undefined, default heuristic. */
  template?: DiscoverTemplate
}

export interface ClarifierDiscoverOutput {
  topic: string
  goal_question: string
  constraint_questions: string[]
  scope_questions: string[]
  edge_case_questions: string[]
  acceptance_questions: string[]
  suggested_next: string
}

// Domain hints — narrow the question set when the topic mentions these
// categories. Pure keyword match for MVP; a real LLM picks up on much more.
const AUTH_RE = /\b(auth|login|token|session|jwt|oauth|permission|role)\b/i
const DATA_RE = /\b(migration|schema|column|table|sql|database|backfill|index)\b/i
const UI_RE = /\b(ui|page|component|form|modal|dropdown|button|layout|render)\b/i
const PERF_RE = /\b(slow|fast|latency|throughput|cache|p95|p99|benchmark|optimi[sz]e)\b/i
const API_RE = /\b(api|endpoint|route|request|response|webhook|rpc)\b/i

export function clarifierDiscoverHeuristic(
  input: ClarifierDiscoverInput,
): ClarifierDiscoverOutput {
  const topic = (input.topic ?? "").trim()
  if (topic.length === 0) {
    throw new Error("clarifier.discover: topic is required")
  }

  const goal = `When "${topic}" is done, what can the user do that they can't do today?`

  const constraints: string[] = [
    "Are there performance requirements (latency, throughput, data volume)?",
    "What platforms / browsers / runtimes must this support?",
    "Is there a deadline or release window this is blocking?",
  ]
  if (AUTH_RE.test(topic)) {
    constraints.push(
      "What's the threat model — who is trusted, who isn't, and what's the blast radius of a bypass?",
    )
  }
  if (DATA_RE.test(topic)) {
    constraints.push(
      "What's the rollback plan if the schema change is wrong after deploy (additive-safe vs. backfill-required)?",
    )
  }
  if (PERF_RE.test(topic)) {
    constraints.push(
      "What's the current baseline number and the target, with a measurement method?",
    )
  }

  const scope: string[] = [
    "What is explicitly OUT of scope — the closest adjacent feature we are NOT building?",
    "Does this replace existing behavior, or add alongside it?",
  ]
  if (API_RE.test(topic)) {
    scope.push(
      "Is this a breaking change to any consumer, or purely additive (new endpoint / optional field / new status)?",
    )
  }
  if (UI_RE.test(topic)) {
    scope.push(
      "Does this touch an existing screen, or introduce a new route / entry point?",
    )
  }

  const edges: string[] = [
    "What happens if the input is empty, malformed, or enormous?",
    "What happens under concurrent access — two users / tabs / requests at once?",
    "What's the failure mode if a dependency (network, DB, third-party) is down?",
  ]
  if (AUTH_RE.test(topic)) {
    edges.push(
      "What happens if a token is expired / revoked / forged mid-request?",
    )
  }

  const acceptance: string[] = [
    "What test or observation proves this works — a specific command, URL, or log line?",
    "What's the smallest user-visible change that would tell us it's done?",
  ]
  if (UI_RE.test(topic) || API_RE.test(topic)) {
    acceptance.push(
      "Is there a screenshot, curl invocation, or integration test that would serve as evidence?",
    )
  }

  // GS-6: template-aware framing layered on top of domain hints.
  // Each template adds ≥3 questions across relevant buckets; wording
  // markers ("hurts today" / "narrowest wedge" / "smallest version" /
  // "cut-line" / "silent failure" / "rollback") serve as test anchors
  // proving the template fired (clarifier-discover.test.ts).
  if (input.template === "product") {
    scope.push(
      "Who hurts today without this — and what do they do instead?",
      "What's the narrowest wedge — the single first user who would adopt this and refuse to give it up?",
    )
    acceptance.push(
      "Are early users willing to pay (in money, time, or attention) — and what's the lightest signal that proves it?",
    )
  } else if (input.template === "scope") {
    scope.push(
      "What's the smallest version that delivers any user-visible value — and what gets cut to reach it?",
      "Where is the cut-line — what changes from in-scope to out-of-scope if 30% of the budget were removed?",
    )
    constraints.push(
      "If the deadline halved, which features drop first (and which stay)?",
    )
  } else if (input.template === "anti-pattern") {
    edges.push(
      "How will this regress under load you haven't tested — and what's the silent-failure mode that bypasses your test?",
      "If this regresses silently in production, how would you find out — and what's the failure-mode oracle?",
    )
    constraints.push(
      "What's the rollback path if the first version is fundamentally wrong — code revert, data revert, or user-comms?",
    )
  }

  // DOG-4 (v1.16.1): no apostrophes in suggested_next — LLM mode emits
  // this as a single-quoted YAML scalar and unescaped ' terminates it
  // mid-string, crashing OpenRouter response parser (openrouter-agent.ts:182).
  // "(active task: ...)" carries the same meaning without the YAML hazard.
  const contextNote =
    input.current_task_summary.trim().length > 0
      ? ` (active task: ${input.current_task_summary.trim()})`
      : ""

  return {
    topic,
    goal_question: goal,
    constraint_questions: constraints,
    scope_questions: scope,
    edge_case_questions: edges,
    acceptance_questions: acceptance,
    suggested_next: `sgc plan "${topic}" --motivation "<your consolidated answers as one paragraph, ≥20 words>"${contextNote}`,
  }
}

// Backwards-compat alias for callers that pre-date the LLM swap (G.2.a /
// Phase F pattern). discover.ts inlineStub still imports `clarifierDiscover`;
// tests using the legacy name continue to work.
export const clarifierDiscover = clarifierDiscoverHeuristic
