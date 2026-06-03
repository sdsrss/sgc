// Pure renderer: feature-list (single source of truth) → sp:writing-plans-style
// markdown. Phase 2b "double-write, no drift" — the markdown is always derived
// from feature-list.md, never hand-maintained.

import type { FeatureList } from "./types"

export function renderPlanMarkdown(
  list: FeatureList,
  intent: { title: string; level: string },
): string {
  const out: string[] = []
  out.push(`# ${intent.title} Implementation Plan`)
  out.push("")
  out.push(
    "> **For agentic workers:** REQUIRED SUB-SKILL: Use " +
      "superpowers:subagent-driven-development (recommended) or " +
      "superpowers:executing-plans to implement this plan task-by-task. " +
      "Steps use checkbox (`- [ ]`) syntax for tracking.",
  )
  out.push("")
  out.push(`**Level:** ${intent.level}`)
  out.push("")
  out.push("---")
  out.push("")

  let taskNo = 1
  for (const f of list.features) {
    out.push(`### Task ${taskNo}: ${f.title}`)
    out.push("")
    if (f.files) {
      out.push("**Files:**")
      for (const p of f.files.create) out.push(`- Create: \`${p}\``)
      for (const p of f.files.modify) out.push(`- Modify: \`${p}\``)
      for (const p of f.files.test) out.push(`- Test: \`${p}\``)
      out.push("")
    }
    if (f.prior_art_refs && f.prior_art_refs.length > 0) {
      out.push(`**Prior art (reused):** ${f.prior_art_refs.map((r) => `\`${r}\``).join(", ")}`)
      out.push("")
    }
    let stepNo = 1
    for (const s of f.steps ?? []) {
      out.push(`- [ ] **Step ${stepNo} (${s.kind}):** ${s.text}`)
      if (s.run) out.push(`  - Run: \`${s.run}\``)
      if (s.expect) out.push(`  - Expected: ${s.expect}`)
      stepNo++
    }
    out.push("")
    taskNo++
  }
  return out.join("\n")
}
