// src/lib/__tests__/dashboard.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import type { Snapshot, TrackerSummary } from "@/types/api"

// Mock findRegistryEntry so computeAlerts can look up registry entries by baseUrl
vi.mock("@/data/tracker-registry", () => ({
  findRegistryEntry: vi.fn(() => undefined),
}))

import { findRegistryEntry } from "@/data/tracker-registry"
import {
  clearDismissedAlerts,
  computeAggregateStats,
  computeAlerts,
  detectRankChanges,
  dismissAlert,
  getDismissedAlerts,
} from "../dashboard"

const mockFindRegistryEntry = vi.mocked(findRegistryEntry)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Aither",
    baseUrl: "https://aither.cc",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: new Date().toISOString(),
    lastError: null,
    color: "#00d4ff",
    qbtTag: null,
    sortOrder: 0,
    joinedAt: null,
    remoteUserId: null,
    platformMeta: null,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    latestStats: {
      ratio: 2.5,
      uploadedBytes: "1073741824", // 1 GiB
      downloadedBytes: "536870912", // 0.5 GiB
      seedingCount: 10,
      leechingCount: 2,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
      username: "user",
      group: null,
    },
    ...overrides,
  }
}

function makeRegistryEntry(overrides: Partial<TrackerRegistryEntry> = {}): TrackerRegistryEntry {
  return {
    slug: "aither",
    name: "Aither",
    url: "https://aither.cc",
    description: "Test tracker",
    platform: "unit3d",
    apiPath: "/api/user",
    specialty: "General",
    contentCategories: [],
    userClasses: [],
    releaseGroups: [],
    notableMembers: [],
    rules: { minimumRatio: 0.4, seedTimeHours: 72, loginIntervalDays: 90 },
    color: "#00d4ff",
    ...overrides,
  }
}

// Reset the findRegistryEntry mock before each test in computeAlerts suite


const makeSnapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  polledAt: new Date().toISOString(),
  uploadedBytes: "1000",
  downloadedBytes: "500",
  ratio: 2.0,
  bufferBytes: "500",
  seedbonus: null,
  seedingCount: 10,
  leechingCount: 1,
  hitAndRuns: null,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  shareScore: null,
  username: "testuser",
  group: "User",
  ...overrides,
})

// ---------------------------------------------------------------------------
// computeAggregateStats
// ---------------------------------------------------------------------------

