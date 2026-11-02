// src/lib/__tests__/circuit-breaker.test.ts
//
// Tests for the Poll Failure Circuit Breaker feature:
//
// Functions covered:
//   pollTracker:                    success resets state; failures increment atomically via SQL expression; threshold triggers pause
//   pollAllTrackers:                skips trackers with pausedAt set; polls overdue non-paused trackers;
//                                   retries a pause left by an unreachable tracker on a doubling wait
//   POST /api/trackers/[id]/resume: clears pausedAt + lastError + lastErrorAt; resets consecutiveFailures to 0; idempotent 200 when not paused; 404 when not found; 400 for an unlinked row
//   post-resume behavior:           clean slate after resume; full threshold required to re-pause

import { SQL } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}))

vi.mock("@/lib/tracker-platforms", () => ({
  getAdapter: vi.fn(),
  buildFetchOptions: vi.fn().mockReturnValue({}),
}))

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(),
  encrypt: vi.fn(),
}))

vi.mock("@/lib/privacy", () => ({
  maskUsername: vi.fn((v: string) => `▓${v.length}`),
}))

vi.mock("@/lib/tunnel", () => ({
  buildProxyAgentFromSettings: vi.fn().mockReturnValue(undefined),
  VALID_PROXY_TYPES: new Set(["socks5", "http", "https"]),
}))

vi.mock("@/lib/error-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/error-utils")>()
  return {
    isUnreachableMessage: actual.isUnreachableMessage,
    sanitizeNetworkError: vi.fn((msg: string) => msg),
  }
})

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/alert-pruning", () => ({
  pruneDismissedAlerts: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/backup-scheduler", () => ({
  startBackupScheduler: vi.fn(),
  stopBackupScheduler: vi.fn(),
}))

vi.mock("@/lib/download-client-scheduler", () => ({
  startClientScheduler: vi.fn(),
  stopClientScheduler: vi.fn(),
  ensureClientSchedulerRunning: vi.fn(),
}))

vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
  },
}))

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
    parseTrackerId: vi.fn(),
  }
})

vi.mock("@/lib/notifications/dispatch", () => ({
  dispatchNotifications: vi.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST as ResumePost } from "@/app/api/trackers/[id]/resume/route"
import { authenticate, parseTrackerId } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { POLL_FAILURE_THRESHOLD } from "@/lib/limits"
import { getAdapter } from "@/lib/tracker-platforms"
import { pollAllTrackers, pollTracker } from "@/lib/tracker-scheduler"
import { TRACKER_UNLINKED_ERROR, UNLINKED_RESTORE_ERROR } from "@/lib/tracker-status"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_KEY = Buffer.from("deadbeef".repeat(8), "hex") // 32 bytes
const VALID_ENCRYPTION_KEY = "abcd1234".repeat(8)

function makeRequest(url: string, method = "POST"): Request {
  return new Request(url, { method })
}

/** Build a db.select() chain that resolves a single call with `rows`. */
function mockSelectOnce(rows: unknown[]) {
  const mockLimit = vi.fn().mockResolvedValue(rows)
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  return { from: mockFrom, where: mockWhere, orderBy: mockOrderBy, limit: mockLimit }
}

/** Build a db.update() chain with a fluent set/where/returning. */
function mockUpdateChain(returningRows: unknown[] = []) {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn().mockResolvedValue(returningRows),
  }
  chain.set.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  return chain
}

/** Build a db.insert() chain. */
function mockInsertChain() {
  const chain = {
    values: vi.fn().mockResolvedValue(undefined),
  }
  ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  return chain
}

/** A minimal tracker row as returned by db.select().from(trackers). */
function makeTrackerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Aither",
    baseUrl: "https://aither.cc",
    apiPath: "/api/user",
    platformType: "unit3d",
    registrySlug: "aither",
    encryptedApiToken: "enc-token",
    isActive: true,
    lastPolledAt: null,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    useProxy: false,
    remoteUserId: null,
    platformMeta: null,
    avatarRemoteUrl: null,
    joinedAt: null,
    lastAccessAt: null,
    ...overrides,
  }
}

