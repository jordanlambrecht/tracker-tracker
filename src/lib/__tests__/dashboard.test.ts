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
  computeAggregateStats,
  computeAlerts,
  computeSystemAlerts,
  deleteAllDismissed,
  detectRankChanges,
  fetchDismissedKeys,
  getAnniversaryMilestone,
  postDismissAlert,
} from "@/lib/dashboard"
import { getTrackerHealth } from "@/lib/tracker-status"

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
    consecutiveFailures: 0,
    pausedAt: null,
    color: "#00d4ff",
    qbtTag: null,
    sortOrder: 0,
    joinedAt: null,
    lastAccessAt: null,
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
    mockFindRegistryEntry.mockReturnValue(
      makeRegistryEntry({ rules: { minimumRatio: 0.4, seedTimeHours: 72, loginIntervalDays: 90 } })
    )
    const tracker = makeTracker({
      id: 1,
      name: "Aither",
      lastError: null,
      lastPolledAt: new Date().toISOString(),
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
    mockFindRegistryEntry.mockReturnValue(
      makeRegistryEntry({ rules: { minimumRatio: 0.4, seedTimeHours: 72, loginIntervalDays: 90 } })
    )
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
    mockFindRegistryEntry.mockReturnValue(
      makeRegistryEntry({ rules: { minimumRatio: 0.4, seedTimeHours: 72, loginIntervalDays: 90 } })
    )
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
    mockFindRegistryEntry.mockReturnValue(
      makeRegistryEntry({ rules: { minimumRatio: 0.4, seedTimeHours: 72, loginIntervalDays: 90 } })
    )
    const tracker = makeTracker({
      id: 1,
      name: "My Custom Name", // user renamed — should still match via baseUrl
      baseUrl: "https://aither.cc",
      lastError: null,
      latestStats: {
        ratio: 0.2,
        uploadedBytes: "200",
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
      latestStats: {
        ratio: 2.0,
        uploadedBytes: "1000",
        downloadedBytes: "500",
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

  it("generates poll-paused alert when pausedAt is set", () => {
    const trackers = [
      makeTracker({
        pausedAt: "2026-03-17T00:00:00Z",
        consecutiveFailures: 4,
        lastError: "Bad API key",
      }),
    ]
    const alerts = computeAlerts(trackers)
    const paused = alerts.find((a) => a.type === "poll-paused")
    expect(paused).toBeDefined()
    expect(paused?.dismissible).toBe(false)
    expect(paused?.message).toContain("Polling paused after repeated failures")
  })

  it("suppresses error alert when tracker is paused", () => {
    const trackers = [
      makeTracker({
        pausedAt: "2026-03-17T00:00:00Z",
        consecutiveFailures: 4,
        lastError: "Bad API key",
      }),
    ]
    const alerts = computeAlerts(trackers)
    const errorAlerts = alerts.filter((a) => a.type === "error")
    expect(errorAlerts).toHaveLength(0)
  })

  it("suppresses stale-data alert when tracker is paused", () => {
    const staleDate = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const trackers = [
      makeTracker({
        pausedAt: "2026-03-17T00:00:00Z",
        consecutiveFailures: 4,
        lastPolledAt: staleDate,
      }),
    ]
    const alerts = computeAlerts(trackers)
    const staleAlerts = alerts.filter((a) => a.type === "stale-data")
    expect(staleAlerts).toHaveLength(0)
  })

  it("still fires error alert when tracker is not paused", () => {
    const trackers = [
      makeTracker({
        lastError: "Connection refused",
        pausedAt: null,
        consecutiveFailures: 1,
      }),
    ]
    const alerts = computeAlerts(trackers)
    expect(alerts.find((a) => a.type === "error")).toBeDefined()
    expect(alerts.find((a) => a.type === "poll-paused")).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// API dismissal helpers
// ---------------------------------------------------------------------------

describe("fetchDismissedKeys / postDismissAlert / deleteAllDismissed", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fetchDismissedKeys returns a Set of keys from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ keys: ["error-1-Timeout", "ratio-danger-2"] }),
      })
    )
    const dismissed = await fetchDismissedKeys()
    expect(dismissed.size).toBe(2)
    expect(dismissed.has("error-1-Timeout")).toBe(true)
    expect(dismissed.has("ratio-danger-2")).toBe(true)
  })

  it("fetchDismissedKeys returns empty set when response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    const dismissed = await fetchDismissedKeys()
    expect(dismissed.size).toBe(0)
  })

  it("fetchDismissedKeys returns empty set when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")))
    const dismissed = await fetchDismissedKeys()
    expect(dismissed.size).toBe(0)
  })

  it("postDismissAlert sends POST with key and type", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", mockFetch)
    await postDismissAlert("error-1-Timeout", "error")
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/alerts/dismissed",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "error-1-Timeout", type: "error" }),
      })
    )
  })

  it("postDismissAlert silently swallows fetch errors (best-effort)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")))
    await expect(postDismissAlert("some-key", "error")).resolves.toBeUndefined()
  })

  it("deleteAllDismissed sends DELETE request", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", mockFetch)
    await deleteAllDismissed()
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/alerts/dismissed",
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("deleteAllDismissed silently swallows fetch errors (best-effort)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")))
    await expect(deleteAllDismissed()).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// computeSystemAlerts