describe("computeAggregateStats", () => {
  it("returns zero stats for empty array", () => {
    const result = computeAggregateStats([])
    expect(result.totalUploaded).toBe("0")
    expect(result.totalDownloaded).toBe("0")
    expect(result.totalBuffer).toBe("0")
    expect(result.avgRatio).toBeNull()
    expect(result.totalSeeding).toBe(0)
    expect(result.totalLeeching).toBe(0)
  })

  it("sums uploaded and downloaded bytes across multiple trackers", () => {
    const trackers = [
      makeTracker({
        id: 1,
        latestStats: {
          ratio: 2.0,
          uploadedBytes: "2000000000", // 2 GB
          downloadedBytes: "1000000000", // 1 GB
          seedingCount: 5,
          leechingCount: 1,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "user",
          group: null,
        },
      }),
      makeTracker({
        id: 2,
        latestStats: {
          ratio: 1.5,
          uploadedBytes: "3000000000", // 3 GB
          downloadedBytes: "2000000000", // 2 GB
          seedingCount: 10,
          leechingCount: 3,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "user2",
          group: null,
        },
      }),
    ]
    const result = computeAggregateStats(trackers)
    expect(result.totalUploaded).toBe("5000000000")
    expect(result.totalDownloaded).toBe("3000000000")
    expect(result.totalBuffer).toBe("2000000000")
    expect(result.totalSeeding).toBe(15)
    expect(result.totalLeeching).toBe(4)
  })

  it("computes weighted average ratio (totalUploaded / totalDownloaded)", () => {
    const trackers = [
      makeTracker({
        id: 1,
        latestStats: {
          ratio: 4.0,
          uploadedBytes: "4000000000",
          downloadedBytes: "1000000000",
          seedingCount: 0,
          leechingCount: 0,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "user",
          group: null,
        },
      }),
      makeTracker({
        id: 2,
        latestStats: {
          ratio: 1.0,
          uploadedBytes: "1000000000",
          downloadedBytes: "1000000000",
          seedingCount: 0,
          leechingCount: 0,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "user2",
          group: null,
        },
      }),
    ]
    const result = computeAggregateStats(trackers)
    // totalUploaded = 5000000000, totalDownloaded = 2000000000 → ratio = 2.5
    expect(result.avgRatio).toBeCloseTo(2.5)
  })

  it("returns null avgRatio when totalDownloaded is zero", () => {
    const trackers = [
      makeTracker({
        latestStats: {
          ratio: null,
          uploadedBytes: "1000000000",
          downloadedBytes: "0",
          seedingCount: 0,
          leechingCount: 0,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "user",
          group: null,
        },
      }),
    ]
    const result = computeAggregateStats(trackers)
    expect(result.avgRatio).toBeNull()
  })

  it("skips trackers with null latestStats", () => {
    const trackers = [
      makeTracker({
        id: 1,
        latestStats: {
          ratio: 2.0,
          uploadedBytes: "1000000000",
          downloadedBytes: "500000000",
          seedingCount: 5,
          leechingCount: 1,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "user",
          group: null,
        },
      }),
      makeTracker({
        id: 2,
        latestStats: null,
      }),
    ]
    const result = computeAggregateStats(trackers)
    expect(result.totalUploaded).toBe("1000000000")
    expect(result.totalDownloaded).toBe("500000000")
    expect(result.totalSeeding).toBe(5)
    expect(result.totalLeeching).toBe(1)
  })

  it("handles null uploadedBytes/downloadedBytes within latestStats (treats as zero)", () => {
    const trackers = [
      makeTracker({
        latestStats: {
          ratio: null,
          uploadedBytes: null,
          downloadedBytes: null,
          seedingCount: 3,
          leechingCount: 1,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "user",
          group: null,
        },
      }),
    ]
    const result = computeAggregateStats(trackers)
    expect(result.totalUploaded).toBe("0")
    expect(result.totalDownloaded).toBe("0")
    expect(result.totalSeeding).toBe(3)
    expect(result.totalLeeching).toBe(1)
  })

  it("handles null seedingCount/leechingCount (treats as zero)", () => {
    const trackers = [
      makeTracker({
        latestStats: {
          ratio: 1.0,
          uploadedBytes: "500000000",
          downloadedBytes: "500000000",
          seedingCount: null,
          leechingCount: null,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "user",
          group: null,
        },
      }),
    ]
    const result = computeAggregateStats(trackers)
    expect(result.totalSeeding).toBe(0)
    expect(result.totalLeeching).toBe(0)
  })

  it("handles negative buffer when downloaded exceeds uploaded", () => {
    const t = makeTracker({
      latestStats: {
        ratio: 0.5,
        uploadedBytes: "500",
        downloadedBytes: "1000",
        seedingCount: 0,
        leechingCount: 0,
        requiredRatio: null,
        warned: null,
        freeleechTokens: null,
        username: "a",
        group: "User",
      },
    })
    const result = computeAggregateStats([t])
    expect(result.totalBuffer).toBe("-500")
  })
})

// ---------------------------------------------------------------------------
// computeAlerts
// ---------------------------------------------------------------------------

