// `sgc compound` — knowledge extraction + dedup + write to solutions/.
//
// Per Invariant §3: NO write to solutions/ without compound.related
// running first. Enforced here by dispatching context → related (with
// dedup stamp) → solution+prevention → writeSolution in that strict
// order. If any spawn throws, writeSolution is never called — natural
// rollback per Invariant §10 (no partial writes).
//
// Three outcomes:
//   - action=update_existing: dedup match ≥0.85 → merge into existing
//   - action=compound: new solution entry written
//   - action=skip: forced skip when feature-list or reviews look too thin
//     (janitor integration in D-6.3 decides this instead of user)

import { existsSync } from "node:fs"
import {
  type CompoundContextOutput,
  type CompoundPreventionOutput,
  type CompoundRelatedOutput,
  type CompoundSolutionOutput,
  compoundContext,
  compoundPrevention,
  compoundRelated,
  compoundSolution,
} from "../dispatcher/agents/compound"
import { computeSignature } from "../dispatcher/dedup"
import { spawn } from "../dispatcher/spawn"
import {
  intentPath,
  listReviewsForStage,
  listSolutions,
  readCurrentTask,
  readIntent,
  writeSolution,
} from "../dispatcher/state"
import type { DedupStamp, SolutionEntry, TaskId } from "../dispatcher/types"

export interface CompoundOptions {
  stateRoot?: string
  /** Bypass dedup; force a new write even if similarity ≥ 0.85. Invariant §3 still runs compound.related first (required stamp). */
  force?: boolean
  /** Override slug; default = slugify(problem_summary). */
  slug?: string
  log?: (msg: string) => void
}

export type CompoundAction = "compound" | "update_existing" | "skip"

export interface CompoundResult {
  taskId: TaskId
  action: CompoundAction
  solutionPath?: string
  duplicateRef?: string
  reason: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function generateUlid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

export async function runCompound(opts: CompoundOptions = {}): Promise<CompoundResult> {
  const log = opts.log ?? ((m) => console.log(m))
  const stateRoot = opts.stateRoot

  // Current task
  const ct = readCurrentTask(stateRoot)
  if (!ct) throw new Error("no active task — run `sgc plan <task>` first")
  const taskId = ct.task.task_id
  const level = ct.task.level

  // Gather context
  let intentText = ""
  if (level !== "L0" && existsSync(intentPath(taskId, stateRoot))) {
    const intent = readIntent(taskId, stateRoot)
    intentText = `${intent.title}\n\n${intent.motivation}`
  } else {
    intentText = `${ct.task.task_id} (L0 task; no intent.md)`
  }
  const reviews = listReviewsForStage(taskId, "code", stateRoot)

  // 1. compound.context — determines category + tags + problem_summary
  const ctxRes = await spawn<unknown, CompoundContextOutput>(
    "compound.context",
    { task_id: taskId, intent: intentText },
    {
      stateRoot,
      inlineStub: (i) =>
        compoundContext(i as { task_id: string; intent: string; diff?: string }),
    },
  )
  const context = ctxRes.output

  // 2. signature + compound.related (dedup — MUST run before any write, §3)
  const signature = computeSignature(context.problem_summary)
  const existing = listSolutions(stateRoot)
  const relRes = await spawn<unknown, CompoundRelatedOutput>(
    "compound.related",
    { context, signature, existing_solutions: existing },
    {
      stateRoot,
      inlineStub: (i) =>
        compoundRelated(
          i as {
            context: CompoundContextOutput
            signature: string
            existing_solutions: typeof existing
          },
        ),
    },
  )
  const related = relRes.output

  // 3. Dedup branch: match ≥0.85 and not forced → update-existing
  if (related.duplicate_match && !opts.force) {
    const [catRaw, slugRaw] = related.duplicate_match.ref.split("/")
    const existingFile = existing.find(
      (s) => s.category === catRaw && s.slug === slugRaw,
    )
    if (!existingFile) {
      throw new Error(
        `compound.related returned ref ${related.duplicate_match.ref} but entry not on disk`,
      )
    }
    // Invariant §3 stamp: update_existing authorized because related found a match
    const stamp: DedupStamp = {
      compound_related_spawn_id: relRes.spawnId,
      threshold_met_or_forced: true,
      reason: "update_existing_dedup",
    }
    const updated = writeSolution(
      {
        ...existingFile.entry,
        source_task_ids: [...existingFile.entry.source_task_ids, taskId],
        last_updated: nowIso(),
      },
      existingFile.slug,
      stamp,
      "",
      stateRoot,
    )
    log(
      `compound: action=update_existing ref=${related.duplicate_match.ref} similarity=${related.duplicate_match.similarity.toFixed(3)}`,
    )
    return {
      taskId,
      action: "update_existing",
      solutionPath: updated.path,
      duplicateRef: related.duplicate_match.ref,
      reason: `similarity ${related.duplicate_match.similarity.toFixed(3)} ≥ ${related.dedup_stamp.threshold}`,
    }
  }

  // 4. compound.solution + compound.prevention (parallel)
  const [solRes, prevRes] = await Promise.all([
    spawn<unknown, CompoundSolutionOutput>(
      "compound.solution",
      { context, reviews },
      {
        stateRoot,
        inlineStub: (i) =>
          compoundSolution(
            i as {
              context: CompoundContextOutput
              reviews: typeof reviews
            },
          ),
      },
    ),
    spawn<unknown, CompoundPreventionOutput>(
      "compound.prevention",
      { context, solution: {} },
      {
        stateRoot,
        inlineStub: () =>
          compoundPrevention({
            context,
            solution: { solution: "", what_didnt_work: [] },
          }),
      },
    ),
  ])

  // 5. Synthesize + writeSolution (natural transaction boundary: anything
  //    above this line that throws means no write ever happened — Invariant §10)
  const now = nowIso()
  const entry: SolutionEntry = {
    id: generateUlid(),
    signature,
    category: context.category,
    problem: context.problem_summary,
    symptoms: context.symptoms.length > 0 ? context.symptoms : ["(no symptoms captured)"],
    what_didnt_work: solRes.output.what_didnt_work,
    solution: solRes.output.solution,
    prevention: prevRes.output.prevention,
    tags: context.tags.length > 0 ? context.tags : ["untagged"],
    first_seen: now,
    last_updated: now,
    times_referenced: 0,
    source_task_ids: [taskId],
    related_entries:
      related.related_entries.length > 0 ? related.related_entries : undefined,
    confidence: "provisional",
  }

  const slug =
    opts.slug ??
    (slugify(context.problem_summary) || `task-${taskId.slice(0, 8).toLowerCase()}`)

  // Invariant §3 stamp: new entry, no duplicate at threshold (or forced)
  const stamp: DedupStamp = {
    compound_related_spawn_id: relRes.spawnId,
    threshold_met_or_forced: true,
    reason: opts.force && related.duplicate_match ? "user_forced" : "new_entry",
  }
  const written = writeSolution(entry, slug, stamp, "", stateRoot)

  log(
    `compound: action=compound category=${context.category} slug=${slug} related=${related.related_entries.length}`,
  )
  return {
    taskId,
    action: "compound",
    solutionPath: written.path,
    reason:
      opts.force && related.duplicate_match
        ? `forced write despite similarity ${related.duplicate_match.similarity.toFixed(3)}`
        : "new solution entry created",
  }
}
