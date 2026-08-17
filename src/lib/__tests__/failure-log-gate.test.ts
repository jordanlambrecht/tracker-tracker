// src/lib/__tests__/failure-log-gate.test.ts
//
// Functions: advance - moves the fake clock forward by ms

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearFailureLogGate,
  clearFailureLogKeysForClient,
  MIN_TRANSITION_LOG_INTERVAL_MS,
  noteFailure,
  noteSuccess,
  OUTAGE_REMINDER_INTERVAL_MS,
  retainFailureLogClients,
} from "@/lib/failure-log-gate"

// Two raw causes that sanitizeNetworkError would flatten to the same
// "Connection failed" string — the gate keys on the raw text precisely so it
// can still tell them apart.
const CAUSE_A = "Failed to connect to 192.168.1.42: UND_ERR_SOCKET"
const CAUSE_B = "Failed to connect to 192.168.1.42: UND_ERR_HEADERS_TIMEOUT"

/** The heartbeat cron cadence — how often a down client produces a failure. */
const HEARTBEAT_INTERVAL_MS = 5_000
/** Attempts a down client makes inside one reminder interval: 180. */
const ATTEMPTS_PER_REMINDER = OUTAGE_REMINDER_INTERVAL_MS / HEARTBEAT_INTERVAL_MS

function advance(ms: number): void {
  vi.advanceTimersByTime(ms)
}