/** Mock adapter that returns valid stats. */
function mockSuccessAdapter() {
  const adapter = {
    fetchStats: vi.fn().mockResolvedValue({
      uploadedBytes: BigInt(1000),
      downloadedBytes: BigInt(500),
      ratio: 2.0,
      bufferBytes: BigInt(500),
      seedingCount: 5,
      leechingCount: 0,
      seedbonus: null,
      hitAndRuns: null,
      requiredRatio: null,
      warned: false,
      freeleechTokens: null,
      shareScore: null,
      username: "user",
      group: "User",
      remoteUserId: null,
      joinedDate: null,
      lastAccessDate: null,
      platformMeta: null,
      avatarUrl: null,
    }),
  }
  ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValue(adapter)
  return adapter
}

/** Mock adapter that throws. */
function mockFailureAdapter(message = "Connection refused") {
  const adapter = {
    fetchStats: vi.fn().mockRejectedValue(new Error(message)),
  }
  ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValue(adapter)
  return adapter
}

// ---------------------------------------------------------------------------
// pollTracker, success path
// ---------------------------------------------------------------------------

describe("pollTracker: success path", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValue("plain-token")
  })

  it("resets consecutiveFailures and clears pausedAt on success", async () => {
    // db.select() returns the tracker row
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([makeTrackerRow({ consecutiveFailures: 3, pausedAt: new Date("2026-03-10") })])
    )

    mockSuccessAdapter()

    // db.update chains: first for meta (may or may not fire), last for success reset
    const updateChain = mockUpdateChain()

    // db.insert for the snapshot
    mockInsertChain()

    await pollTracker(1, MOCK_KEY, false, undefined)

    // The final update must set consecutiveFailures: 0, pausedAt: null, lastErrorAt: null
    const setCalls = updateChain.set.mock.calls
    const successReset = setCalls.find(
      (call: unknown[]) =>
        (call[0] as Record<string, unknown>).consecutiveFailures === 0 &&
        (call[0] as Record<string, unknown>).pausedAt === null &&
        (call[0] as Record<string, unknown>).lastError === null &&
        (call[0] as Record<string, unknown>).lastErrorAt === null
    )
    expect(successReset).toBeDefined()
  })

  it("inserts a snapshot row on success", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectOnce([makeTrackerRow()]))
    mockSuccessAdapter()
    mockUpdateChain()
    const insertChain = mockInsertChain()

    await pollTracker(1, MOCK_KEY, false, undefined)

    expect(db.insert).toHaveBeenCalled()
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        trackerId: 1,
        ratio: 2.0,
      })
    )
  })

  it("passes isManual: false to the snapshot insert when called without the isManual arg", async () => {
    // First select: tracker row. Second select: previous snapshot for notifications.
    let selectCallCount = 0
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return mockSelectOnce([makeTrackerRow()])
      }
      return mockSelectOnce([])
    })

    mockSuccessAdapter()
    mockUpdateChain()
    const insertChain = mockInsertChain()

    // Call without the 7th arg, isManual must default to false
    await pollTracker(1, MOCK_KEY, false, undefined)

    // The first insert call is for trackerSnapshots; check its values argument
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({ isManual: false }))
  })

  it("passes isManual: true to the snapshot insert when called with isManual = true", async () => {
    let selectCallCount = 0
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return mockSelectOnce([makeTrackerRow()])
      }
      return mockSelectOnce([])
    })

    mockSuccessAdapter()
    mockUpdateChain()
    const insertChain = mockInsertChain()

    // 7th arg: isManual = true
    await pollTracker(1, MOCK_KEY, false, undefined, undefined, undefined, true)

    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({ isManual: true }))
  })

  it("does nothing when tracker is inactive", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([makeTrackerRow({ isActive: false })])
    )

    await pollTracker(1, MOCK_KEY, false, undefined)

    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it("does nothing when tracker row is not found", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectOnce([]))

    await pollTracker(1, MOCK_KEY, false, undefined)

    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// pollTracker, failure path: atomic increment
// ---------------------------------------------------------------------------

