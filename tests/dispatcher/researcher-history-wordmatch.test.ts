// P2-8 regression: corpus matching must use word tokens, not raw substrings.
//
// The query side tokenizes properly (ICU word segmentation via dedup.ts's
// tokenize), then the corpus side did `lower.includes(k)` — a raw substring
// scan. The two halves disagreed about what a word is, so short tokens matched
// inside longer, unrelated words:
//
//     "ui"   ⊂ b-ui-ld, req-ui-re, g-ui-dance
//     "auth" ⊂ auth-or, un-auth-orized
//     "cat"  ⊂ cat-egory, con-cat-enate
//
// Every false hit raises relevance_score = hits / keywordCount, which feeds the
// 0.3 recall floor and the 0.5 surfacing floor — so the damage is not just a
// noisy list: unrelated prior art gets injected into the planner's context, and
// surfaced_in/applied_in inflate on matches that never meant anything. The same
// walk backs preventions.ts and reflect.ts, so all three inherited it.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  researcherHistoryHeuristic,
  preFilterSolutions,
} from "../../src/dispatcher/agents/researcher-history"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-wordmatch-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function seedSolution(category: string, slug: string, body: string): void {
  const dir = resolve(tmp, "solutions", category)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    resolve(dir, `${slug}.md`),
    `---\nid: 01X\ncategory: ${category}\n---\n${body}\n`,
    "utf8",
  )
}

describe("corpus matching is word-based (P2-8)", () => {
  test("'ui' does not match 'build' / 'require' / 'guidance'", async () => {
    seedSolution("build", "webpack-config", "We had to build the bundle and require a guidance doc.")
    const r = await researcherHistoryHeuristic({ intent_draft: "tweak the ui" }, { stateRoot: tmp })
    expect(r.prior_art.map((p) => p.solution_ref)).not.toContain("build/webpack-config")
  })

  test("'auth' does not match 'author' / 'unauthorized'", async () => {
    seedSolution("docs", "authorship", "The author of the changelog was unauthorized to publish.")
    const r = await researcherHistoryHeuristic(
      { intent_draft: "fix auth on the endpoint" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.map((p) => p.solution_ref)).not.toContain("docs/authorship")
  })

  test("a genuine whole-word match still recalls", async () => {
    seedSolution("auth", "token-refresh", "The auth token refresh loop spun forever on expiry.")
    const r = await researcherHistoryHeuristic(
      { intent_draft: "fix auth token refresh" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.map((p) => p.solution_ref)).toContain("auth/token-refresh")
  })

  test("the pre-filter (planner's prior-art feed) is word-based too", async () => {
    seedSolution("build", "webpack-config", "We build the bundle and require guidance.")
    const cands = await preFilterSolutions("tweak the ui", tmp)
    expect(cands.map((c) => c.solution_ref)).not.toContain("build/webpack-config")
  })

  test("substring noise no longer inflates relevance_score", async () => {
    // Body contains 'category' and 'concatenate' but nothing about cats.
    seedSolution("runtime", "cat-noise", "Pick a category then concatenate the parts.")
    // 'cat' is the only content token in the query.
    const r = await researcherHistoryHeuristic({ intent_draft: "cat cat cat" }, { stateRoot: tmp })
    const hit = r.prior_art.find((p) => p.solution_ref === "runtime/cat-noise")
    // Either absent, or present with a score that isn't a fabricated 1.0.
    expect(hit?.relevance_score ?? 0).toBeLessThan(0.5)
  })

  test("inflection still recalls: intent 'table' ← corpus 'tables'", async () => {
    // The true positive the old substring scan was carrying by accident. Word-
    // exact matching alone would drop it — a different wrong answer, not a fix.
    seedSolution("runtime", "md-tables", "Fixed a bug where markdown tables failed to render.")
    const r = await researcherHistoryHeuristic(
      { intent_draft: "add markdown table rendering to the documentation page" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.map((p) => p.solution_ref)).toContain("runtime/md-tables")
  })

  test("inflection recalls in reverse: intent 'rendering' ← corpus 'render'", async () => {
    seedSolution("runtime", "render-loop", "The render loop dropped frames under load.")
    const r = await researcherHistoryHeuristic(
      { intent_draft: "fix rendering loop frames dropped" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.map((p) => p.solution_ref)).toContain("runtime/render-loop")
  })

  test("inflection allowance does not re-open the 'auth'/'author' hole", async () => {
    // "or" is not an ending we allow, so the closed list stays closed.
    seedSolution("docs", "authoring", "The author wrote authoritative docs.")
    const r = await researcherHistoryHeuristic(
      { intent_draft: "fix auth on the login endpoint" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.map((p) => p.solution_ref)).not.toContain("docs/authoring")
  })

  test("CJK recall is preserved (tokenize's script-aware floor)", async () => {
    seedSolution("runtime", "cjk-entry", "登录 接口 空指针 崩溃 修复")
    const r = await researcherHistoryHeuristic(
      { intent_draft: "登录 接口 空指针" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.map((p) => p.solution_ref)).toContain("runtime/cjk-entry")
  })
})
