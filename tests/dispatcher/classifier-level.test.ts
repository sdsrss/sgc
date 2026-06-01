// ALG-5 (audit fix): classifier.level heuristic had ZERO test coverage and
// over-classified — an incidental L2/L3 keyword (API, token, schema) inside a
// clearly trivial edit forced heavyweight routing. These tests characterize
// the precedence (L3 → L2 → L0 → L1) and pin the strong-L0 short-circuit that
// rescues unambiguous trivial edits. Under-classification (missing review on a
// real change) is the more dangerous direction, so the short-circuit is
// deliberately narrow (typo / spelling / whitespace / variable-rename only).

import { describe, expect, it } from "bun:test"
import { classifierLevelHeuristic } from "../../src/dispatcher/agents/classifier-level"

const lvl = (s: string) => classifierLevelHeuristic({ user_request: s }).level

describe("classifierLevelHeuristic — precedence (characterization)", () => {
  it("L3 on migration / schema / infra / architecture", () => {
    expect(lvl("add a database migration for the users table")).toBe("L3")
    expect(lvl("refactor the deployment infrastructure")).toBe("L3")
    expect(lvl("rework the module architecture")).toBe("L3")
  })
  it("L2 on API / auth / payment / refactor surface", () => {
    expect(lvl("add a new authentication endpoint")).toBe("L2")
    expect(lvl("add a payment webhook handler")).toBe("L2")
    expect(lvl("refactor the order service")).toBe("L2")
  })
  it("L0 on explicit trivial text edits", () => {
    expect(lvl("fix a typo in the README")).toBe("L0")
    expect(lvl("update the docstring wording")).toBe("L0")
  })
  it("L1 as the conservative default", () => {
    expect(lvl("add a small helper function to format dates")).toBe("L1")
  })
})

describe("classifierLevelHeuristic — ALG-5 over-classification fix", () => {
  it("a typo fix is L0 even when an L2 keyword (API) appears incidentally", () => {
    expect(lvl("fix the API docs typo")).toBe("L0")
  })
  it("a variable rename is L0 even when an L2 keyword (token) appears incidentally", () => {
    expect(lvl("rename the token variable to authToken")).toBe("L0")
  })
  it("does NOT under-classify a real structural change that merely mentions a typo-ish word", () => {
    // "add a migration" must stay L3 — the strong-L0 short-circuit must not
    // swallow real changes. No trivial-edit marker here.
    expect(lvl("add a migration to rename the orders table column")).toBe("L3")
  })
})
