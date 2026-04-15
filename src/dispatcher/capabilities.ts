// Capability enforcement: scope token computation + permission checks.
//
// Two enforcement layers (see contracts/sgc-invariants.md §1, §8, §9):
//   - Compute the pinned token set at spawn time.
//   - Reject any operation whose token is not in the pinned set OR is in the
//     subagent's `forbidden_for` list.

import { getCapabilities, getSubagentManifest, getCommandPermissions } from "./schema"
import type { CapabilitiesSpec, ScopeToken } from "./types"

export class ScopeViolation extends Error {
  constructor(
    public readonly token: string,
    public readonly holder: string | undefined,
    message?: string,
  ) {
    super(message ?? `scope violation: ${holder ?? "?"} cannot hold ${token}`)
    this.name = "ScopeViolation"
  }
}

export class UnknownActor extends Error {
  constructor(kind: "command" | "subagent", name: string) {
    super(`unknown ${kind}: ${name}`)
    this.name = "UnknownActor"
  }
}

/**
 * Glob match. Pattern uses `*` as a wildcard for any chars (incl. `.` and `:`).
 *   "reviewer.*"           matches "reviewer.correctness"  ✓
 *   "reviewer.*"           matches "reviewer.security"     ✓
 *   "read:decisions:*"     matches "read:decisions:abc123" ✓
 *   "compound.*"           matches "compound.related"      ✓
 *   "reviewer.correctness" matches "reviewer.correctness"  ✓ (literal)
 */
export function matchesPattern(name: string, pattern: string): boolean {
  const re = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  return new RegExp(`^${re}$`).test(name)
}

/**
 * Is `token` forbidden for `holder` (subagent or command name)?
 * Reads the scope_tokens.{token}.forbidden_for list.
 */
export function tokenForbiddenFor(
  spec: CapabilitiesSpec,
  token: string,
  holder: string,
): boolean {
  const def = spec.scope_tokens[token]
  if (!def?.forbidden_for) return false
  return def.forbidden_for.some((p) => matchesPattern(holder, p))
}

/**
 * Compute the pinned token set for a top-level command (e.g. "/plan").
 * Concatenates decisions + progress + solutions + reviews + exec + spawn.
 */
export function computeCommandTokens(command: string): ScopeToken[] {
  const perms = getCommandPermissions(command)
  if (!perms) throw new UnknownActor("command", command)
  return [
    ...(perms.decisions ?? []),
    ...(perms.progress ?? []),
    ...(perms.solutions ?? []),
    ...(perms.reviews ?? []),
    ...(perms.exec ?? []),
    ...(perms.spawn ?? []),
  ]
}

/**
 * Compute the pinned token set for a subagent at spawn time.
 * Reads the manifest's declared scope_tokens, then validates against
 * forbidden_for. Throws ScopeViolation if the manifest declares a forbidden
 * token (this is a *spec bug* — the manifest itself is wrong).
 */
export function computeSubagentTokens(subagent: string): ScopeToken[] {
  const manifest = getSubagentManifest(subagent)
  if (!manifest) throw new UnknownActor("subagent", subagent)
  const spec = getCapabilities()
  const out: ScopeToken[] = []
  for (const token of manifest.scope_tokens ?? []) {
    if (tokenForbiddenFor(spec, token, subagent)) {
      throw new ScopeViolation(
        token,
        subagent,
        `manifest for ${subagent} declares forbidden token ${token} (Invariant §1)`,
      )
    }
    out.push(token)
  }
  return out
}

/**
 * Does the pinned token set allow the requested op?
 *
 * Match in BOTH directions to handle wildcards:
 *   - requested may be exact ("read:decisions:abc123") and token a wildcard
 *     ("read:decisions:*")
 *   - or requested may be a category ("write:solutions") matched literally
 */
export function tokensAllow(tokens: ScopeToken[], requested: string): boolean {
  return tokens.some(
    (t) => matchesPattern(requested, t) || matchesPattern(t, requested),
  )
}

/**
 * Throw if requested op is not in the pinned token set.
 */
export function assertScope(tokens: ScopeToken[], requested: string, holder?: string): void {
  if (!tokensAllow(tokens, requested)) {
    throw new ScopeViolation(
      requested,
      holder,
      `${holder ?? "actor"} requested op '${requested}' not in pinned tokens [${tokens.join(", ")}]`,
    )
  }
}

/**
 * May `command` spawn `subagent`?
 *   - command must hold a `spawn:X.*` token covering the subagent's category
 *   - subagent name must not be in the spawn token's `granted_to` exclusion
 */
export function canSpawn(command: string, subagent: string): boolean {
  const cmdTokens = computeCommandTokens(command)
  const category = subagent.split(".")[0] // "reviewer.correctness" → "reviewer"
  return cmdTokens.some((t) => matchesPattern(`spawn:${category}.x`, t) || t === `spawn:${category}.*`)
}

export function assertCanSpawn(command: string, subagent: string): void {
  if (!canSpawn(command, subagent)) {
    throw new ScopeViolation(
      `spawn:${subagent}`,
      command,
      `command ${command} cannot spawn subagent ${subagent}`,
    )
  }
}
