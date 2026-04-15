// `sgc plan` command implementation.
//
// Flow:
//   1. Generate task_id (ULID)
//   2. Spawn classifier.level → get level + rationale
//   3. Display classification; allow upgrade-only (per /plan SKILL.md rule)
//   4. If level >= L1: spawn planner.eng → get verdict
//   5. Write decisions/{task_id}/intent.md (immutable, schema-validated)
//   6. Write progress/feature-list.md + current-task.md
//   7. Print "next: sgc work"
//
// MVP: classifier and planner.eng are inline stubs; demo runs without
// external Claude. Set SGC_USE_FILE_AGENTS=1 to use file-poll protocol
// (for real Claude main-session integration, future work).

import { existsSync, readFileSync } from "node:fs"
import { spawn } from "../dispatcher/spawn"
import {
  classifierLevel,
  type ClassifierOutput,
} from "../dispatcher/agents/classifier-level"
import { plannerEng, type PlannerEngOutput } from "../dispatcher/agents/planner-eng"
import { plannerCeo, type PlannerCeoOutput } from "../dispatcher/agents/planner-ceo"
import {
  researcherHistory,
  type ResearcherHistoryOutput,
} from "../dispatcher/agents/researcher-history"
import { validateClassifierRationale } from "../dispatcher/rationale"
import {
  ensureSgcStructure,
  writeCurrentTask,
  writeFeatureList,
  writeIntent,
} from "../dispatcher/state"
import { computeCommandTokens } from "../dispatcher/capabilities"
import type { IntentDoc, Level } from "../dispatcher/types"

export interface PlanOptions {
  stateRoot?: string
  // If set, accept this level instead of asking the user (for tests + demo).
  forceLevel?: Level
  // Required when level is L3 (Invariant §4). { signer_id } from CLI flag.
  userSignature?: { signed_at: string; signer_id: string }
  // Explicit motivation; defaults to taskDescription. Must be ≥20 words for
  // L1+ tasks (audit C-phase C3, sgc-state.schema.yaml:52 min_words rule).
  motivation?: string
  // Logger sink; defaults to console.log
  log?: (msg: string) => void
}

const LEVEL_RANK: Record<Level, number> = { L0: 0, L1: 1, L2: 2, L3: 3 }

function generateTaskId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()
}

function nowIso(): string {
  return new Date().toISOString()
}

async function readLineSync(): Promise<string> {
  const stdin = process.stdin
  return new Promise((resolve) => {
    stdin.resume()
    stdin.setEncoding("utf8")
    let buf = ""
    const onData = (chunk: string) => {
      buf += chunk
      const nl = buf.indexOf("\n")
      if (nl !== -1) {
        stdin.removeListener("data", onData)
        stdin.pause()
        resolve(buf.slice(0, nl).trim())
      }
    }
    stdin.on("data", onData)
  })
}

