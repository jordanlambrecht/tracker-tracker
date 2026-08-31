// src/lib/__tests__/tracker-status.test.ts

// Mock the registry so band tests control minimumRatio directly. The default
// (undefined) keeps every fixture on the no-requirement fallback bands.
vi.mock("@/data/tracker-registry", () => ({
  findRegistryEntry: vi.fn(() => undefined),
}))

import { beforeEach, describe, expect, it, vi } from "vitest"
import { findRegistryEntry } from "@/data/tracker-registry"
import {
  getHealthBadgeVariant,
  getHealthDescription,
  getHealthLabel,
  getHealthPulseDot,
  getTrackerHealth,
  resolveRequiredRatio,
} from "@/lib/tracker-status"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

const mockFindRegistryEntry = vi.mocked(findRegistryEntry)

function mockRegistryMinimum(minimumRatio: number | undefined) {
  // biome-ignore lint/suspicious/noExplicitAny: partial registry entry, only rules matter here
  mockFindRegistryEntry.mockReturnValue({ rules: { minimumRatio } } as any)
}

beforeEach(() => {
  mockFindRegistryEntry.mockReturnValue(undefined)
})

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
    // Named for what the model measures, ratio against the requirement. It
    // never sees the buffer, so the label must not claim one.
    expect(getHealthLabel("warning")).toBe("Above Min")
    expect(getHealthDescription("no-seeds")).toBe("Zero active seeds, nothing is uploading")
  })

  it("narrows the 'warning' description to the ratio band only", () => {
    expect(getHealthDescription("warning")).toBe("Ratio above the required ratio, below double it")
    expect(getHealthDescription("warning")).not.toContain("seeds")
  })

  it("renders 'no-seeds' more severely than 'warning'", () => {
    expect(getHealthBadgeVariant("no-seeds")).toBe("danger")
    expect(getHealthPulseDot("no-seeds")).toBe("no-seeds")
    expect(getHealthBadgeVariant("warning")).toBe("warn")
    expect(getHealthPulseDot("warning")).toBe("warning")
  })
})

// ---------------------------------------------------------------------------
// Requirement-aware bands
//
// Each tracker is judged against its own requirement: live requiredRatio
// first, registry minimumRatio second, and the historical 1.0/2.0 bands only
// when neither exists. Healthy starts at twice the requirement.
// ---------------------------------------------------------------------------

describe("resolveRequiredRatio", () => {
  it("prefers the live requiredRatio over the registry", () => {
    mockRegistryMinimum(0.6)
    expect(resolveRequiredRatio(2.0, "https://example.org")).toBe(2.0)
  })

  it("a live requirement of exactly 0 wins over the registry", () => {
    // Phoenix at full seeding: the sliding requirement really is 0, and the
    // registry's 0.6 bracket cap must not resurrect it.
    mockRegistryMinimum(0.6)
    expect(resolveRequiredRatio(0, "https://example.org")).toBe(0)
  })

  it("falls back to the registry minimumRatio when no live figure exists", () => {
    mockRegistryMinimum(0.6)
    expect(resolveRequiredRatio(null, "https://example.org")).toBe(0.6)
  })

  it("returns null when neither source has a requirement", () => {
    expect(resolveRequiredRatio(null, "https://example.org")).toBeNull()
    expect(resolveRequiredRatio(undefined, "https://example.org")).toBeNull()
  })

  it("ignores a non-finite or negative live value", () => {
    mockRegistryMinimum(0.6)
    expect(resolveRequiredRatio(Number.NaN, "https://example.org")).toBe(0.6)
    expect(resolveRequiredRatio(-1, "https://example.org")).toBe(0.6)
  })
})