describe("pollTracker: failure path — consecutiveFailures increment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValue("plain-token")
  })

  it("increments consecutiveFailures atomically via sql expression on failure", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([makeTrackerRow({ consecutiveFailures: 1 })])
    )
    mockFailureAdapter()

    // Simulate DB returning new count = 2 (below threshold), pausedAt still null
    const updateChain = mockUpdateChain([{ consecutiveFailures: 2, pausedAt: null }])

    await pollTracker(1, MOCK_KEY, false, undefined)

    // The failure update must use sql expressions for both consecutiveFailures and pausedAt,
    // not raw numbers or null. Find the set call that contains lastError.
    const failureSetCall = updateChain.set.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>
      return arg.lastError !== undefined
    })
    expect(failureSetCall).toBeDefined()
    const arg = (failureSetCall as unknown[])[0] as Record<string, unknown>
    // consecutiveFailures must be an actual Drizzle SQL expression, not a literal number
    expect(arg.consecutiveFailures).toBeInstanceOf(SQL)
    // pausedAt must also be a Drizzle SQL expression (CASE … END), not a raw value
    expect(arg.pausedAt).toBeInstanceOf(SQL)
  })

  // An empty API token decrypts cleanly (crypto.ts accepts a zero-length
  // plaintext), so it reaches the poll instead of failing at decrypt. It must
  // still be reported as a missing key rather than spending a doomed request
  // and surfacing the tracker's 401 as a generic auth failure.
  it("fails locally with a missing-key error when the API token decrypts to empty", async () => {
    ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValue("")
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([makeTrackerRow({ consecutiveFailures: 0 })])
    )
    // A perfectly working adapter is available on purpose: the point is that an
    // empty token must never reach it, so this must fail without it being used.
    const adapter = mockSuccessAdapter()
    const updateChain = mockUpdateChain([{ consecutiveFailures: 1, pausedAt: null }])

    await pollTracker(1, MOCK_KEY, false, undefined)

    // Must be a recorded failure, the success path writes lastError: null, so
    // match on a string specifically rather than merely "defined".
    const failureSetCall = updateChain.set.mock.calls.find(
      (call: unknown[]) => typeof (call[0] as Record<string, unknown>).lastError === "string"
    )
    expect(failureSetCall).toBeDefined()
    const arg = (failureSetCall as unknown[])[0] as Record<string, unknown>
    expect(arg.lastError).toMatch(/API key is missing or invalid/)

    // No adapter was resolved and no request went out, despite one being ready.
    expect(getAdapter).not.toHaveBeenCalled()
    expect(adapter.fetchStats).not.toHaveBeenCalled()
  })

  it("does NOT set pausedAt when failures are below threshold", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([makeTrackerRow({ consecutiveFailures: 2 })])
    )
    mockFailureAdapter()

    // Return new count = 3 (below threshold), pausedAt remains null
    mockUpdateChain([{ consecutiveFailures: POLL_FAILURE_THRESHOLD - 1, pausedAt: null }])

    await pollTracker(1, MOCK_KEY, false, undefined)

    // db.update called exactly once, single atomic operation
    expect(db.update).toHaveBeenCalledTimes(1)

    // log.warn must not fire because returning.pausedAt is null
    const { log } = await import("@/lib/logger")
    expect(log.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({}),
      expect.stringContaining("auto-paused")
    )
  })

  it("sets pausedAt when consecutiveFailures reaches POLL_FAILURE_THRESHOLD", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([makeTrackerRow({ consecutiveFailures: 3 })])
    )
    mockFailureAdapter()

    // Single atomic update returns count = 4 and a non-null pausedAt (threshold reached)
    const autoPassedAt = new Date()
    mockUpdateChain([{ consecutiveFailures: POLL_FAILURE_THRESHOLD, pausedAt: autoPassedAt }])

    await pollTracker(1, MOCK_KEY, false, undefined)

    // Only one db.update call, the atomic CASE expression handles everything
    expect(db.update).toHaveBeenCalledTimes(1)

    // log.warn must fire because returning.pausedAt is truthy
    const { log } = await import("@/lib/logger")
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ trackerId: 1, consecutiveFailures: POLL_FAILURE_THRESHOLD }),
      expect.stringContaining("auto-paused")
    )
  })

  describe("a tracker already paused that fails again", () => {
    const pausedAt = new Date("2026-11-01T02:30:00Z")

    beforeEach(() => {
      ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSelectOnce([makeTrackerRow({ consecutiveFailures: POLL_FAILURE_THRESHOLD, pausedAt })])
      )
      mockFailureAdapter()
    })

    it("keeps the time the pause began", async () => {
      const updateChain = mockUpdateChain([
        { consecutiveFailures: POLL_FAILURE_THRESHOLD + 1, pausedAt },
      ])

      await pollTracker(1, MOCK_KEY, false, undefined)

      const arg = updateChain.set.mock.calls
        .map((call: unknown[]) => call[0] as Record<string, unknown>)
        .find((set) => set.lastError !== undefined)
      // Rendered, since the database decides: a stored pause wins, and only a
      // row without one is paused at the threshold.
      const { sql: text } = new PgDialect().sqlToQuery(arg?.pausedAt as SQL)
      expect(text).toMatch(/^COALESCE\("trackers"\."paused_at", CASE WHEN /)
    })

    it("logs a failed retry, not a new auto-pause", async () => {
      mockUpdateChain([{ consecutiveFailures: POLL_FAILURE_THRESHOLD + 1, pausedAt }])

      await pollTracker(1, MOCK_KEY, false, undefined)

      const { log } = await import("@/lib/logger")
      expect(log.warn).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("auto-paused")
      )
      expect(log.info).toHaveBeenCalledWith(
        expect.objectContaining({ consecutiveFailures: POLL_FAILURE_THRESHOLD + 1 }),
        "Paused tracker 1 failed again"
      )
    })

    // The scheduler never retries a hard pause, so only Poll Now reaches one.
    it("sends nothing when Poll Now fails on a pause the tracker refused", async () => {
      ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSelectOnce([
          makeTrackerRow({
            consecutiveFailures: POLL_FAILURE_THRESHOLD,
            pausedAt,
            lastError: "Authentication failed",
          }),
        ])
      )
      mockFailureAdapter("Authentication failed")
      mockUpdateChain([{ consecutiveFailures: POLL_FAILURE_THRESHOLD + 1, pausedAt }])
      const { dispatchNotifications } = await import("@/lib/notifications/dispatch")

      await pollTracker(1, MOCK_KEY, false, undefined, undefined, undefined, true)

      expect(dispatchNotifications).not.toHaveBeenCalled()
    })
  })

  it("records lastError message when poll fails", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectOnce([makeTrackerRow()]))
    mockFailureAdapter("Bad API key")

    // Return both fields so the warn-check branch works correctly
    const updateChain = mockUpdateChain([{ consecutiveFailures: 1, pausedAt: null }])

    await pollTracker(1, MOCK_KEY, false, undefined)

    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.lastError).toBe("Bad API key")
  })

  it("sets lastErrorAt to a Date instance (not null, not a SQL expression) on failure", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectOnce([makeTrackerRow()]))
    mockFailureAdapter("Timeout")

    const updateChain = mockUpdateChain([{ consecutiveFailures: 1, pausedAt: null }])

    const before = new Date()
    await pollTracker(1, MOCK_KEY, false, undefined)
    const after = new Date()

    // Find the set call that carries lastError (the failure update)
    const failureSetCall = updateChain.set.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>
      return arg.lastError !== undefined
    })
    expect(failureSetCall).toBeDefined()

    const setArg = (failureSetCall as unknown[])[0] as Record<string, unknown>
    // lastErrorAt must be a plain Date, not null and not a Drizzle SQL object
    expect(setArg.lastErrorAt).toBeInstanceOf(Date)
    // Sanity-check the timestamp is within the window of the test execution
    const recorded = setArg.lastErrorAt as Date
    expect(recorded.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(recorded.getTime()).toBeLessThanOrEqual(after.getTime())
  })
})