describe("failure-log-gate", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearFailureLogGate()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // Onset and steady state
  // -------------------------------------------------------------------------

  it("reports the first failure of an outage as loggable", () => {
    const verdict = noteFailure(1, "heartbeat", CAUSE_A)

    expect(verdict).toEqual({
      kind: "first",
      since: Date.now(),
      failures: 1,
      suppressed: 0,
    })
  })

  it("suppresses every identical repeat inside the reminder interval", () => {
    noteFailure(1, "heartbeat", CAUSE_A)

    // 179 further 5s attempts all land inside the 15-minute window
    for (let i = 1; i < ATTEMPTS_PER_REMINDER; i++) {
      advance(HEARTBEAT_INTERVAL_MS)
      expect(noteFailure(1, "heartbeat", CAUSE_A)).toEqual({ kind: "silent" })
    }
  })

  it("emits a reminder after the outage interval with the suppressed count, then resets its clock", () => {
    noteFailure(1, "heartbeat", CAUSE_A)
    for (let i = 1; i < ATTEMPTS_PER_REMINDER; i++) {
      advance(HEARTBEAT_INTERVAL_MS)
      noteFailure(1, "heartbeat", CAUSE_A)
    }

    advance(HEARTBEAT_INTERVAL_MS)
    const reminder = noteFailure(1, "heartbeat", CAUSE_A)

    expect(reminder).toEqual({
      kind: "reminder",
      since: Date.now() - OUTAGE_REMINDER_INTERVAL_MS,
      failures: ATTEMPTS_PER_REMINDER + 1,
      suppressed: ATTEMPTS_PER_REMINDER - 1,
      distinctCauses: [],
    })

    // The reminder restarts the window rather than repeating every tick
    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(1, "heartbeat", CAUSE_A)).toEqual({ kind: "silent" })

    advance(OUTAGE_REMINDER_INTERVAL_MS - HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(1, "heartbeat", CAUSE_A)).toMatchObject({ kind: "reminder" })
  })

  // -------------------------------------------------------------------------
  // Cause transitions
  // -------------------------------------------------------------------------

  it("reports a changed cause past the transition floor, carrying the previous cause", () => {
    noteFailure(1, "heartbeat", CAUSE_A)
    advance(MIN_TRANSITION_LOG_INTERVAL_MS)

    const verdict = noteFailure(1, "heartbeat", CAUSE_B)

    expect(verdict).toEqual({
      kind: "cause-changed",
      since: Date.now() - MIN_TRANSITION_LOG_INTERVAL_MS,
      failures: 2,
      suppressed: 0,
      previousCause: CAUSE_A,
    })
  })

  it("folds a cause that flaps inside the transition floor into the next reminder", () => {
    noteFailure(1, "heartbeat", CAUSE_A)

    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(1, "heartbeat", CAUSE_B)).toEqual({ kind: "silent" })

    advance(OUTAGE_REMINDER_INTERVAL_MS - HEARTBEAT_INTERVAL_MS)
    const reminder = noteFailure(1, "heartbeat", CAUSE_A)

    expect(reminder).toMatchObject({
      kind: "reminder",
      failures: 3,
      suppressed: 1,
      distinctCauses: [CAUSE_B],
    })
  })

  it("surfaces a changed cause that persists within the floor, not at the reminder", () => {
    const outageStart = Date.now()
    noteFailure(1, "heartbeat", CAUSE_A)

    // First sighting is inside the floor, so it is held back...
    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(1, "heartbeat", CAUSE_B)).toEqual({ kind: "silent" })

    // ...but the moment the floor clears, a cause that is still B is reported.
    advance(MIN_TRANSITION_LOG_INTERVAL_MS)
    const verdict = noteFailure(1, "heartbeat", CAUSE_B)

    expect(verdict).toMatchObject({ kind: "cause-changed", previousCause: CAUSE_A })
    // Nowhere near the 15-minute reminder — this is the point of comparing
    // against the last *emitted* cause rather than the last one observed.
    expect(Date.now() - outageStart).toBeLessThan(OUTAGE_REMINDER_INTERVAL_MS)
  })

  it("resets the suppressed counter after every emitted line", () => {
    noteFailure(1, "heartbeat", CAUSE_A)

    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(1, "heartbeat", CAUSE_A)).toEqual({ kind: "silent" })

    advance(MIN_TRANSITION_LOG_INTERVAL_MS - HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(1, "heartbeat", CAUSE_B)).toMatchObject({
      kind: "cause-changed",
      suppressed: 1,
    })

    // The counter restarts from zero after that emission
    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(1, "heartbeat", CAUSE_B)).toEqual({ kind: "silent" })

    advance(OUTAGE_REMINDER_INTERVAL_MS - HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(1, "heartbeat", CAUSE_B)).toMatchObject({
      kind: "reminder",
      suppressed: 1,
    })
  })

  // -------------------------------------------------------------------------
  // Recovery
  // -------------------------------------------------------------------------

  it("returns outage stats on recovery and null once the client is healthy", () => {
    noteFailure(2, "deep-poll", CAUSE_A)
    advance(30_000)
    noteFailure(2, "deep-poll", CAUSE_A)
    advance(30_000)

    expect(noteSuccess(2, "deep-poll")).toEqual({ downForMs: 60_000, failures: 2 })
    // State is deleted on recovery — a healthy client holds nothing
    expect(noteSuccess(2, "deep-poll")).toBeNull()
  })

  it("logs a fresh first failure after a recovery", () => {
    noteFailure(1, "heartbeat", CAUSE_A)
    advance(HEARTBEAT_INTERVAL_MS)
    noteSuccess(1, "heartbeat")

    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(1, "heartbeat", CAUSE_A)).toMatchObject({ kind: "first", failures: 1 })
  })

  // -------------------------------------------------------------------------
  // Key isolation
  // -------------------------------------------------------------------------

  it("keys heartbeat and deep-poll failures independently for the same client", () => {
    expect(noteFailure(1, "heartbeat", CAUSE_A)).toMatchObject({ kind: "first" })
    expect(noteFailure(1, "deep-poll", CAUSE_A)).toMatchObject({ kind: "first" })

    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(1, "heartbeat", CAUSE_A)).toEqual({ kind: "silent" })

    // A heartbeat recovery must not reset the deep-poll outage. The old
    // mitigation shared one lastError column and got exactly this wrong.
    noteSuccess(1, "heartbeat")
    expect(noteFailure(1, "deep-poll", CAUSE_A)).toEqual({ kind: "silent" })
    expect(noteFailure(1, "heartbeat", CAUSE_A)).toMatchObject({ kind: "first" })
  })

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  it("retains only clients in the live set and drops the rest", () => {
    noteFailure(2, "heartbeat", CAUSE_A)
    noteFailure(2, "deep-poll", CAUSE_A)
    noteFailure(3, "heartbeat", CAUSE_A)

    retainFailureLogClients(new Set([3]))

    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(2, "heartbeat", CAUSE_A)).toMatchObject({ kind: "first" })
    expect(noteFailure(2, "deep-poll", CAUSE_A)).toMatchObject({ kind: "first" })
    expect(noteFailure(3, "heartbeat", CAUSE_A)).toEqual({ kind: "silent" })
  })

  it("clears every entry when the live set is empty", () => {
    noteFailure(2, "heartbeat", CAUSE_A)
    noteFailure(3, "heartbeat", CAUSE_A)

    retainFailureLogClients(new Set())

    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(2, "heartbeat", CAUSE_A)).toMatchObject({ kind: "first" })
    expect(noteFailure(3, "heartbeat", CAUSE_A)).toMatchObject({ kind: "first" })
  })

  it("clears both keys for a deleted client and leaves other clients alone", () => {
    noteFailure(2, "heartbeat", CAUSE_A)
    noteFailure(2, "deep-poll", CAUSE_A)
    noteFailure(3, "heartbeat", CAUSE_A)

    clearFailureLogKeysForClient(2)

    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(2, "heartbeat", CAUSE_A)).toMatchObject({ kind: "first" })
    expect(noteFailure(2, "deep-poll", CAUSE_A)).toMatchObject({ kind: "first" })
    expect(noteFailure(3, "heartbeat", CAUSE_A)).toEqual({ kind: "silent" })
  })

  it("clearFailureLogGate drops all state", () => {
    noteFailure(2, "heartbeat", CAUSE_A)
    noteFailure(3, "deep-poll", CAUSE_A)

    clearFailureLogGate()

    advance(HEARTBEAT_INTERVAL_MS)
    expect(noteFailure(2, "heartbeat", CAUSE_A)).toMatchObject({ kind: "first" })
    expect(noteFailure(3, "deep-poll", CAUSE_A)).toMatchObject({ kind: "first" })
  })
})
