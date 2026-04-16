// clarifier.discover — pre-plan discovery stub.
//
// Produces structured forcing-questions for a vague topic. MVP stub uses
// keyword detection to tune the question set; real LLM path (via claude-cli
// or anthropic-sdk mode) handles full nuance. Output is consumed by the
// user directly — `sgc discover` prints it and suggests the follow-up
// `sgc plan` command. No state writes.
//
// Pattern: gstack office-hours forcing-questions + CE discovery flow,
// re-authored. One goal question, then up to 5 each of constraints /
// scope / edge-cases / acceptance.

export interface ClarifierDiscoverInput {
  topic: string
  current_task_summary: string
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

export function clarifierDiscover(
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

  const contextNote =
    input.current_task_summary.trim().length > 0
      ? ` (there's an active task: ${input.current_task_summary.trim()})`
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