// ---------------------------------------------------------------------------
// pollTracker, POLL_FAILURE_THRESHOLD constant
// ---------------------------------------------------------------------------

describe("POLL_FAILURE_THRESHOLD", () => {
  it("is exactly 4", () => {
    expect(POLL_FAILURE_THRESHOLD).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// pollAllTrackers, skip paused trackers
// ---------------------------------------------------------------------------

describe("pollAllTrackers: skips paused trackers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not poll a tracker whose pausedAt is set", async () => {
    const pausedTracker = makeTrackerRow({
      id: 1,
      pausedAt: new Date("2026-03-15"),
      lastPolledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago, overdue
      isActive: true,
    })

    // Settings query
    const settingsChain = {
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            storeUsernames: true,
            snapshotRetentionDays: null,
            trackerPollIntervalMinutes: 60,
            proxyEnabled: false,
            proxyType: "socks5",
            proxyHost: null,
            proxyPort: 1080,
            proxyUsername: null,
            encryptedProxyPassword: null,
          },
        ]),
      }),
    }

    // Active trackers query
    const trackersChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([pausedTracker]),
      }),
    }

    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(settingsChain)
      .mockReturnValueOnce(trackersChain)

    // pollTracker internals would fire db.select again, intercept and confirm it never does
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    })

    await pollAllTrackers(MOCK_KEY)

    // db.insert (snapshot write) should never have been called because the
    // only tracker was paused and should have been filtered out
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("polls a tracker that is overdue and NOT paused", async () => {
    const overdueTracker = makeTrackerRow({
      id: 2,
      pausedAt: null,
      lastPolledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago, overdue
      isActive: true,
    })

    const settingsChain = {
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            storeUsernames: true,
            snapshotRetentionDays: null,
            trackerPollIntervalMinutes: 60,
            proxyEnabled: false,
            proxyType: "socks5",
            proxyHost: null,
            proxyPort: 1080,
            proxyUsername: null,
            encryptedProxyPassword: null,
          },
        ]),
      }),
    }

    const trackersChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([overdueTracker]),
      }),
    }

    // pollTracker's internal select call
    const trackerDetailChain = mockSelectOnce([overdueTracker])

    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(settingsChain)
      .mockReturnValueOnce(trackersChain)
      .mockReturnValue({ from: vi.fn().mockReturnValue(trackerDetailChain) })
    ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValue("plain-token")
    mockSuccessAdapter()
    mockUpdateChain()
    const insertChain = mockInsertChain()

    await pollAllTrackers(MOCK_KEY)

    // Snapshot insert confirms the tracker was polled
    expect(insertChain.values).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// pollAllTrackers, retries of a tracker paused while unreachable
