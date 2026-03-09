// src/lib/__tests__/dashboard.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import type { TrackerSummary } from "@/types/api"
import {
  clearDismissedAlerts,
  computeAggregateStats,
  computeAlerts,
  dismissAlert,
  getDismissedAlerts,
} from "../dashboard"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Aither",
    baseUrl: "https://aither.cc",
    platformType: "unit3d",
    pollIntervalMinutes: 60,
    isActive: true,
    lastPolledAt: new Date().toISOString(),
    lastError: null,
    color: "#00d4ff",
    qbtTag: null,
    sortOrder: 0,
    joinedAt: null,
    createdAt: new Date().toISOString(),
    latestStats: {
      ratio: 2.5,
      uploadedBytes: "1073741824", // 1 GiB
      downloadedBytes: "536870912", // 0.5 GiB
      seedingCount: 10,
      leechingCount: 2,
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
    rules: { minimumRatio: "0.4" },
    color: "#00d4ff",
    ...overrides,
  }
}

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
          username: "user",
          group: null,
        },
      }),
    ]
    const result = computeAggregateStats(trackers)
    expect(result.totalSeeding).toBe(0)
    expect(result.totalLeeching).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeAlerts
// ---------------------------------------------------------------------------

describe("computeAlerts", () => {
  it("returns no alerts for a healthy tracker", () => {
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      lastError: null,
      lastPolledAt: new Date().toISOString(),
      pollIntervalMinutes: 60,
      latestStats: { ratio: 2.5, uploadedBytes: "1000", downloadedBytes: "400", seedingCount: 5, leechingCount: 1, username: "u", group: null },
    })
    const registry = [makeRegistryEntry({ name: "Aither", rules: { minimumRatio: "0.4" } })]
    const alerts = computeAlerts([tracker], registry)
    expect(alerts).toHaveLength(0)
  })

  it("generates an error alert when lastError is set", () => {
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      lastError: "Connection refused",
      lastPolledAt: new Date().toISOString(),
    })
    const alerts = computeAlerts([tracker], [])
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
    const alerts = computeAlerts([tracker], [])
    const errorAlert = alerts.find((a) => a.type === "error")
    expect(errorAlert?.key).toContain("Timeout")
  })

  it("generates a ratio-danger alert when ratio is below minimumRatio", () => {
    const tracker = makeTracker({
      id: 2,
      name: "OnlyEncodes",
      lastError: null,
      lastPolledAt: new Date().toISOString(),
      pollIntervalMinutes: 60,
      latestStats: {
        ratio: 0.3,
        uploadedBytes: "300",
        downloadedBytes: "1000",
        seedingCount: 1,
        leechingCount: 0,
        username: "u",
        group: null,
      },
    })
    const registry = [makeRegistryEntry({ name: "OnlyEncodes", rules: { minimumRatio: "0.4" } })]
    const alerts = computeAlerts([tracker], registry)
    const ratioAlert = alerts.find((a) => a.type === "ratio-danger")
    expect(ratioAlert).toBeDefined()
    expect(ratioAlert?.trackerId).toBe(2)
    expect(ratioAlert?.key).toBe("ratio-danger-2")
    expect(ratioAlert?.message).toContain("0.4")
    expect(ratioAlert?.trackerColor).toBe("#00d4ff")
  })

  it("does not generate ratio-danger alert when ratio meets minimumRatio", () => {
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
        username: "u",
        group: null,
      },
    })
    const registry = [makeRegistryEntry({ name: "Aither", rules: { minimumRatio: "0.4" } })]
    const alerts = computeAlerts([tracker], registry)
    expect(alerts.find((a) => a.type === "ratio-danger")).toBeUndefined()
  })

  it("matches registry entry case-insensitively by name", () => {
    const tracker = makeTracker({
      id: 1,
      name: "aither", // lowercase
      lastError: null,
      latestStats: { ratio: 0.2, uploadedBytes: "200", downloadedBytes: "1000", seedingCount: 1, leechingCount: 0, username: "u", group: null },
    })
    const registry = [makeRegistryEntry({ name: "Aither", rules: { minimumRatio: "0.4" } })]
    const alerts = computeAlerts([tracker], registry)
    expect(alerts.find((a) => a.type === "ratio-danger")).toBeDefined()
  })

  it("generates a stale-data alert when lastPolledAt is older than 2x pollIntervalMinutes", () => {
    const staleTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      pollIntervalMinutes: 60, // threshold = 2 * 60 = 120 min
      lastPolledAt: staleTime,
      lastError: null,
      latestStats: { ratio: 2.0, uploadedBytes: "1000", downloadedBytes: "500", seedingCount: 5, leechingCount: 1, username: "u", group: null },
    })
    const alerts = computeAlerts([tracker], [])
    const staleAlert = alerts.find((a) => a.type === "stale-data")
    expect(staleAlert).toBeDefined()
    expect(staleAlert?.key).toBe("stale-data-1")
    expect(staleAlert?.trackerColor).toBe("#00d4ff")
    expect(staleAlert?.message).toContain("hour")
  })

  it("does not generate stale-data alert when recently polled", () => {
    const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 min ago
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      pollIntervalMinutes: 60, // threshold = 120 min
      lastPolledAt: recentTime,
      lastError: null,
    })
    const alerts = computeAlerts([tracker], [])
    expect(alerts.find((a) => a.type === "stale-data")).toBeUndefined()
  })

  it("does not generate stale-data alert when lastPolledAt is null", () => {
    const tracker = makeTracker({
      id: 1,
      lastPolledAt: null,
      lastError: null,
    })
    const alerts = computeAlerts([tracker], [])
    expect(alerts.find((a) => a.type === "stale-data")).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// localStorage dismissal helpers
// ---------------------------------------------------------------------------

describe("getDismissedAlerts / dismissAlert / clearDismissedAlerts", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
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
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage unavailable")
    })
    const dismissed = getDismissedAlerts()
    expect(dismissed.size).toBe(0)
  })

  it("dismissAlert silently fails when localStorage throws (SSR safety)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("localStorage unavailable")
    })
    expect(() => dismissAlert("some-key")).not.toThrow()
  })
})
