// src/dispatcher/embedded-data.ts
//
// Inlines contracts/ + prompts/ as text so the shipped node bundle is fully
// self-contained (no on-disk data files needed). Under bun (dev + bun build)
// the `with { type: "text" }` import attribute embeds the file text; bun build
// bakes it into plugins/sgc/bin/sgc.mjs. node only ever runs the bundled
// output, where the text is already inlined.
//
// Access ladder for every reader: SGC_*_DIR env override -> embedded -> disk
// fallback (dev source checkout without env). Env override keeps customization
// possible; disk fallback keeps a raw `bun src/sgc.ts` honest if a text import
// ever regresses.
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import capabilities from "../../contracts/sgc-capabilities.yaml" with { type: "text" }
import stateSchema from "../../contracts/sgc-state.schema.yaml" with { type: "text" }
import invariantEnforcement from "../../contracts/invariant-enforcement.yaml" with { type: "text" }
import invariantsMd from "../../contracts/sgc-invariants.md" with { type: "text" }

import clarifierDiscover from "../../prompts/clarifier-discover.md" with { type: "text" }
import classifierLevel from "../../prompts/classifier-level.md" with { type: "text" }
import compoundContext from "../../prompts/compound-context.md" with { type: "text" }
import compoundPrevention from "../../prompts/compound-prevention.md" with { type: "text" }
import compoundSolution from "../../prompts/compound-solution.md" with { type: "text" }
import plannerAdversarial from "../../prompts/planner-adversarial.md" with { type: "text" }
import plannerDecompose from "../../prompts/planner-decompose.md" with { type: "text" }
import plannerCeo from "../../prompts/planner-ceo.md" with { type: "text" }
import plannerEng from "../../prompts/planner-eng.md" with { type: "text" }
import researcherHistory from "../../prompts/researcher-history.md" with { type: "text" }
import reviewerCorrectness from "../../prompts/reviewer-correctness.md" with { type: "text" }
import reviewerSecurity from "../../prompts/reviewer-security.md" with { type: "text" }
import reviewerTests from "../../prompts/reviewer-tests.md" with { type: "text" }

export const EMBEDDED_CONTRACTS: Record<string, string> = {
  "sgc-capabilities.yaml": capabilities,
  "sgc-state.schema.yaml": stateSchema,
  "invariant-enforcement.yaml": invariantEnforcement,
  "sgc-invariants.md": invariantsMd,
}

export const EMBEDDED_PROMPTS: Record<string, string> = {
  "prompts/clarifier-discover.md": clarifierDiscover,
  "prompts/classifier-level.md": classifierLevel,
  "prompts/compound-context.md": compoundContext,
  "prompts/compound-prevention.md": compoundPrevention,
  "prompts/compound-solution.md": compoundSolution,
  "prompts/planner-adversarial.md": plannerAdversarial,
  "prompts/planner-decompose.md": plannerDecompose,
  "prompts/planner-ceo.md": plannerCeo,
  "prompts/planner-eng.md": plannerEng,
  "prompts/researcher-history.md": researcherHistory,
  "prompts/reviewer-correctness.md": reviewerCorrectness,
  // M5: a manifest prompt_path with no embedded entry is a shipped crash —
  // spawn.ts:575 throws "prompt_path declared but file does not exist" for every
  // packaged user holding an API key, while the repo checkout works fine.
  "prompts/reviewer-security.md": reviewerSecurity,
  "prompts/reviewer-tests.md": reviewerTests,
}

const moduleDir = dirname(fileURLToPath(import.meta.url))
const diskContractsDir = resolve(moduleDir, "..", "..", "contracts")
const diskRepoRoot = resolve(moduleDir, "..", "..")

export function listEmbeddedPromptKeys(): string[] {
  return Object.keys(EMBEDDED_PROMPTS)
}

export function readContract(filename: string): string {
  const override = process.env["SGC_CONTRACTS_DIR"]
  if (override) return readDisk(resolve(override, filename), filename, "SGC_CONTRACTS_DIR")
  const embedded = EMBEDDED_CONTRACTS[filename]
  if (embedded !== undefined) return embedded
  return readDisk(resolve(diskContractsDir, filename), filename, "SGC_CONTRACTS_DIR")
}

export function readPrompt(relPath: string): string {
  const override = process.env["SGC_PROMPTS_DIR"]
  if (override) {
    const base = relPath.replace(/^prompts\//, "")
    return readDisk(resolve(override, base), relPath, "SGC_PROMPTS_DIR")
  }
  const embedded = EMBEDDED_PROMPTS[relPath]
  if (embedded !== undefined) return embedded
  return readDisk(resolve(diskRepoRoot, relPath), relPath, "SGC_PROMPTS_DIR")
}

function readDisk(path: string, label: string, envVar: string): string {
  try {
    return readFileSync(path, "utf8")
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === "ENOENT") {
      throw new Error(`sgc data not found: ${label} at ${path} — set ${envVar} if it lives elsewhere.`)
    }
    throw new Error(`sgc data unreadable: ${label} at ${path}: ${e.message}`)
  }
}
