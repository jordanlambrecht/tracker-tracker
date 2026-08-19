// src/lib/failure-log-gate.ts
//
// Decides whether a repeated client failure is worth a log line. Emission is
// keyed to state changes, not to attempts: the first failure of an outage, a
// change in the raw cause, a periodic reminder, and recovery. Steady-state
// repetition emits nothing.
//
// A permanently unreachable client would otherwise write ~840 lines/hour — the
// 5s heartbeat and the 30s deep poll both log every attempt. Downgrading the
// severity of repeats does not help: logger.ts pins the file stream (the one
// the events tab reads) to "debug", so a downgraded line still lands there.
//
// State lives on globalThis to survive HMR reloads in development. The raw
// cause exists only in memory — downloadClients.lastError stores the lossy
// sanitized message — so gate state cannot be reconstructed from the row.
//
// Fully synchronous by design: heartbeatAllClients and deepPollAllClients run
// their clients under Promise.allSettled, so any await between reading and
// writing an entry would open a read-modify-write race.
//
// Functions: noteFailure, noteSuccess, retainFailureLogClients,
//            clearFailureLogKeysForClient, clearFailureLogGate

/** How long an ongoing outage may go unmentioned in the log. */
export const OUTAGE_REMINDER_INTERVAL_MS = 15 * 60 * 1000

/** Floor between two emitted lines for the same key, for cause changes only. */
export const MIN_TRANSITION_LOG_INTERVAL_MS = 60_000

export type ClientLoopOperation = "heartbeat" | "deep-poll"

export type FailureLogVerdict =
  | { kind: "first"; since: number; failures: number; suppressed: number }
  | {
      kind: "cause-changed"
      since: number
      failures: number
      suppressed: number
      previousCause: string
    }
  | {
      kind: "reminder"
      since: number
      failures: number
      suppressed: number
      distinctCauses: string[]
    }
  | { kind: "silent" }

interface OutageState {
  clientId: number
  operation: ClientLoopOperation
  since: number
  failures: number
  suppressed: number
  lastLoggedAt: number
  lastEmittedCause: string
  pendingCauses: Set<string>
}

type Gate = Map<string, OutageState>

const g = globalThis as typeof globalThis & { __failureLogGate?: Gate }

// Lazy accessor, not an unconditional module-scope assignment: the latter would
// re-run on every webpack hot reload and wipe the gate, so the next heartbeat
// would emit a fresh ERROR for every client that is down — the exact flooding
// this module exists to prevent, reintroduced through the back door.
function getGate(): Gate {
  if (!g.__failureLogGate) {
    g.__failureLogGate = new Map()
  }
  return g.__failureLogGate
}

function gateKey(clientId: number, operation: ClientLoopOperation): string {
  return `client:${clientId}:${operation}`
}

/**
 * Record a failed attempt and decide whether it is worth a log line.
 *
 * `cause` must be the *raw* error message, not the sanitized one:
 * sanitizeNetworkError collapses distinct faults (UND_ERR_SOCKET and a header
 * timeout both become "Connection failed"), so a gate keyed on the sanitized
 * text could not see a transition at all.
 */
export function noteFailure(
  clientId: number,
  operation: ClientLoopOperation,
  cause: string
): FailureLogVerdict {
  const now = Date.now()
  const key = gateKey(clientId, operation)
  const gate = getGate()
  const existing = gate.get(key)

  if (!existing) {
    gate.set(key, {
      clientId,
      operation,
      since: now,
      failures: 1,
      suppressed: 0,
      lastLoggedAt: now,
      lastEmittedCause: cause,
      pendingCauses: new Set(),
    })
    return { kind: "first", since: now, failures: 1, suppressed: 0 }
  }

  // Read every field through a defaulted view: after an HMR reload this object
  // may have been written by the previous copy of this module, so a field this
  // version expects might be missing. Normalized values are written straight
  // back so a stale entry heals on first contact.
  const stale: Partial<OutageState> = existing
  const since = stale.since ?? now
  const failures = (stale.failures ?? 0) + 1
  const suppressed = stale.suppressed ?? 0
  const lastLoggedAt = stale.lastLoggedAt ?? now
  const lastEmittedCause = stale.lastEmittedCause ?? cause
  const pendingCauses = stale.pendingCauses ?? new Set<string>()

  existing.clientId = stale.clientId ?? clientId
  existing.operation = stale.operation ?? operation
  existing.since = since
  existing.failures = failures
  existing.suppressed = suppressed
  existing.lastLoggedAt = lastLoggedAt
  existing.lastEmittedCause = lastEmittedCause
  existing.pendingCauses = pendingCauses

  // Compared against the cause the last *emitted* line carried, not the last
  // cause observed. That is what makes a persistent new cause surface within
  // ~60s; only genuine sub-floor flapping folds into distinctCauses instead.
  if (cause !== lastEmittedCause) {
    if (now - lastLoggedAt >= MIN_TRANSITION_LOG_INTERVAL_MS) {
      existing.lastEmittedCause = cause
      existing.lastLoggedAt = now
      existing.suppressed = 0
      pendingCauses.clear()
      return { kind: "cause-changed", since, failures, suppressed, previousCause: lastEmittedCause }
    }
    pendingCauses.add(cause)
  }

  // The reminder interval is far wider than the transition floor, so this
  // branch can never be starved by a flapping cause.
  if (now - lastLoggedAt >= OUTAGE_REMINDER_INTERVAL_MS) {
    const distinctCauses = [...pendingCauses]
    existing.lastEmittedCause = cause
    existing.lastLoggedAt = now
    existing.suppressed = 0
    pendingCauses.clear()
    return { kind: "reminder", since, failures, suppressed, distinctCauses }
  }

  existing.suppressed = suppressed + 1
  return { kind: "silent" }
}

/**
 * Record a successful attempt. Returns outage stats if one was in progress —
 * the caller logs the recovery — or null if the client was already healthy.
 *
 * Deleting the entry here is the primary GC path: a healthy client holds no
 * gate state at all.
 */
export function noteSuccess(
  clientId: number,
  operation: ClientLoopOperation
): { downForMs: number; failures: number } | null {
  const gate = getGate()
  const key = gateKey(clientId, operation)
  const existing = gate.get(key)
  if (!existing) return null

  gate.delete(key)
  const stale: Partial<OutageState> = existing
  return { downForMs: Date.now() - (stale.since ?? Date.now()), failures: stale.failures ?? 0 }
}

/**
 * Drop gate state for any client no longer in the live (enabled) set.
 * Called once per heartbeat cycle, which makes deletion, disable, and
 * restore-from-backup all self-healing.
 */
export function retainFailureLogClients(liveIds: Set<number>): void {
  const gate = getGate()
  for (const [key, entry] of gate) {
    const stale: Partial<OutageState> = entry
    if (stale.clientId === undefined || !liveIds.has(stale.clientId)) {
      gate.delete(key)
    }
  }
}

/** Drop both operations' state for one client. Called when a client is deleted. */
export function clearFailureLogKeysForClient(clientId: number): void {
  const gate = getGate()
  for (const [key, entry] of gate) {
    const stale: Partial<OutageState> = entry
    if (stale.clientId === clientId) {
      gate.delete(key)
    }
  }
}

/** Reset all gate state. Called on scheduler stop. */
export function clearFailureLogGate(): void {
  g.__failureLogGate = new Map()
}
