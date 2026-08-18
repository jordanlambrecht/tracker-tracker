// src/lib/__tests__/tracker-scheduler-outage-wiring.test.ts
//
// pollTracker is the ONLY thing that ever writes the tracker connectability
// ledger. If this wiring is wrong the feature is silently dead — every unit test
// in tracker-outages.test.ts still passes, the table stays empty, and the charts
// draw nothing forever while looking exactly like a healthy install.
//
// So this file pins the wiring itself, in both directions:
//   * a FAILED poll records one failure, tagged scheduled or manual
//   * a SUCCESSFUL poll records NOTHING
//
// The second is the load-bearing one. Rows are written closed, so a success has
// nothing to close; a "close it on recovery" call here would be exactly the
// unbounded overstatement the ledger's design rejects — it would band a
// multi-day circuit-breaker pause that nothing ever observed.

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/tracker-outages", () => ({
  recordTrackerPollFailure: vi.fn(async () => {}),
  pruneTrackerOutages: vi.fn(async () => 0),
}))
vi.mock("@/lib/app-liveness", () => ({ pruneCoverageGaps: vi.fn(async () => 0) }))
vi.mock("@/lib/crypto", () => ({ decrypt: vi.fn(() => "token") }))
vi.mock("@/lib/notifications/dispatch", () => ({ dispatchNotifications: vi.fn(async () => {}) }))
vi.mock("@/lib/alert-pruning", () => ({ pruneDismissedAlerts: vi.fn(async () => 0) }))
vi.mock("@/lib/server-data", () => ({ recordDatabaseSize: vi.fn(async () => {}) }))
vi.mock("@/lib/tunnel", () => ({ buildProxyAgentFromSettings: vi.fn(() => undefined) }))
vi.mock("@/data/tracker-registry", () => ({ findRegistryEntry: vi.fn(() => null) }))
vi.mock("node-cron", () => ({ default: { schedule: vi.fn() } }))

const fetchStats = vi.fn()
vi.mock("@/lib/adapters", () => ({
  getAdapter: vi.fn(() => ({ fetchStats })),
  buildFetchOptions: vi.fn(() => ({})),
}))

import { pruneCoverageGaps } from "@/lib/app-liveness"
import { db } from "@/lib/db"
import { pruneTrackerOutages, recordTrackerPollFailure } from "@/lib/tracker-outages"
import { pollAllTrackers, pollTracker } from "@/lib/tracker-scheduler"

/** Drizzle-shaped chain: any method sequence resolves to `result`. */
function chain(result: unknown): Record<string, unknown> {
  const settled = Promise.resolve(result)
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return settled.then.bind(settled)
        if (prop === "catch") return settled.catch.bind(settled)
        if (prop === "finally") return settled.finally.bind(settled)
        return () => proxy
      },
    }
  )
  return proxy
}

const TRACKER_ROW = {
  id: 42,
  name: "Example",
  isActive: true,
  encryptedApiToken: "enc",
  platformType: "unit3d",
  baseUrl: "https://example.test",
  apiPath: "/api",
  useProxy: false,
  remoteUserId: null,
  joinedAt: null,
  platformMeta: null,
  lastPolledAt: null,
  lastError: null,
  lastErrorAt: null,
  consecutiveFailures: 0,
  pausedAt: null,
  userPausedAt: null,
  minimumRatio: null,
}

const STATS = {
  uploadedBytes: 1_000n,
  downloadedBytes: 500n,
  ratio: 2,
  seedbonus: null,
  hitAndRuns: null,
  seedingCount: null,
  leechingCount: null,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  shareScore: null,
  username: null,
  group: null,
  remoteUserId: null,
  joinedDate: null,
  lastAccessDate: null,
  platformMeta: null,
  avatarUrl: null,
}

/**
 * `db.select(cols)` answers by projection: the tracker row for the poll's own
 * lookup, and nothing for every other read (previous snapshot, checkpoints).
 */
function seedDb() {
  vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
    const keys = Object.keys(cols ?? {})
    if (keys.includes("encryptedApiToken")) return chain([TRACKER_ROW])
    return chain([])
  }) as never)
  vi.mocked(db.insert).mockImplementation((() => chain([])) as never)
  vi.mocked(db.update).mockImplementation((() =>
    chain([{ consecutiveFailures: 1, pausedAt: null }])) as never)
  vi.mocked(db.delete).mockImplementation((() => chain([])) as never)
}