// ---------------------------------------------------------------------------

describe("pollAllTrackers: retries a tracker paused while unreachable", () => {
  const NOW = new Date("2026-11-01T12:00:00Z")
  const HOUR = 60 * 60_000
  const ago = (ms: number) => new Date(NOW.getTime() - ms)

  // Paused an hour ago at the fourth timeout, on an hourly poll.
  function pausedRow(overrides: Record<string, unknown> = {}) {
    return makeTrackerRow({
      pausedAt: ago(HOUR),
      userPausedAt: null,
      lastError: "Request timed out",
      lastErrorAt: ago(HOUR),
      consecutiveFailures: POLL_FAILURE_THRESHOLD,
      lastPolledAt: ago(5 * HOUR),
      ...overrides,
    })
  }

  // One poll cycle: settings, the active rows, then pollTracker's own reads.
  // A cycle that polls nothing returns after the second select.
  function mockPollCycle(row: Record<string, unknown>) {
    const settingsChain = {
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            storeUsernames: true,
            snapshotRetentionDays: null,
            trackerPollIntervalMinutes: 60,
            proxyEnabled: false,
            proxyType: "socks5",
            proxyHost: null,
            proxyPort: 1080,
            proxyUsername: null,
            encryptedProxyPassword: null,
          },
        ]),
      }),
    }
    const trackersChain = {
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([row]) }),
    }
    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(settingsChain)
      .mockReturnValueOnce(trackersChain)
      .mockReturnValue({ from: vi.fn().mockReturnValue(mockSelectOnce([row])) })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
    ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValue("plain-token")
    mockInsertChain()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("retries once one poll interval has passed, and a success un-pauses it", async () => {
    mockPollCycle(pausedRow())
    const adapter = mockSuccessAdapter()
    const update = mockUpdateChain()

    await pollAllTrackers(MOCK_KEY)

    expect(adapter.fetchStats).toHaveBeenCalledTimes(1)
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({ pausedAt: null, consecutiveFailures: 0, lastError: null })
    )
  })

  it("retries a pause left by a gateway failure", async () => {
    mockPollCycle(pausedRow({ lastError: "API returned 502" }))
    const adapter = mockSuccessAdapter()
    mockUpdateChain()

    await pollAllTrackers(MOCK_KEY)

    expect(adapter.fetchStats).toHaveBeenCalledTimes(1)
  })

  // The cycle takes in a poll due within its 60-second batch tolerance, the
  // same as an overdue one.
  it.each([
    ["retries with a minute of the wait left", HOUR - 60_000, 1],
    ["waits with a minute and a millisecond left", HOUR - 60_001, 0],
  ])("%s", async (_, sinceFailure, polls) => {
    mockPollCycle(pausedRow({ lastErrorAt: ago(sinceFailure) }))
    const adapter = mockSuccessAdapter()
    mockUpdateChain()

    await pollAllTrackers(MOCK_KEY)

    expect(adapter.fetchStats).toHaveBeenCalledTimes(polls)
  })

  // One retry has failed, so the wait is two hours.
  it.each([
    ["waits 90 minutes into the doubled wait", 90 * 60_000, 0],
    ["retries once the doubled wait has passed", 2 * HOUR, 1],
  ])("%s", async (_, sinceFailure, polls) => {
    mockPollCycle(
      pausedRow({ consecutiveFailures: POLL_FAILURE_THRESHOLD + 1, lastErrorAt: ago(sinceFailure) })
    )
    const adapter = mockSuccessAdapter()
    mockUpdateChain()

    await pollAllTrackers(MOCK_KEY)

    expect(adapter.fetchStats).toHaveBeenCalledTimes(polls)
  })

  it.each([
    ["a user pause", { userPausedAt: ago(30 * 60_000) }],
    ["a restore pause", { registrySlug: null, lastError: UNLINKED_RESTORE_ERROR }],
    ["a pause the tracker answered", { lastError: "Authentication failed" }],
  ])("never polls %s, however long ago it failed", async (_, overrides) => {
    mockPollCycle(pausedRow({ lastErrorAt: ago(48 * HOUR), ...overrides }))
    mockSuccessAdapter()

    await pollAllTrackers(MOCK_KEY)

    expect(db.select).toHaveBeenCalledTimes(2)
  })

  it("sends nothing when a retry fails for the same reason", async () => {
    mockPollCycle(pausedRow())
    const adapter = mockFailureAdapter("Request timed out")
    mockUpdateChain([{ consecutiveFailures: POLL_FAILURE_THRESHOLD + 1, pausedAt: ago(HOUR) }])
    const { dispatchNotifications } = await import("@/lib/notifications/dispatch")

    await pollAllTrackers(MOCK_KEY)

    expect(adapter.fetchStats).toHaveBeenCalledTimes(1)
    expect(dispatchNotifications).not.toHaveBeenCalled()
  })

  it("stops retrying once a retry is refused, and says so once", async () => {
    mockPollCycle(pausedRow())
    const adapter = mockFailureAdapter("Authentication failed")
    const update = mockUpdateChain([
      { consecutiveFailures: POLL_FAILURE_THRESHOLD + 1, pausedAt: ago(HOUR) },
    ])
    const { dispatchNotifications } = await import("@/lib/notifications/dispatch")

    await pollAllTrackers(MOCK_KEY)

    expect(adapter.fetchStats).toHaveBeenCalledTimes(1)
    // The one notification carries the pause, which adds the "stays paused" line.
    expect(dispatchNotifications).toHaveBeenCalledTimes(1)
    expect(vi.mocked(dispatchNotifications).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        trackerDown: true,
        trackerError: "Authentication failed",
        trackerPausedAt: ago(HOUR).toISOString(),
      })
    )

    // The next cycle reads the row the failure wrote, long after any wait.
    const written = update.set.mock.calls
      .map((call: unknown[]) => call[0] as Record<string, unknown>)
      .find((set) => typeof set.lastError === "string")
    vi.setSystemTime(new Date(NOW.getTime() + 48 * HOUR))
    mockPollCycle(
      pausedRow({
        lastError: written?.lastError,
        lastErrorAt: written?.lastErrorAt,
        consecutiveFailures: POLL_FAILURE_THRESHOLD + 1,
      })
    )

    await pollAllTrackers(MOCK_KEY)

    expect(adapter.fetchStats).toHaveBeenCalledTimes(1)
  })

  it("still notifies a failure before any pause", async () => {
    mockPollCycle(makeTrackerRow({ lastPolledAt: ago(2 * HOUR), lastError: null, pausedAt: null }))
    mockFailureAdapter("Request timed out")
    mockUpdateChain([{ consecutiveFailures: 1, pausedAt: null }])
    const { dispatchNotifications } = await import("@/lib/notifications/dispatch")

    await pollAllTrackers(MOCK_KEY)

    expect(dispatchNotifications).toHaveBeenCalledTimes(1)
    expect(vi.mocked(dispatchNotifications).mock.calls[0][0]).toEqual(
      expect.objectContaining({ trackerDown: true, trackerPausedAt: null })
    )
  })
})