export async function runPlan(taskDescription: string, opts: PlanOptions = {}): Promise<{
  taskId: string
  level: Level
  intentPath: string
}> {
  const log = opts.log ?? ((m) => console.log(m))
  const stateRoot = opts.stateRoot

  ensureSgcStructure(stateRoot)
  const taskId = generateTaskId()
  const createdAt = nowIso()

  log(`task_id = ${taskId}`)

  // Step 1: classify
  const classRes = await spawn<unknown, ClassifierOutput>(
    "classifier.level",
    { user_request: taskDescription },
    { stateRoot, inlineStub: (i) => classifierLevel(i as { user_request: string }) },
  )
  // Invariant §11: rationale must be concrete (D-1.2).
  validateClassifierRationale(classRes.output.rationale)
  let level = classRes.output.level
  log(`classifier verdict: ${level} — ${classRes.output.rationale}`)

  // Step 2: level confirmation (upgrade-only per skill rule)
  if (opts.forceLevel) {
    if (LEVEL_RANK[opts.forceLevel] < LEVEL_RANK[level]) {
      throw new Error(
        `forceLevel ${opts.forceLevel} would downgrade ${level} — refused (upgrade-only rule)`,
      )
    }
    level = opts.forceLevel
    log(`level overridden to ${level} (upgrade)`)
  }

  // Step 3: planner cluster — L1 gets eng only; L2+ adds ceo + researcher in parallel.
  let plannerEngOut: PlannerEngOutput | null = null
  let plannerCeoOut: PlannerCeoOutput | null = null
  let researcherOut: ResearcherHistoryOutput | null = null
  if (LEVEL_RANK[level] >= 2) {
    // 3-way parallel dispatch for L2/L3 (Invariant §8 scope tokens pinned per spawn)
    const [engRes, ceoRes, histRes] = await Promise.all([
      spawn<unknown, PlannerEngOutput>(
        "planner.eng",
        { intent_draft: taskDescription },
        { stateRoot, inlineStub: (i) => plannerEng(i as { intent_draft: string }) },
      ),
      spawn<unknown, PlannerCeoOutput>(
        "planner.ceo",
        { intent_draft: taskDescription },
        { stateRoot, inlineStub: (i) => plannerCeo(i as { intent_draft: string }) },
      ),
      spawn<unknown, ResearcherHistoryOutput>(
        "researcher.history",
        { intent_draft: taskDescription },
        {
          stateRoot,
          inlineStub: (i) =>
            researcherHistory(i as { intent_draft: string }, { stateRoot }),
        },
      ),
    ])
    plannerEngOut = engRes.output
    plannerCeoOut = ceoRes.output
    researcherOut = histRes.output
    log(`planner.eng verdict: ${plannerEngOut.verdict}`)
    if (plannerEngOut.concerns.length > 0) {
      for (const c of plannerEngOut.concerns) log(`  eng concern: ${c}`)
    }
    log(`planner.ceo verdict: ${plannerCeoOut.verdict}`)
    if (plannerCeoOut.concerns.length > 0) {
      for (const c of plannerCeoOut.concerns) log(`  ceo concern: ${c}`)
    }
    if (plannerCeoOut.rewrite_hints.length > 0) {
      for (const h of plannerCeoOut.rewrite_hints) log(`  ceo hint: ${h}`)
    }
    log(
      `researcher.history: ${researcherOut.prior_art.length} prior art entries${
        researcherOut.warnings.length ? `, ${researcherOut.warnings.length} warning(s)` : ""
      }`,
    )
    for (const w of researcherOut.warnings) log(`  research warning: ${w}`)
  } else if (LEVEL_RANK[level] >= 1) {
    // L1: eng only
    const planRes = await spawn<unknown, PlannerEngOutput>(
      "planner.eng",
      { intent_draft: taskDescription },
      { stateRoot, inlineStub: (i) => plannerEng(i as { intent_draft: string }) },
    )
    plannerEngOut = planRes.output
    log(`planner.eng verdict: ${plannerEngOut.verdict}`)
    if (plannerEngOut.concerns.length > 0) {
      for (const c of plannerEngOut.concerns) log(`  concern: ${c}`)
    }
  }

  // L3 requires human signature per Invariant §4 + skill rule
  if (level === "L3" && !opts.userSignature) {
    throw new Error(
      `L3 plan requires human signature. Re-run with --signed-by <signer_id> ` +
        `to acknowledge architecture-level scope.`,
    )
  }

  // L0 skips intent.md per sgc-state.schema.yaml:31 — "L0 tasks do NOT write
  // to decisions/ — they skip it entirely". Audit C3 adjacent fix.
  let intentPath = "(skipped — L0)"
  if (level !== "L0") {
    const motivation = opts.motivation ?? taskDescription
    const motivationWords = motivation.trim().split(/\s+/).filter(Boolean).length
    if (motivationWords < 20) {
      throw new Error(
        `motivation must be ≥20 words (sgc-state.schema.yaml min_words rule); ` +
          `got ${motivationWords} from task description. Re-run with ` +
          `--motivation "<longer rationale describing why this matters and what changes>".`,
      )
    }
    const intent: IntentDoc = {
      task_id: taskId,
      level,
      created_at: createdAt,
      title: taskDescription.slice(0, 120),
      motivation,
      affected_readers: classRes.output.affected_readers_candidates,
      scope_tokens: computeCommandTokens("/plan"),
      user_signature: opts.userSignature,
      body:
        `## Classifier rationale\n\n${classRes.output.rationale}\n\n` +
        (plannerEngOut
          ? `## Planner.eng verdict\n\n${plannerEngOut.verdict}\n\n` +
            (plannerEngOut.concerns.length
              ? `### Eng concerns\n\n${plannerEngOut.concerns.map((c) => `- ${c}`).join("\n")}\n\n`
              : "")
          : "") +
        (plannerCeoOut
          ? `## Planner.ceo verdict\n\n${plannerCeoOut.verdict}\n\n` +
            (plannerCeoOut.concerns.length
              ? `### CEO concerns\n\n${plannerCeoOut.concerns.map((c) => `- ${c}`).join("\n")}\n\n`
              : "") +
            (plannerCeoOut.rewrite_hints.length
              ? `### CEO rewrite hints\n\n${plannerCeoOut.rewrite_hints.map((h) => `- ${h}`).join("\n")}\n\n`
              : "")
          : "") +
        (researcherOut
          ? `## Prior art (researcher.history)\n\n` +
            (researcherOut.prior_art.length === 0
              ? `_No prior art found._\n\n`
              : researcherOut.prior_art
                  .map(
                    (p) =>
                      `- **${p.solution_ref ?? p.source}** (score ${p.relevance_score.toFixed(2)}): ${p.excerpt}`,
                  )
                  .join("\n") + "\n\n") +
            (researcherOut.warnings.length
              ? `### Research warnings\n\n${researcherOut.warnings.map((w) => `- ${w}`).join("\n")}\n`
              : "")
          : ""),
    }
    intentPath = writeIntent(intent, stateRoot)
    log(`wrote ${intentPath}`)
  } else {
    log(`L0 task: skipping intent.md per schema (decisions/ not written for L0)`)
  }

  // Step 5: write feature-list (single placeholder for L0/L1 MVP)
  writeFeatureList(
    {
      features: [
        {
          id: "f1",
          title: taskDescription.slice(0, 200),
          status: "pending",
        },
      ],
    },
    "Refine this list during `sgc work`. The dispatcher does not infer fine-grained features in MVP.\n",
    stateRoot,
  )

  // Step 6: write current-task
  writeCurrentTask(
    {
      task_id: taskId,
      level,
      active_feature: "f1",
      session_start: createdAt,
      last_activity: createdAt,
    },
    "",
    stateRoot,
  )

  log(``)
  log(`Plan complete. Run \`sgc work\` to begin execution.`)

  return { taskId, level, intentPath }
}

// Reserved for future interactive flow (currently unused in non-TTY tests):
export { readLineSync as _readLineSyncForFutureInteractiveFlow }

// Force suppression of unused-import warning for stdin when no interactive flow yet
void existsSync
void readFileSync
