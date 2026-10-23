// src/components/tracker-detail/__tests__/CoreStatCards.test.ts
//
// Regression coverage: an infinite ratio (uploaded > 0, downloaded === 0)
// crosses the wire as `ratio: null` plus `ratioIsInfinite`. Reading `ratio`
// alone renders a dash with no trend, identical to a tracker with no stats at
// all.
//
// Also covers the Hit & Runs descriptor: a measured zero renders "0", while a
// null count (the adapter cannot read the field) renders "—" like a missing
// snapshot, so unknown never reads as clean.

import { describe, expect, it } from "vitest"
import { buildCoreStatDescriptors, ratioTrend24h } from "@/components/tracker-detail/CoreStatCards"
import type { Snapshot, TrackerLatestStats } from "@/types/api"

const baseStats: TrackerLatestStats = {
  ratio: null,
  ratioIsInfinite: false,
  seedingCount: 5,
  leechingCount: 0,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  hitAndRuns: null,
  seedbonus: null,
  shareScore: null,
  username: null,
  group: null,
  uploadedBytes: "0",
  downloadedBytes: "0",
  bufferBytes: "0",
}

const baseSnapshot: Snapshot = {
  polledAt: "2026-01-01T00:00:00.000Z",
  uploadedBytes: "1000",
  downloadedBytes: "1000",
  bufferBytes: "0",
  ratio: 1,
  ratioIsInfinite: false,
  seedingCount: 5,
  leechingCount: 0,
  requiredRatio: null,
  warned: false,
  freeleechTokens: null,
  hitAndRuns: 0,
  seedbonus: null,
  shareScore: null,
  username: null,
  group: null,
  isManual: false,
}

function ratioDescriptor(stats: TrackerLatestStats | null) {
  const descriptors = buildCoreStatDescriptors(stats, null)
  const descriptor = descriptors.find((d) => d.key === "ratio")
  if (!descriptor) throw new Error("ratio descriptor not found")
  return descriptor
}

describe("buildCoreStatDescriptors ratio (infinite ratio)", () => {
  it("renders '∞' with unit 'x' for a zero-download account", () => {
    const stats: TrackerLatestStats = {
      ...baseStats,
      ratioIsInfinite: true,
      ratio: null,
      uploadedBytes: "1000",
    }

    const descriptor = ratioDescriptor(stats)
    expect(descriptor.value).toBe("∞")
    expect(descriptor.unit).toBe("x")
  })

  it("does not flag an infinite ratio as below a required ratio", () => {
    const stats: TrackerLatestStats = {
      ...baseStats,
      ratioIsInfinite: true,
      ratio: null,
      uploadedBytes: "1000",
      requiredRatio: 1.5,
    }

    const descriptor = ratioDescriptor(stats)
    expect(descriptor.alert).toBeUndefined()
    expect(descriptor.alertReason).toBeUndefined()
  })

  it("keeps rendering '—' with no unit or trend for a genuinely unmeasured account", () => {
    const descriptor = ratioDescriptor(null)
    expect(descriptor.value).toBe("—")
    expect(descriptor.unit).toBeUndefined()
    expect(descriptor.trend).toBeUndefined()
  })

  it("still renders a finite ratio normally", () => {
    const stats: TrackerLatestStats = {
      ...baseStats,
      ratio: 2.5,
      uploadedBytes: "2500",
      downloadedBytes: "1000",
    }

    const descriptor = ratioDescriptor(stats)
    expect(descriptor.value).toBe("2.50")
    expect(descriptor.unit).toBe("x")
  })
})

describe("ratio trend", () => {
  function snap(hoursAgo: number, ratio: number | null, ratioIsInfinite = false): Snapshot {
    return {
      ...baseSnapshot,
      polledAt: new Date(Date.UTC(2026, 9, 24, 12) - hoursAgo * 3_600_000).toISOString(),
      ratio,
      ratioIsInfinite,
    }
  }

  it("shows the trend it is given, not a level from the ratio itself", () => {
    const stats: TrackerLatestStats = { ...baseStats, ratio: 4.48 }
    const trendOf = (trend?: "up" | "flat" | "down") =>
      buildCoreStatDescriptors(stats, null, undefined, trend).find((d) => d.key === "ratio")?.trend
    expect(trendOf()).toBeUndefined()
    expect(trendOf("flat")).toBe("flat")
  })

  it("compares the latest ratio with the newest snapshot at least 24 hours older", () => {
    expect(ratioTrend24h([snap(30, 2.0), snap(25, 4.48), snap(2, 4.0), snap(0, 4.48)])).toBe("flat")
    expect(ratioTrend24h([snap(24, 4.4), snap(0, 4.48)])).toBe("up")
    expect(ratioTrend24h([snap(24, 4.5), snap(0, 4.48)])).toBe("down")
  })

  it("treats a change within Number.EPSILON as flat", () => {
    expect(ratioTrend24h([snap(24, 1), snap(0, 1 + Number.EPSILON)])).toBe("flat")
  })

  it("has no trend without a snapshot 24 hours older or without a ratio", () => {
    expect(ratioTrend24h([])).toBeUndefined()
    expect(ratioTrend24h([snap(23, 1), snap(0, 2)])).toBeUndefined()
    expect(ratioTrend24h([snap(24, null), snap(0, 2)])).toBeUndefined()
  })

  it("ranks an infinite ratio above any finite one", () => {
    expect(ratioTrend24h([snap(24, 3), snap(0, null, true)])).toBe("up")
    expect(ratioTrend24h([snap(24, null, true), snap(0, 3)])).toBe("down")
    expect(ratioTrend24h([snap(24, null, true), snap(0, null, true)])).toBe("flat")
  })
})

function hnrDescriptor(latestSnapshot: Snapshot | null) {
  const descriptors = buildCoreStatDescriptors(baseStats, latestSnapshot)
  const descriptor = descriptors.find((d) => d.key === "hnr")
  if (!descriptor) throw new Error("hnr descriptor not found")
  return descriptor
}

describe("buildCoreStatDescriptors hit & runs (zero is not unknown, null is)", () => {
  it("renders '0' when the snapshot reports zero hit & runs", () => {
    expect(hnrDescriptor({ ...baseSnapshot, hitAndRuns: 0 }).value).toBe("0")
  })

  it("renders '—' when the snapshot carries no hit & run count at all", () => {
    expect(hnrDescriptor({ ...baseSnapshot, hitAndRuns: null }).value).toBe("—")
  })

  it("renders '—' when there is no snapshot at all", () => {
    expect(hnrDescriptor(null).value).toBe("—")
  })

  it("still renders a non-zero count with thousand separators", () => {
    expect(hnrDescriptor({ ...baseSnapshot, hitAndRuns: 1234 }).value).toBe("1,234")
  })
})