describe("getTrackerHealth — requirement-aware bands", () => {
  it("judges against the registry minimumRatio when present", () => {
    mockRegistryMinimum(0.6)
    expect(healthOf({ ratio: 0.5, requiredRatio: null })).toBe("critical")
    expect(healthOf({ ratio: 0.6, requiredRatio: null })).toBe("warning")
    expect(healthOf({ ratio: 1.19, requiredRatio: null })).toBe("warning")
    expect(healthOf({ ratio: 1.2, requiredRatio: null })).toBe("healthy")
  })

  it("lets the live requiredRatio supersede the registry", () => {
    mockRegistryMinimum(0.6)
    expect(healthOf({ ratio: 1.5, requiredRatio: 2.0 })).toBe("critical")
    expect(healthOf({ ratio: 3.9, requiredRatio: 2.0 })).toBe("warning")
    expect(healthOf({ ratio: 4.0, requiredRatio: 2.0 })).toBe("healthy")
  })

  it("treats a zero requirement as healthy at any ratio", () => {
    mockRegistryMinimum(0.6)
    expect(healthOf({ ratio: 0.01, requiredRatio: 0 })).toBe("healthy")
  })

  it("keeps the no-seeds override above a zero requirement", () => {
    expect(healthOf({ ratio: 0.01, requiredRatio: 0, seedingCount: 0 })).toBe("no-seeds")
  })

  it("keeps a tracker warning critical regardless of the requirement", () => {
    expect(healthOf({ ratio: 9.9, requiredRatio: 0, warned: true })).toBe("critical")
  })

  it("keeps the historical 1.0/2.0 bands when no requirement is known", () => {
    expect(healthOf({ ratio: 0.9 })).toBe("critical")
    expect(healthOf({ ratio: 1.5 })).toBe("warning")
    expect(healthOf({ ratio: 2.0 })).toBe("healthy")
  })

  it("still reads an infinite ratio as healthy under a real requirement", () => {
    mockRegistryMinimum(0.6)
    expect(healthOf({ ratio: null, ratioIsInfinite: true })).toBe("healthy")
  })
})

describe("getHealthDescription — per-tracker numbers", () => {
  const trackerWith = (stats: Partial<TrackerLatestStats>) =>
    makeTracker({ latestStats: makeStats(stats) })

  it("names the requirement on the critical band", () => {
    mockRegistryMinimum(0.6)
    const tracker = trackerWith({ ratio: 0.5 })
    expect(getHealthDescription("critical", tracker)).toBe("Ratio below the 0.6 requirement")
  })

  it("names both band edges on the middle tier", () => {
    mockRegistryMinimum(0.6)
    const tracker = trackerWith({ ratio: 0.8 })
    expect(getHealthDescription("warning", tracker)).toBe("Ratio between 0.6 and 1.2")
  })

  it("names the healthy line and the requirement behind it", () => {
    mockRegistryMinimum(0.6)
    const tracker = trackerWith({ ratio: 1.5 })
    expect(getHealthDescription("healthy", tracker)).toBe(
      "Ratio 1.2 or higher (2x the 0.6 requirement)"
    )
  })

  it("says when the bands are assumed rather than known", () => {
    const tracker = trackerWith({ ratio: 1.5 })
    expect(getHealthDescription("warning", tracker)).toBe(
      "Ratio between 1.0 and 2.0 (no requirement on record)"
    )
    expect(getHealthDescription("critical", trackerWith({ ratio: 0.5 }))).toBe(
      "Ratio below 1.0 (no requirement on record)"
    )
    expect(getHealthDescription("healthy", trackerWith({ ratio: 2.5 }))).toBe(
      "Ratio 2.0 or higher (no requirement on record)"
    )
  })

  it("reports a zero requirement instead of inventing bands", () => {
    const tracker = trackerWith({ ratio: 0.01, requiredRatio: 0 })
    expect(getHealthDescription("healthy", tracker)).toBe("No ratio requirement on this tracker")
  })

  it("describes a warned account by the warning, not the ratio", () => {
    // "critical" here comes from the tracker's own warning flag; a ratio-band
    // description would be the wrong explanation, whatever the numbers say.
    const tracker = trackerWith({ ratio: 9.9, warned: true })
    expect(getHealthDescription("critical", tracker)).toBe("Warned by the tracker")
  })

  it("keeps the static wording when no tracker is supplied", () => {
    expect(getHealthDescription("critical")).toBe("Ratio below the required ratio")
    expect(getHealthDescription("healthy")).toBe("Ratio at least double the required ratio")
  })
})