describe("computeAlerts", () => {
  beforeEach(() => {
    mockFindRegistryEntry.mockReset()
  })

  it("returns no alerts for a healthy tracker", () => {
    mockFindRegistryEntry.mockReturnValue(makeRegistryEntry({ rules: { minimumRatio: 0.4, seedTimeHours: 72, loginIntervalDays: 90 } }))
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      lastError: null,
      lastPolledAt: new Date().toISOString(),
      latestStats: { ratio: 2.5, uploadedBytes: "1000", downloadedBytes: "400", seedingCount: 5, leechingCount: 1, requiredRatio: null, warned: null, freeleechTokens: null, username: "u", group: null },
    })
    const alerts = computeAlerts([tracker])
    expect(alerts).toHaveLength(0)
  })

  it("generates an error alert when lastError is set", () => {
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      lastError: "Connection refused",
      lastPolledAt: new Date().toISOString(),
    })
    const alerts = computeAlerts([tracker])
    const errorAlert = alerts.find((a) => a.type === "error")
    expect(errorAlert).toBeDefined()
    expect(errorAlert?.trackerId).toBe(1)
    expect(errorAlert?.trackerName).toBe("Aither")
    expect(errorAlert?.trackerColor).toBe("#00d4ff")
    expect(errorAlert?.key).toContain("error-1")
    expect(errorAlert?.message).toContain("Connection refused")
  })

  it("includes error snippet in key so re-appearance happens on new errors", () => {
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      lastError: "Timeout occurred",
    })
    const alerts = computeAlerts([tracker])
    const errorAlert = alerts.find((a) => a.type === "error")
    expect(errorAlert?.key).toContain("Timeout")
  })

  it("generates a ratio-danger alert when ratio is below minimumRatio", () => {
    mockFindRegistryEntry.mockReturnValue(makeRegistryEntry({ rules: { minimumRatio: 0.4, seedTimeHours: 72, loginIntervalDays: 90 } }))
    const tracker = makeTracker({
      id: 2,
      name: "OnlyEncodes",
      lastError: null,
      lastPolledAt: new Date().toISOString(),
      latestStats: {
        ratio: 0.3,
        uploadedBytes: "300",
        downloadedBytes: "1000",
        seedingCount: 1,
        leechingCount: 0,
        requiredRatio: null,
        warned: null,
        freeleechTokens: null,
        username: "u",
        group: null,
      },
    })
    const alerts = computeAlerts([tracker])
    const ratioAlert = alerts.find((a) => a.type === "ratio-danger")
    expect(ratioAlert).toBeDefined()
    expect(ratioAlert?.trackerId).toBe(2)
    expect(ratioAlert?.key).toBe("ratio-danger-2")
    expect(ratioAlert?.message).toContain("0.4")
    expect(ratioAlert?.trackerColor).toBe("#00d4ff")
  })

  it("does not generate ratio-danger alert when ratio meets minimumRatio", () => {
    mockFindRegistryEntry.mockReturnValue(makeRegistryEntry({ rules: { minimumRatio: 0.4, seedTimeHours: 72, loginIntervalDays: 90 } }))
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      lastError: null,
      latestStats: {
        ratio: 0.5,
        uploadedBytes: "500",
        downloadedBytes: "1000",
        seedingCount: 1,
        leechingCount: 0,
        requiredRatio: null,
        warned: null,
        freeleechTokens: null,
        username: "u",
        group: null,
      },
    })
    const alerts = computeAlerts([tracker])
    expect(alerts.find((a) => a.type === "ratio-danger")).toBeUndefined()
  })

  it("looks up registry by baseUrl not name", () => {
    mockFindRegistryEntry.mockReturnValue(makeRegistryEntry({ rules: { minimumRatio: 0.4, seedTimeHours: 72, loginIntervalDays: 90 } }))
    const tracker = makeTracker({
      id: 1,
      name: "My Custom Name", // user renamed — should still match via baseUrl
      baseUrl: "https://aither.cc",
      lastError: null,
      latestStats: { ratio: 0.2, uploadedBytes: "200", downloadedBytes: "1000", seedingCount: 1, leechingCount: 0, requiredRatio: null, warned: null, freeleechTokens: null, username: "u", group: null },
    })
    const alerts = computeAlerts([tracker])
    expect(mockFindRegistryEntry).toHaveBeenCalledWith("https://aither.cc")
    expect(alerts.find((a) => a.type === "ratio-danger")).toBeDefined()
  })

  it("generates a stale-data alert when lastPolledAt is older than 2 hours", () => {
    const staleTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      lastPolledAt: staleTime,
      lastError: null,
      latestStats: { ratio: 2.0, uploadedBytes: "1000", downloadedBytes: "500", seedingCount: 5, leechingCount: 1, requiredRatio: null, warned: null, freeleechTokens: null, username: "u", group: null },
    })
    const alerts = computeAlerts([tracker])
    const staleAlert = alerts.find((a) => a.type === "stale-data")
    expect(staleAlert).toBeDefined()
    expect(staleAlert?.key).toBe("stale-data-1")
    expect(staleAlert?.trackerColor).toBe("#00d4ff")
    expect(staleAlert?.message).toContain("Last polled")
  })

  it("does not generate stale-data alert when recently polled", () => {
    const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 min ago
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      lastPolledAt: recentTime,
      lastError: null,
    })
    const alerts = computeAlerts([tracker])
    expect(alerts.find((a) => a.type === "stale-data")).toBeUndefined()
  })

  it("does not generate stale-data alert when lastPolledAt is null", () => {
    const tracker = makeTracker({
      id: 1,
      lastPolledAt: null,
      lastError: null,
    })
    const alerts = computeAlerts([tracker])
    expect(alerts.find((a) => a.type === "stale-data")).toBeUndefined()
  })

  it("generates a zero-seeding alert when seedingCount is 0", () => {
    const tracker = makeTracker({
      id: 3,
      name: "Blutopia",
      lastError: null,
      lastPolledAt: new Date().toISOString(),
      isActive: true,
      latestStats: {
        ratio: 5.0,
        uploadedBytes: "5000",
        downloadedBytes: "1000",
        seedingCount: 0,
        leechingCount: 0,
        requiredRatio: null,
        warned: null,
        freeleechTokens: null,
        username: "u",
        group: null,
      },
    })
    const alerts = computeAlerts([tracker])
    const seedAlert = alerts.find((a) => a.type === "zero-seeding")
    expect(seedAlert).toBeDefined()
    expect(seedAlert?.trackerId).toBe(3)
    expect(seedAlert?.key).toBe("zero-seeding-3")
    expect(seedAlert?.message).toContain("0 torrents")
  })

  it("does not generate zero-seeding alert when seedingCount is positive", () => {
    const tracker = makeTracker({
      id: 1,
      lastError: null,
      isActive: true,
      latestStats: {
        ratio: 2.5,
        uploadedBytes: "1000",
        downloadedBytes: "400",
        seedingCount: 5,
        leechingCount: 1,
        requiredRatio: null,
        warned: null,
        freeleechTokens: null,
        username: "u",
        group: null,
      },
    })
    const alerts = computeAlerts([tracker])
    expect(alerts.find((a) => a.type === "zero-seeding")).toBeUndefined()
  })

  it("does not generate zero-seeding alert when seedingCount is null", () => {
    const tracker = makeTracker({
      id: 1,
      lastError: null,
      isActive: true,
      latestStats: {
        ratio: 2.0,
        uploadedBytes: "1000",
        downloadedBytes: "500",
        seedingCount: null,
        leechingCount: null,
        requiredRatio: null,
        warned: null,
        freeleechTokens: null,
        username: "u",
        group: null,
      },
    })
    const alerts = computeAlerts([tracker])
    expect(alerts.find((a) => a.type === "zero-seeding")).toBeUndefined()
  })

  it("does not generate zero-seeding alert for inactive trackers", () => {
    const tracker = makeTracker({
      id: 1,
      lastError: null,
      isActive: false,
      latestStats: {
        ratio: 2.0,
        uploadedBytes: "1000",
        downloadedBytes: "500",
        seedingCount: 0,
        leechingCount: 0,
        requiredRatio: null,
        warned: null,
        freeleechTokens: null,
        username: "u",
        group: null,
      },
    })
    const alerts = computeAlerts([tracker])
    expect(alerts.find((a) => a.type === "zero-seeding")).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// localStorage dismissal helpers
// ---------------------------------------------------------------------------

describe("getDismissedAlerts / dismissAlert / clearDismissedAlerts", () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    for (const key in store) delete store[key]
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("returns empty set when nothing has been dismissed", () => {
    const dismissed = getDismissedAlerts()
    expect(dismissed.size).toBe(0)
  })

  it("dismissAlert persists a key and getDismissedAlerts returns it", () => {
    dismissAlert("error-1-Timeout")
    const dismissed = getDismissedAlerts()
    expect(dismissed.has("error-1-Timeout")).toBe(true)
  })

  it("dismissing multiple keys keeps all of them", () => {
    dismissAlert("error-1-foo")
    dismissAlert("ratio-danger-2")
    dismissAlert("stale-data-3")
    const dismissed = getDismissedAlerts()
    expect(dismissed.size).toBe(3)
    expect(dismissed.has("ratio-danger-2")).toBe(true)
  })

  it("clearDismissedAlerts removes all dismissed keys", () => {
    dismissAlert("error-1-foo")
    dismissAlert("ratio-danger-2")
    clearDismissedAlerts()
    const dismissed = getDismissedAlerts()
    expect(dismissed.size).toBe(0)
  })

  it("getDismissedAlerts returns empty set when localStorage throws (SSR safety)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("localStorage unavailable") },
      setItem: () => {},
      removeItem: () => {},
    })
    const dismissed = getDismissedAlerts()
    expect(dismissed.size).toBe(0)
  })

  it("dismissAlert silently fails when localStorage throws (SSR safety)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => { throw new Error("localStorage unavailable") },
      removeItem: () => {},
    })
    expect(() => dismissAlert("some-key")).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// detectRankChanges