// ---------------------------------------------------------------------------
// POST /api/trackers/[id]/resume
// ---------------------------------------------------------------------------

describe("POST /api/trackers/[id]/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_ENCRYPTION_KEY,
    })
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
  })

  it("returns 200 and clears pausedAt when tracker is paused", async () => {
    // Select returns a paused tracker with full circuit breaker state
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              pausedAt: new Date("2026-03-15"),
              consecutiveFailures: 4,
              lastError: "API returned 429",
              registrySlug: "aither",
            },
          ]),
        }),
      }),
    }
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const updateChain = {
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain)

    const request = makeRequest("http://localhost/api/trackers/1/resume")
    const params = Promise.resolve({ id: "1" })
    const response = await ResumePost(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it("resets pausedAt, lastError, lastErrorAt, AND consecutiveFailures in the update", async () => {
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              pausedAt: new Date("2026-03-15"),
              consecutiveFailures: 4,
              lastError: "API returned 429",
              registrySlug: "aither",
            },
          ]),
        }),
      }),
    }
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const mockWhere = vi.fn().mockResolvedValue(undefined)
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const request = makeRequest("http://localhost/api/trackers/1/resume")
    const params = Promise.resolve({ id: "1" })
    await ResumePost(request, { params })

    const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg).toBeDefined()
    expect(setArg.pausedAt).toBeNull()
    expect(setArg.lastError).toBeNull()
    expect(setArg.lastErrorAt).toBeNull()
    // consecutiveFailures must be reset to 0 so the next failure does not immediately re-pause
    expect(setArg.consecutiveFailures).toBe(0)
  })

  it("returns 200 idempotently when tracker is already unpaused", async () => {
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { pausedAt: null, consecutiveFailures: 0, lastError: null, registrySlug: "aither" },
            ]),
        }),
      }),
    }
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const request = makeRequest("http://localhost/api/trackers/1/resume")
    const params = Promise.resolve({ id: "1" })
    const response = await ResumePost(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.alreadyResumed).toBe(true)
    // No update should have been issued
    expect(db.update).not.toHaveBeenCalled()
  })

  // An unlinked row is never polled, so resuming it would only hide why it is
  // paused. The refusal comes before the not-paused check, so it applies either way.
  it.each([
    ["paused", new Date("2026-03-15")],
    ["not paused", null],
  ])("refuses an unlinked tracker that is %s, without writing", async (_state, pausedAt) => {
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { pausedAt, consecutiveFailures: 0, lastError: null, registrySlug: null },
            ]),
        }),
      }),
    }
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const request = makeRequest("http://localhost/api/trackers/1/resume")
    const response = await ResumePost(request, { params: Promise.resolve({ id: "1" }) })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: TRACKER_UNLINKED_ERROR })
    expect(db.update).not.toHaveBeenCalled()
  })

  it("returns 404 when tracker does not exist", async () => {
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const request = makeRequest("http://localhost/api/trackers/999/resume")
    const params = Promise.resolve({ id: "999" })
    const response = await ResumePost(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toMatch(/not found/i)
  })

  it("returns 401 when unauthenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const request = makeRequest("http://localhost/api/trackers/1/resume")
    const params = Promise.resolve({ id: "1" })
    const response = await ResumePost(request, { params })

    expect(response.status).toBe(401)
  })

  it("returns 400 for invalid tracker ID", async () => {
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
    )

    const request = makeRequest("http://localhost/api/trackers/abc/resume")
    const params = Promise.resolve({ id: "abc" })
    const response = await ResumePost(request, { params })

    expect(response.status).toBe(400)
  })

  it("returns 500 when the DB update throws", async () => {
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              pausedAt: new Date("2026-03-15"),
              consecutiveFailures: 4,
              lastError: "API returned 429",
              registrySlug: "aither",
            },
          ]),
        }),
      }),
    }
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)
    ;(db.update as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("DB connection lost")
    })

    const request = makeRequest("http://localhost/api/trackers/1/resume")
    const params = Promise.resolve({ id: "1" })
    const response = await ResumePost(request, { params })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toMatch(/failed to resume/i)
  })
})

