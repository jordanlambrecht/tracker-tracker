// src/lib/__tests__/tracker-status.test.ts
import { describe, expect, it } from "vitest"
import {
  getHealthBadgeVariant,
  getHealthDescription,
  getHealthLabel,
  getHealthPulseDot,
  getTrackerHealth,
} from "@/lib/tracker-status"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

function makeStats(overrides: Partial<TrackerLatestStats> = {}): TrackerLatestStats {
  return {
    ratio: 2.5,
    ratioIsInfinite: false,
    uploadedBytes: "1073741824",
    downloadedBytes: "536870912",
    seedingCount: 10,
    leechingCount: 2,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
    bufferBytes: null,
    hitAndRuns: null,
    seedbonus: null,
    shareScore: null,
    username: "user",
    group: null,
    ...overrides,
  }
}

function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Aither",
    baseUrl: "https://aither.cc",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: new Date().toISOString(),
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#00d4ff",
    qbtTag: null,
    mouseholeUrl: null,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: 0,
    joinedAt: null,
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: new Date().toISOString(),
    latestStats: makeStats(),
    ...overrides,
  }
}

const healthOf = (stats: Partial<TrackerLatestStats>) =>
  getTrackerHealth(makeTracker({ latestStats: makeStats(stats) }))

// ---------------------------------------------------------------------------
// The thin-ratio / zero-seed split
//
// These two conditions shared one "warning" pill until they were separated.
// The tests below pin each one alone, plus the precedence when they overlap.
// ---------------------------------------------------------------------------

describe("getTrackerHealth — thin ratio vs. zero seeds", () => {
  it("a thin ratio alone is 'warning'", () => {
    expect(healthOf({ ratio: 1.5, seedingCount: 8 })).toBe("warning")
  })

  it("includes the ratio band boundaries in 'warning'", () => {
    expect(healthOf({ ratio: 1.0, seedingCount: 8 })).toBe("warning")
    expect(healthOf({ ratio: 1.999, seedingCount: 8 })).toBe("warning")
    expect(healthOf({ ratio: 2.0, seedingCount: 8 })).toBe("healthy")
  })

  it("zero active seeds alone is 'no-seeds', even with a comfortable ratio", () => {
    expect(healthOf({ ratio: 9.9, seedingCount: 0 })).toBe("no-seeds")
  })

  it("zero active seeds wins when both conditions hold", () => {
    // The whole point of the split: a user in this state needs to start
    // seeding, which the ratio band alone would never tell them.
    expect(healthOf({ ratio: 1.5, seedingCount: 0 })).toBe("no-seeds")
  })

  it("an infinite ratio with zero seeds is still 'no-seeds'", () => {
    // ratioIsInfinite is the best possible ratio standing, and it still does
    // not imply anything is being seeded right now.
    expect(healthOf({ ratio: null, ratioIsInfinite: true, seedingCount: 0 })).toBe("no-seeds")
  })
})

describe("getTrackerHealth — precedence above 'no-seeds'", () => {
  it("keeps 'critical' when the ratio is below 1.0 and there are zero seeds", () => {
    // Ratio < 1.0 carries account-action risk that "No Seeds" would hide.
    expect(healthOf({ ratio: 0.4, seedingCount: 0 })).toBe("critical")
  })

  it("keeps 'critical' when the tracker has warned the account", () => {
    expect(healthOf({ ratio: 9.9, warned: true, seedingCount: 0 })).toBe("critical")
  })

  it("keeps 'error' over zero seeds", () => {
    const tracker = makeTracker({
      lastError: "Connection refused",
      latestStats: makeStats({ seedingCount: 0 }),
    })
    expect(getTrackerHealth(tracker)).toBe("error")
  })

  it("keeps 'paused' over zero seeds", () => {
    const tracker = makeTracker({
      pausedAt: "2026-03-17T00:00:00Z",
      latestStats: makeStats({ seedingCount: 0 }),
    })
    expect(getTrackerHealth(tracker)).toBe("paused")
  })
})

describe("getTrackerHealth — seedingCount the adapter does not report", () => {
  it("leaves a null seedingCount on its ratio status", () => {
    // BTN reports no seeding count at all; null must not read as "no seeds".
    expect(healthOf({ ratio: 3.0, seedingCount: null })).toBe("healthy")
    expect(healthOf({ ratio: 1.5, seedingCount: null })).toBe("warning")
  })
})

describe("health metadata", () => {
  it("gives 'no-seeds' its own label and description", () => {
    expect(getHealthLabel("no-seeds")).toBe("No Seeds")
    expect(getHealthDescription("no-seeds")).toBe("Zero active seeds — nothing is uploading")
  })

  it("narrows the 'warning' description to the ratio band only", () => {
    expect(getHealthDescription("warning")).toBe("Ratio 1.0–2.0 — thin buffer")
    expect(getHealthDescription("warning")).not.toContain("seeds")
  })

  it("renders 'no-seeds' more severely than 'warning'", () => {
    expect(getHealthBadgeVariant("no-seeds")).toBe("danger")
    expect(getHealthPulseDot("no-seeds")).toBe("critical")
    expect(getHealthBadgeVariant("warning")).toBe("warn")
    expect(getHealthPulseDot("warning")).toBe("warning")
  })
})
