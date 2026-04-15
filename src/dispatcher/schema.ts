// Spec loader + cache for sgc-capabilities.yaml and sgc-state.schema.yaml.
//
// Loads once per process via loadSpec() (which runs the YAML preprocessor).
// All dispatcher code goes through this module — never re-reads the contract
// files directly. Override the contracts directory via SGC_CONTRACTS_DIR.

import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { loadSpec } from "./preprocessor"
import type {
  CapabilitiesSpec,
  CommandPermissions,
  StateSchemaSpec,
  SubagentManifest,
} from "./types"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const defaultContractsDir = resolve(moduleDir, "..", "..", "contracts")

function contractsDir(): string {
  return process.env["SGC_CONTRACTS_DIR"] ?? defaultContractsDir
}

let _capabilities: CapabilitiesSpec | null = null
let _stateSchema: StateSchemaSpec | null = null

export function getCapabilities(): CapabilitiesSpec {
  if (_capabilities === null) {
    const text = readFileSync(resolve(contractsDir(), "sgc-capabilities.yaml"), "utf8")
    const raw = loadSpec<CapabilitiesSpec>(text)
    // Inject subagent.name (manifest keys are short-form like
    // "reviewer.correctness"; copy key into manifest for convenience).
    for (const [k, m] of Object.entries(raw.subagents ?? {})) {
      ;(m as SubagentManifest).name = k
    }
    _capabilities = raw
  }
  return _capabilities
}

export function getStateSchema(): StateSchemaSpec {
  if (_stateSchema === null) {
    const text = readFileSync(resolve(contractsDir(), "sgc-state.schema.yaml"), "utf8")
    _stateSchema = loadSpec<StateSchemaSpec>(text)
  }
  return _stateSchema
}

export function getSubagentManifest(name: string): SubagentManifest | undefined {
  return getCapabilities().subagents[name]
}

export function getCommandPermissions(command: string): CommandPermissions | undefined {
  return getCapabilities().permissions[command]
}

/**
 * Test-only: clear caches so tests can re-load with mutated SGC_CONTRACTS_DIR.
 */
export function _resetCachesForTest(): void {
  _capabilities = null
  _stateSchema = null
}