const KEY = Buffer.alloc(32)

beforeEach(() => {
  vi.clearAllMocks()
  seedDb()
})

describe("pollTracker → tracker outage ledger", () => {
  it("records one failure when a scheduled poll fails", async () => {
    fetchStats.mockRejectedValue(new Error("ETIMEDOUT"))

    await pollTracker(42, KEY, false)

    expect(recordTrackerPollFailure).toHaveBeenCalledTimes(1)
    expect(recordTrackerPollFailure).toHaveBeenCalledWith(42, "poll")
  })

  it("tags a manual poll's failure as manual", async () => {
    fetchStats.mockRejectedValue(new Error("ETIMEDOUT"))

    await pollTracker(42, KEY, false, undefined, undefined, undefined, true)

    expect(recordTrackerPollFailure).toHaveBeenCalledWith(42, "manual")
  })

  it("records a failure that never reached the network, like a bad API key", async () => {
    // A local failure still means no stats were collected for this tracker, and
    // the chart hole it leaves is identical to an unreachable tracker's.
    const { decrypt } = await import("@/lib/crypto")
    vi.mocked(decrypt).mockImplementationOnce(() => {
      throw new Error("bad key")
    })

    await pollTracker(42, KEY, false)

    expect(recordTrackerPollFailure).toHaveBeenCalledTimes(1)
  })

  it("records NOTHING when the poll succeeds", async () => {
    fetchStats.mockResolvedValue(STATS)

    await pollTracker(42, KEY, false)

    expect(recordTrackerPollFailure).not.toHaveBeenCalled()
  })

  it("records nothing when a successful poll clears prior failures", async () => {
    vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
      const keys = Object.keys(cols ?? {})
      if (keys.includes("encryptedApiToken")) {
        return chain([{ ...TRACKER_ROW, consecutiveFailures: 3, pausedAt: new Date() }])
      }
      return chain([])
    }) as never)
    fetchStats.mockResolvedValue(STATS)

    await pollTracker(42, KEY, false)

    expect(recordTrackerPollFailure).not.toHaveBeenCalled()
  })

  it("records nothing for an inactive tracker, which is never polled at all", async () => {
    vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
      const keys = Object.keys(cols ?? {})
      if (keys.includes("encryptedApiToken")) {
        return chain([{ ...TRACKER_ROW, isActive: false }])
      }
      return chain([])
    }) as never)

    await pollTracker(42, KEY, false)

    expect(recordTrackerPollFailure).not.toHaveBeenCalled()
  })
})

describe("pollAllTrackers → outage retention", () => {
  /** Settings row plus one tracker that is overdue, so the prune block is reached. */
  function seedForPrune(retentionDays: number | null) {
    vi.mocked(db.select).mockImplementation(((cols: Record<string, unknown>) => {
      const keys = Object.keys(cols ?? {})
      if (keys.includes("snapshotRetentionDays")) {
        return chain([
          {
            storeUsernames: true,
            snapshotRetentionDays: retentionDays,
            trackerPollIntervalMinutes: 15,
            proxyEnabled: false,
            proxyType: null,
            proxyHost: null,
            proxyPort: null,
            proxyUsername: null,
            encryptedProxyPassword: null,
          },
        ])
      }
      if (keys.includes("encryptedApiToken")) return chain([TRACKER_ROW])
      return chain([])
    }) as never)
    fetchStats.mockResolvedValue(STATS)
  }

  it("prunes tracker outages on the SAME horizon as the gaps they sit beside", async () => {
    // A chart that outlives its own outage records shows an unexplained flat stretch
    seedForPrune(30)

    await pollAllTrackers(KEY)

    expect(pruneTrackerOutages).toHaveBeenCalledWith(30)
    expect(pruneCoverageGaps).toHaveBeenCalledWith(30)
  })

  it("prunes nothing when retention is not configured", async () => {
    seedForPrune(null)

    await pollAllTrackers(KEY)

    expect(pruneTrackerOutages).not.toHaveBeenCalled()
    expect(pruneCoverageGaps).not.toHaveBeenCalled()
  })

  it("survives a pruning failure without breaking the poll cycle", async () => {
    seedForPrune(30)
    vi.mocked(pruneTrackerOutages).mockRejectedValueOnce(new Error("deadlock"))

    await expect(pollAllTrackers(KEY)).resolves.toBeUndefined()
  })
})