// ---------------------------------------------------------------------------

describe("computeSystemAlerts", () => {
  it("returns empty array when no conditions are met", () => {
    const result = computeSystemAlerts({
      currentVersion: "1.0.0",
      failedBackups: [],
      clients: [],
    })
    expect(result).toHaveLength(0)
  })

  it("generates update-available alert when versions differ", () => {
    const result = computeSystemAlerts({
      latestVersion: "1.1.0",
      currentVersion: "1.0.0",
      failedBackups: [],
      clients: [],
    })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("update-available")
    expect(result[0].key).toBe("update-available-1.1.0")
    expect(result[0].trackerId).toBeNull()
    expect(result[0].trackerName).toBe("System")
    expect(result[0].message).toContain("1.1.0")
    expect(result[0].message).toContain("1.0.0")
    expect(result[0].dismissible).toBe(true)
  })

  it("does not generate update-available alert when versions match", () => {
    const result = computeSystemAlerts({
      latestVersion: "1.0.0",
      currentVersion: "1.0.0",
      failedBackups: [],
      clients: [],
    })
    expect(result.find((a) => a.type === "update-available")).toBeUndefined()
  })

  it("does not generate update-available alert when latestVersion is absent", () => {
    const result = computeSystemAlerts({
      currentVersion: "1.0.0",
      failedBackups: [],
      clients: [],
    })
    expect(result.find((a) => a.type === "update-available")).toBeUndefined()
  })

  it("generates backup-failed alert from the most recent failed backup", () => {
    const createdAt = "2026-01-15T03:00:00.000Z"
    const result = computeSystemAlerts({
      currentVersion: "1.0.0",
      failedBackups: [{ createdAt }, { createdAt: "2026-01-14T03:00:00.000Z" }],
      clients: [],
    })
    const backupAlert = result.find((a) => a.type === "backup-failed")
    expect(backupAlert).toBeDefined()
    expect(backupAlert?.key).toBe(`backup-failed-${createdAt}`)
    expect(backupAlert?.trackerId).toBeNull()
    expect(backupAlert?.trackerName).toBe("Backups")
    expect(backupAlert?.timestamp).toBe(createdAt)
    expect(backupAlert?.dismissible).toBe(true)
  })

  it("generates client-error alerts for enabled clients with errors", () => {
    const result = computeSystemAlerts({
      currentVersion: "1.0.0",
      failedBackups: [],
      clients: [
        { id: 1, name: "qBittorrent", enabled: true, lastError: "Connection refused" },
        { id: 2, name: "Deluge", enabled: false, lastError: "Timed out" },
        { id: 3, name: "Transmission", enabled: true, lastError: null },
      ],
    })
    expect(result).toHaveLength(1)
    const clientAlert = result[0]
    expect(clientAlert.type).toBe("client-error")
    expect(clientAlert.key).toBe("client-error-1")
    expect(clientAlert.trackerId).toBeNull()
    expect(clientAlert.trackerName).toBe("qBittorrent")
    expect(clientAlert.message).toBe("Connection refused")
    expect(clientAlert.dismissible).toBe(false)
  })

  it("client-error alerts are non-dismissible", () => {
    const result = computeSystemAlerts({
      currentVersion: "1.0.0",
      failedBackups: [],
      clients: [{ id: 5, name: "Client", enabled: true, lastError: "Unreachable" }],
    })
    expect(result[0].dismissible).toBe(false)
  })

  it("generates all three alert types together", () => {
    const result = computeSystemAlerts({
      latestVersion: "2.0.0",
      currentVersion: "1.0.0",
      failedBackups: [{ createdAt: "2026-01-15T03:00:00.000Z" }],
      clients: [{ id: 1, name: "qBt", enabled: true, lastError: "Unreachable" }],
    })
    expect(result).toHaveLength(3)
    expect(result.map((a) => a.type)).toEqual(
      expect.arrayContaining(["update-available", "backup-failed", "client-error"])
    )
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

// ---------------------------------------------------------------------------
// getAnniversaryMilestone
// ---------------------------------------------------------------------------

describe("getAnniversaryMilestone", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns 1 month anniversary on exact date", () => {
    vi.setSystemTime(new Date("2026-04-15"))
    expect(getAnniversaryMilestone("2026-03-15")).toEqual({ label: "1 month anniversary" })
  })

  it("returns 6 month anniversary on exact date", () => {
    vi.setSystemTime(new Date("2026-09-15"))
    expect(getAnniversaryMilestone("2026-03-15")).toEqual({ label: "6 month anniversary" })
  })

  it("returns 1 year anniversary on exact date", () => {
    vi.setSystemTime(new Date("2027-03-15"))
    expect(getAnniversaryMilestone("2026-03-15")).toEqual({ label: "1 year anniversary" })
  })

  it("returns multi-year anniversary", () => {
    vi.setSystemTime(new Date("2031-03-15"))
    expect(getAnniversaryMilestone("2026-03-15")).toEqual({ label: "5 year anniversary" })
  })

  it("matches within the ±3 day window", () => {
    vi.setSystemTime(new Date("2027-03-13")) // 2 days before 1yr anniversary
    expect(getAnniversaryMilestone("2026-03-15")).toEqual({ label: "1 year anniversary" })
  })

  it("does not match outside the ±3 day window", () => {
    vi.setSystemTime(new Date("2027-03-10")) // 5 days before 1yr anniversary
    expect(getAnniversaryMilestone("2026-03-15")).toBeNull()
  })

  it("returns null for dates not near any milestone", () => {
    vi.setSystemTime(new Date("2026-08-01")) // ~4.5 months in, no milestone nearby
    expect(getAnniversaryMilestone("2026-03-15")).toBeNull()
  })

  it("returns null for invalid date string", () => {
    expect(getAnniversaryMilestone("not-a-date")).toBeNull()
  })

  it("prefers 1 month over 1 year when both could match", () => {
    // Edge case: 1 month anniversary checked before annual milestones
    vi.setSystemTime(new Date("2026-04-15"))
    const result = getAnniversaryMilestone("2026-03-15")
    expect(result?.label).toBe("1 month anniversary")
  })

  it("generates anniversary alert in computeAlerts", () => {
    vi.setSystemTime(new Date("2027-06-10"))
    const tracker = makeTracker({ joinedAt: "2026-06-10" })
    const alerts = computeAlerts([tracker])
    const anniversary = alerts.find((a) => a.type === "anniversary")
    expect(anniversary).toBeDefined()
    expect(anniversary?.message).toBe("1 year anniversary")
  })

  it("does not generate anniversary alert without joinedAt", () => {
    vi.setSystemTime(new Date("2027-06-10"))
    const tracker = makeTracker({ joinedAt: null })
    const alerts = computeAlerts([tracker])
    expect(alerts.find((a) => a.type === "anniversary")).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getTrackerHealth
// ---------------------------------------------------------------------------

describe("getTrackerHealth", () => {
  it("returns paused when pausedAt is set", () => {
    const health = getTrackerHealth(makeTracker({ pausedAt: "2026-03-17T00:00:00Z" }))
    expect(health).toBe("paused")
  })

  it("paused takes priority over error", () => {
    const health = getTrackerHealth(
      makeTracker({ pausedAt: "2026-03-17T00:00:00Z", lastError: "Bad key" })
    )
    expect(health).toBe("paused")
  })

  it("paused takes priority over healthy stats", () => {
    const health = getTrackerHealth(
      makeTracker({
        pausedAt: "2026-03-17T00:00:00Z",
        latestStats: {
          ratio: 5.0,
          uploadedBytes: "5000",
          downloadedBytes: "1000",
          seedingCount: 10,
          leechingCount: 0,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "u",
          group: null,
        },
      })
    )
    expect(health).toBe("paused")
  })

  it("returns error when lastError is set and not paused", () => {
    const health = getTrackerHealth(
      makeTracker({ pausedAt: null, lastError: "Connection refused" })
    )
    expect(health).toBe("error")
  })

  it("returns offline when no latestStats and not paused or error", () => {
    const health = getTrackerHealth(
      makeTracker({ pausedAt: null, lastError: null, latestStats: null })
    )
    expect(health).toBe("offline")
  })

  it("returns healthy when ratio >= 2 and seeding > 0", () => {
    const health = getTrackerHealth(
      makeTracker({
        pausedAt: null,
        lastError: null,
        latestStats: {
          ratio: 3.0,
          uploadedBytes: "3000",
          downloadedBytes: "1000",
          seedingCount: 5,
          leechingCount: 0,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "u",
          group: null,
        },
      })
    )
    expect(health).toBe("healthy")
  })

  it("returns critical when ratio < 1", () => {
    const health = getTrackerHealth(
      makeTracker({
        pausedAt: null,
        lastError: null,
        latestStats: {
          ratio: 0.3,
          uploadedBytes: "300",
          downloadedBytes: "1000",
          seedingCount: 2,
          leechingCount: 0,
          requiredRatio: null,
          warned: null,
          freeleechTokens: null,
          username: "u",
          group: null,
        },
      })
    )
    expect(health).toBe("critical")
  })
})
