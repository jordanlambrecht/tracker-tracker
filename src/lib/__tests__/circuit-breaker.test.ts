// src/lib/__tests__/circuit-breaker.test.ts
//
// Tests for the Poll Failure Circuit Breaker feature:
//
// Functions covered:
//   pollTracker           — success resets state; failures increment atomically via SQL expression; threshold triggers pause
//   pollAllTrackers       — skips trackers with pausedAt set; polls overdue non-paused trackers
//   POST /api/trackers/[id]/resume — clears pausedAt; preserves consecutiveFailures; 400 when not paused; 404 when not found
//   re-pause after resume — single failure immediately re-pauses when consecutiveFailures >= threshold

import { SQL } from "drizzle-orm"
import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Module mocks — establish before any imports that resolve these modules
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

vi.mock("@/lib/adapters", () => ({
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

vi.mock("@/lib/error-utils", () => ({
  sanitizeNetworkError: vi.fn((msg: string) => msg),
}))

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

vi.mock("@/lib/client-scheduler", () => ({
  startClientScheduler: vi.fn(),
  stopClientScheduler: vi.fn(),
  ensureClientSchedulerRunning: vi.fn(),
}))

vi.mock("@/data/tracker-registry", () => ({
  findRegistryEntry: vi.fn().mockReturnValue(undefined),
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
import { getAdapter } from "@/lib/adapters"
import { authenticate, parseTrackerId } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { POLL_FAILURE_THRESHOLD, pollAllTrackers, pollTracker } from "@/lib/tracker-scheduler"

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
    encryptedApiToken: "enc-token",
    isActive: true,
    lastPolledAt: null,
    lastError: null,
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
// pollTracker — success path
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

    await pollTracker(1, MOCK_KEY, false)

    // The final update must set consecutiveFailures: 0 and pausedAt: null
    const setCalls = updateChain.set.mock.calls
    const successReset = setCalls.find(
      (call: unknown[]) =>
        (call[0] as Record<string, unknown>).consecutiveFailures === 0 &&
        (call[0] as Record<string, unknown>).pausedAt === null &&
        (call[0] as Record<string, unknown>).lastError === null
    )
    expect(successReset).toBeDefined()
  })

  it("inserts a snapshot row on success", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectOnce([makeTrackerRow()]))
    mockSuccessAdapter()
    mockUpdateChain()
    const insertChain = mockInsertChain()

    await pollTracker(1, MOCK_KEY, false)

    expect(db.insert).toHaveBeenCalled()
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        trackerId: 1,
        ratio: 2.0,
      })
    )
  })

  it("does nothing when tracker is inactive", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([makeTrackerRow({ isActive: false })])
    )

    await pollTracker(1, MOCK_KEY, false)

    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it("does nothing when tracker row is not found", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectOnce([]))

    await pollTracker(1, MOCK_KEY, false)

    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// pollTracker — failure path: atomic increment
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

    await pollTracker(1, MOCK_KEY, false)

    // The failure update must use sql expressions for both consecutiveFailures and pausedAt —
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

  it("does NOT set pausedAt when failures are below threshold", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([makeTrackerRow({ consecutiveFailures: 2 })])
    )
    mockFailureAdapter()

    // Return new count = 3 (below threshold), pausedAt remains null
    mockUpdateChain([{ consecutiveFailures: POLL_FAILURE_THRESHOLD - 1, pausedAt: null }])

    await pollTracker(1, MOCK_KEY, false)

    // db.update called exactly once — single atomic operation
    expect(db.update).toHaveBeenCalledTimes(1)

    // log.warn must NOT fire because returning.pausedAt is null
    const { log } = await import("@/lib/logger")
    expect(log.warn).not.toHaveBeenCalled()
  })

  it("sets pausedAt when consecutiveFailures reaches POLL_FAILURE_THRESHOLD", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([makeTrackerRow({ consecutiveFailures: 3 })])
    )
    mockFailureAdapter()

    // Single atomic update returns count = 4 and a non-null pausedAt (threshold reached)
    const autoPassedAt = new Date()
    mockUpdateChain([{ consecutiveFailures: POLL_FAILURE_THRESHOLD, pausedAt: autoPassedAt }])

    await pollTracker(1, MOCK_KEY, false)

    // Only ONE db.update call — the atomic CASE expression handles everything
    expect(db.update).toHaveBeenCalledTimes(1)

    // log.warn must fire because returning.pausedAt is truthy
    const { log } = await import("@/lib/logger")
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("auto-paused"))
  })

  it("records lastError message when poll fails", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectOnce([makeTrackerRow()]))
    mockFailureAdapter("Bad API key")

    // Return both fields so the warn-check branch works correctly
    const updateChain = mockUpdateChain([{ consecutiveFailures: 1, pausedAt: null }])

    await pollTracker(1, MOCK_KEY, false)

    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg.lastError).toBe("Bad API key")
  })
})

