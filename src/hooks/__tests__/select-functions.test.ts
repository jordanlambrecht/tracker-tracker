// src/hooks/__tests__/select-functions.test.ts
//
// Tests for pure selector functions extracted from hooks and components:
//   selectClientIdName  (FleetDashboard.tsx)
//   selectMinPollInterval (usePollingIntervals.ts)
//   selectActiveTrackers  (useDashboardData.ts)
//   selectClientsForAlerts (useDashboardData.ts)
//
// These selectors are passed to TanStack Query's `select` option. They must be
// pure: same input always produces the same output, no side effects.

import { describe, expect, it } from "vitest"
import { selectClientIdName } from "@/components/dashboard/FleetDashboard"
import { selectActiveTrackers, selectClientsForAlerts } from "@/hooks/useDashboardData"
import { selectMinPollInterval } from "@/hooks/usePollingIntervals"
import type { SafeDownloadClient, TrackerSummary } from "@/types/api"

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeClient(overrides: Partial<SafeDownloadClient> = {}): SafeDownloadClient {
  return {
    id: 1,
    name: "Client A",
    type: "qbittorrent",
    enabled: true,
    host: "localhost",
    port: 8080,
    useSsl: false,
    hasCredentials: true,
    pollIntervalSeconds: 300,
    isDefault: false,
    crossSeedTags: [],
    lastPolledAt: null,
    lastError: null,
    errorSince: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Tracker A",
    baseUrl: "https://example.com",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: null,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#00d4ff",
    qbtTag: null,
    mouseholeUrl: null,
    hideUnreadBadges: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    isFavorite: false,
    sortOrder: null,
    joinedAt: null,
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: new Date().toISOString(),
    latestStats: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// selectClientIdName
// ---------------------------------------------------------------------------

describe("selectClientIdName", () => {
  it("returns only id and name from each item", () => {
    const input = [
      makeClient({ id: 1, name: "qBit Local" }),
      makeClient({ id: 2, name: "qBit Remote" }),
    ]
    const result = selectClientIdName(input)
    expect(result).toEqual([
      { id: 1, name: "qBit Local" },
      { id: 2, name: "qBit Remote" },
    ])
  })

  it("strips all fields except id and name", () => {
    const input = [
      makeClient({
        id: 11,
        name: "Only These",
        lastPolledAt: "2024-01-01T00:00:00.000Z",
        lastError: "boom",
      }),
    ]
    const result = selectClientIdName(input)
    expect(result[0]).toStrictEqual({ id: 11, name: "Only These" })
    expect(Object.keys(result[0])).toHaveLength(2)
  })

  it("returns empty array for empty input", () => {
    expect(selectClientIdName([])).toEqual([])
  })

  it("preserves order", () => {
    const input = [
      makeClient({ id: 3, name: "CCC" }),
      makeClient({ id: 1, name: "AAA" }),
      makeClient({ id: 2, name: "BBB" }),
    ]
    const ids = selectClientIdName(input).map((c) => c.id)
    expect(ids).toEqual([3, 1, 2])
  })
})

// ---------------------------------------------------------------------------
// selectMinPollInterval
// ---------------------------------------------------------------------------

describe("selectMinPollInterval", () => {
  it("returns null when client list is empty", () => {
    expect(selectMinPollInterval([])).toBeNull()
  })

  it("returns null when all clients are disabled", () => {
    const clients = [
      makeClient({ enabled: false, pollIntervalSeconds: 60 }),
      makeClient({ enabled: false, pollIntervalSeconds: 120 }),
    ]
    expect(selectMinPollInterval(clients)).toBeNull()
  })

  it("returns the pollIntervalSeconds of the single enabled client", () => {
    const clients = [makeClient({ enabled: true, pollIntervalSeconds: 180 })]
    expect(selectMinPollInterval(clients)).toBe(180)
  })

  it("returns the minimum pollIntervalSeconds across enabled clients", () => {
    const clients = [
      makeClient({ id: 1, enabled: true, pollIntervalSeconds: 300 }),
      makeClient({ id: 2, enabled: true, pollIntervalSeconds: 60 }),
      makeClient({ id: 3, enabled: true, pollIntervalSeconds: 120 }),
    ]
    expect(selectMinPollInterval(clients)).toBe(60)
  })

  it("ignores disabled clients when computing the minimum", () => {
    const clients = [
      makeClient({ id: 1, enabled: true, pollIntervalSeconds: 300 }),
      makeClient({ id: 2, enabled: false, pollIntervalSeconds: 10 }),
    ]
    // Disabled client has 10s but should be excluded.
    expect(selectMinPollInterval(clients)).toBe(300)
  })

  it("returns null when the only enabled client list is mixed with all disabled", () => {
    const clients = [makeClient({ id: 1, enabled: false, pollIntervalSeconds: 30 })]
    expect(selectMinPollInterval(clients)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// selectActiveTrackers
// ---------------------------------------------------------------------------

describe("selectActiveTrackers", () => {
  it("returns empty array when no trackers are active", () => {
    const trackers = [
      makeTracker({ id: 1, isActive: false }),
      makeTracker({ id: 2, isActive: false }),
    ]
    expect(selectActiveTrackers(trackers)).toEqual([])
  })

  it("returns all trackers when all are active", () => {
    const trackers = [
      makeTracker({ id: 1, isActive: true }),
      makeTracker({ id: 2, isActive: true }),
    ]
    const result = selectActiveTrackers(trackers)
    expect(result).toHaveLength(2)
    expect(result.map((t) => t.id)).toEqual([1, 2])
  })

  it("filters out inactive trackers", () => {
    const trackers = [
      makeTracker({ id: 1, isActive: true }),
      makeTracker({ id: 2, isActive: false }),
      makeTracker({ id: 3, isActive: true }),
    ]
    const result = selectActiveTrackers(trackers)
    expect(result.map((t) => t.id)).toEqual([1, 3])
  })

  it("returns empty array for empty input", () => {
    expect(selectActiveTrackers([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// selectClientsForAlerts
// ---------------------------------------------------------------------------

describe("selectClientsForAlerts", () => {
  it("narrows each client to only id, name, enabled, lastError", () => {
    const clients = [makeClient({ id: 1, name: "Local", enabled: true, lastError: null })]
    const result = selectClientsForAlerts(clients)
    expect(result[0]).toStrictEqual({ id: 1, name: "Local", enabled: true, lastError: null })
    expect(Object.keys(result[0])).toHaveLength(4)
  })

  it("strips all other fields (host, port, lastPolledAt, etc.)", () => {
    const clients = [
      makeClient({
        id: 2,
        name: "Remote",
        enabled: false,
        lastError: "connection refused",
        host: "192.168.1.100",
        port: 9090,
        lastPolledAt: "2024-01-01T00:00:00.000Z",
      }),
    ]
    const result = selectClientsForAlerts(clients)
    expect(result[0]).not.toHaveProperty("host")
    expect(result[0]).not.toHaveProperty("port")
    expect(result[0]).not.toHaveProperty("lastPolledAt")
    expect(result[0]).toStrictEqual({
      id: 2,
      name: "Remote",
      enabled: false,
      lastError: "connection refused",
    })
  })

  it("preserves lastError value when it is a non-null string", () => {
    const clients = [
      makeClient({ id: 3, name: "Errored", enabled: true, lastError: "auth failed" }),
    ]
    const result = selectClientsForAlerts(clients)
    expect(result[0].lastError).toBe("auth failed")
  })

  it("returns empty array for empty input", () => {
    expect(selectClientsForAlerts([])).toEqual([])
  })

  it("processes multiple clients and preserves order", () => {
    const clients = [
      makeClient({ id: 10, name: "AAA", enabled: true }),
      makeClient({ id: 20, name: "BBB", enabled: false }),
    ]
    const result = selectClientsForAlerts(clients)
    expect(result.map((c) => c.id)).toEqual([10, 20])
  })
})