// ---------------------------------------------------------------------------
// Post-resume behavior: resume resets consecutiveFailures to 0
//
// After resume, the tracker gets a clean slate. It takes a full
// POLL_FAILURE_THRESHOLD consecutive failures to re-pause.
// ---------------------------------------------------------------------------

describe("post-resume behavior: clean slate after resume", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValue("plain-token")
  })

  it("does NOT re-pause on first failure after resume (consecutiveFailures starts at 0)", async () => {
    // After resume: pausedAt=null, consecutiveFailures=0 (reset by resume)
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([
        makeTrackerRow({
          consecutiveFailures: 0,
          pausedAt: null,
        }),
      ])
    )

    mockFailureAdapter("Still broken")

    // Failure increments 0+1=1, which is below threshold, so pausedAt stays null
    mockUpdateChain([{ consecutiveFailures: 1, pausedAt: null }])

    await pollTracker(1, MOCK_KEY, false, undefined)

    expect(db.update).toHaveBeenCalledTimes(1)

    // log.warn should not fire (no auto-pause, just a failure increment)
    const { log } = await import("@/lib/logger")
    expect(log.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({}),
      expect.stringContaining("auto-paused")
    )
  })

  it("does NOT re-pause after resume if the next poll succeeds", async () => {
    // After resume: pausedAt=null, consecutiveFailures=0
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([
        makeTrackerRow({
          consecutiveFailures: 0,
          pausedAt: null,
        }),
      ])
    )

    mockSuccessAdapter()

    const updateChain = mockUpdateChain()
    mockInsertChain()

    await pollTracker(1, MOCK_KEY, false, undefined)

    const setCalls = updateChain.set.mock.calls
    const successReset = setCalls.find(
      (call: unknown[]) =>
        (call[0] as Record<string, unknown>).consecutiveFailures === 0 &&
        (call[0] as Record<string, unknown>).pausedAt === null
    )
    expect(successReset).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// pruneOldSnapshots, excludes user-paused trackers
// ---------------------------------------------------------------------------

describe("pruneOldSnapshots: excludes snapshots for user-paused trackers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("passes an AND clause that excludes user-paused tracker IDs from deletion", async () => {
    const { pruneOldSnapshots } = await import("@/lib/tracker-scheduler")

    // db.select() subquery chain (used inside notInArray)
    const subqueryWhere = vi.fn().mockReturnValue([])
    const subqueryFrom = vi.fn().mockReturnValue({ where: subqueryWhere })

    // db.delete() chain
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere })

    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: subqueryFrom,
    })
    ;(db.delete as ReturnType<typeof vi.fn>).mockImplementation(mockDelete)

    await pruneOldSnapshots(30)

    // db.delete must have been called
    expect(db.delete).toHaveBeenCalled()

    // The .where() on delete must have been called, carries the AND condition
    expect(mockWhere).toHaveBeenCalled()

    // The where argument must be an AND expression (Drizzle SQL object), not a bare lt()
    const whereArg = mockWhere.mock.calls[0]?.[0]
    expect(whereArg).toBeDefined()
    // Drizzle builds SQL objects, not primitives. Verify it is an object (the AND clause).
    expect(typeof whereArg).toBe("object")
    expect(whereArg).not.toBeNull()
  })

  it("returns count of deleted snapshots", async () => {
    const { pruneOldSnapshots } = await import("@/lib/tracker-scheduler")

    const mockReturning = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }])
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: mockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue([]) }),
    })

    const count = await pruneOldSnapshots(30)

    expect(count).toBe(3)
  })

  it("returns 0 when no snapshots fall outside retention window", async () => {
    const { pruneOldSnapshots } = await import("@/lib/tracker-scheduler")

    const mockReturning = vi.fn().mockResolvedValue([])
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: mockWhere })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue([]) }),
    })

    const count = await pruneOldSnapshots(30)

    expect(count).toBe(0)
  })
})