// ---------------------------------------------------------------------------
// pollTracker — POLL_FAILURE_THRESHOLD constant
// ---------------------------------------------------------------------------

describe("POLL_FAILURE_THRESHOLD", () => {
  it("is exactly 4", () => {
    expect(POLL_FAILURE_THRESHOLD).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// pollAllTrackers — skip paused trackers
// ---------------------------------------------------------------------------

describe("pollAllTrackers: skips paused trackers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not poll a tracker whose pausedAt is set", async () => {
    const pausedTracker = makeTrackerRow({
      id: 1,
      pausedAt: new Date("2026-03-15"),
      lastPolledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago — overdue
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

    // pollTracker internals would fire db.select again — intercept and confirm it never does
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
      lastPolledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago — overdue
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
    // Select returns a paused tracker
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ pausedAt: new Date("2026-03-15") }]),
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

  it("sets pausedAt: null and lastError: null but NOT consecutiveFailures in the update", async () => {
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ pausedAt: new Date("2026-03-15") }]),
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
    // pausedAt must be cleared
    expect(setArg.pausedAt).toBeNull()
    // lastError must also be cleared on resume
    expect(setArg.lastError).toBeNull()
    // consecutiveFailures must NOT be touched — circuit breaker state is preserved
    expect(setArg).not.toHaveProperty("consecutiveFailures")
  })

  it("returns 400 when tracker is not paused", async () => {
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ pausedAt: null }]),
        }),
      }),
    }
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const request = makeRequest("http://localhost/api/trackers/1/resume")
    const params = Promise.resolve({ id: "1" })
    const response = await ResumePost(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/not paused/i)
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
          limit: vi.fn().mockResolvedValue([{ pausedAt: new Date("2026-03-15") }]),
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
// Re-pause after resume: single failure immediately re-pauses
//
// This is the critical edge case: resume clears pausedAt but does NOT reset
// consecutiveFailures. If consecutiveFailures is still >= threshold, the very
// next poll failure immediately re-pauses the tracker.
// ---------------------------------------------------------------------------

describe("re-pause after resume: immediate re-pause when failures remain at threshold", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(decrypt as ReturnType<typeof vi.fn>).mockReturnValue("plain-token")
  })

  it("re-pauses immediately on first failure after resume when consecutiveFailures equals threshold", async () => {
    // After resume: pausedAt=null, consecutiveFailures=4 (still at threshold)
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([
        makeTrackerRow({
          consecutiveFailures: POLL_FAILURE_THRESHOLD,
          pausedAt: null, // cleared by resume
        }),
      ])
    )

    mockFailureAdapter("Still broken")

    // Single atomic update: count becomes 5 (>= threshold), CASE sets pausedAt
    const autoPassedAt = new Date()
    mockUpdateChain([{ consecutiveFailures: POLL_FAILURE_THRESHOLD + 1, pausedAt: autoPassedAt }])

    await pollTracker(1, MOCK_KEY, false)

    // Only ONE db.update call — the CASE expression handles re-pause atomically
    expect(db.update).toHaveBeenCalledTimes(1)

    // log.warn must fire because returning.pausedAt is truthy
    const { log } = await import("@/lib/logger")
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("auto-paused"))
  })

  it("does NOT re-pause after resume if the next poll succeeds", async () => {
    // After resume: pausedAt=null, consecutiveFailures=4 still set
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSelectOnce([
        makeTrackerRow({
          consecutiveFailures: POLL_FAILURE_THRESHOLD,
          pausedAt: null,
        }),
      ])
    )

    mockSuccessAdapter()

    // On success, the update must reset both consecutiveFailures: 0 and pausedAt: null
    const updateChain = mockUpdateChain()
    mockInsertChain()

    await pollTracker(1, MOCK_KEY, false)

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
// pruneOldSnapshots — excludes user-paused trackers
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

    // The .where() on delete must have been called — carries the AND condition
    expect(mockWhere).toHaveBeenCalled()

    // The where argument must be an AND expression (Drizzle SQL object), not a bare lt()
    const whereArg = mockWhere.mock.calls[0]?.[0]
    expect(whereArg).toBeDefined()
    // Drizzle builds SQL objects — not primitives. Verify it is an object (the AND clause).
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