// ---------------------------------------------------------------------------

describe("detectRankChanges", () => {
  it("returns empty array when no rank changes", () => {
    const tracker = makeTracker({ id: 1 })
    const snapshots: Snapshot[] = [
      makeSnapshot({ group: "User", polledAt: new Date().toISOString() }),
      makeSnapshot({ group: "User", polledAt: new Date().toISOString() }),
    ]
    const map = new Map([[1, snapshots]])
    const result = detectRankChanges([tracker], map)
    expect(result).toEqual([])
  })

  it("detects a recent rank change", () => {
    const tracker = makeTracker({ id: 1, name: "TestTracker", color: "#ff0000" })
    const snapshots: Snapshot[] = [
      makeSnapshot({ group: "User", polledAt: new Date(Date.now() - 3600_000).toISOString() }),
      makeSnapshot({ group: "Power User", polledAt: new Date().toISOString() }),
    ]
    const map = new Map([[1, snapshots]])
    const result = detectRankChanges([tracker], map)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("rank-change")
    expect(result[0].message).toContain("User → Power User")
    expect(result[0].key).toBe("rank-change-1-Power User")
  })

  it("ignores rank changes older than freshness window", () => {
    const tracker = makeTracker({ id: 1 })
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
    const snapshots: Snapshot[] = [
      makeSnapshot({ group: "User", polledAt: oldDate }),
      makeSnapshot({ group: "Power User", polledAt: oldDate }),
    ]
    const map = new Map([[1, snapshots]])
    const result = detectRankChanges([tracker], map, 7)
    expect(result).toEqual([])
  })

  it("only reports the most recent rank change per tracker", () => {
    const tracker = makeTracker({ id: 1 })
    const now = Date.now()
    const snapshots: Snapshot[] = [
      makeSnapshot({ group: "User", polledAt: new Date(now - 7200_000).toISOString() }),
      makeSnapshot({ group: "Power User", polledAt: new Date(now - 3600_000).toISOString() }),
      makeSnapshot({ group: "Elite", polledAt: new Date(now).toISOString() }),
    ]
    const map = new Map([[1, snapshots]])
    const result = detectRankChanges([tracker], map)
    expect(result).toHaveLength(1)
    expect(result[0].message).toContain("Power User → Elite")
  })
})
