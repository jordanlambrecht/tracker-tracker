// src/lib/__tests__/sidebar-types.test.ts

import { describe, expect, it } from "vitest"
import { sortTrackers } from "@/lib/sidebar-types"
import type { TrackerSummary } from "@/types/api"

const base: TrackerSummary = {
  id: 1,
  name: "Alpha",
  baseUrl: "https://alpha.example.com",
  platformType: "unit3d",
  isActive: true,
  lastPolledAt: null,
  lastError: null,
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
}

function t(overrides: Partial<TrackerSummary>): TrackerSummary {
  return { ...base, ...overrides }
}

describe("sortTrackers", () => {
  const trackers = [
    t({ id: 1, name: "Charlie", sortOrder: 2 }),
    t({ id: 2, name: "Alpha", sortOrder: 0 }),
    t({ id: 3, name: "Bravo", sortOrder: 1 }),
  ]

  it("index mode preserves original array order", () => {
    const result = sortTrackers(trackers, "index")
    expect(result.map((r) => r.id)).toEqual([1, 2, 3])
  })

  it("alpha mode sorts by name", () => {
    const result = sortTrackers(trackers, "alpha")
    expect(result.map((r) => r.name)).toEqual(["Alpha", "Bravo", "Charlie"])
  })

  it("custom mode sorts by sortOrder", () => {
    const result = sortTrackers(trackers, "custom")
    expect(result.map((r) => r.name)).toEqual(["Alpha", "Bravo", "Charlie"])
  })

  it("custom mode puts null sortOrder at end", () => {
    const withNull = [
      t({ id: 1, name: "A", sortOrder: null }),
      t({ id: 2, name: "B", sortOrder: 0 }),
    ]
    const result = sortTrackers(withNull, "custom")
    expect(result.map((r) => r.name)).toEqual(["B", "A"])
  })

  it("does not mutate the input array", () => {
    const original = [...trackers]
    sortTrackers(trackers, "alpha")
    expect(trackers.map((r) => r.id)).toEqual(original.map((r) => r.id))
  })
})
