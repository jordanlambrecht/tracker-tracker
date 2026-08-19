// src/components/tracker-detail/__tests__/CoreStatCards.test.ts
//
// Regression coverage: an infinite ratio (uploaded > 0, downloaded === 0)
// crosses the wire as `ratio: null` plus `ratioIsInfinite`. The ratio
// descriptor used to read `ratio` alone and render "—" with no trend,
// identical to a tracker with no stats at all.
//
// Also covers the Hit & Runs descriptor: a count of nothing is zero, so a
// snapshot with no recorded hit & runs must render "0" rather than the "—"
// reserved for "no snapshot at all".

import { describe, expect, it } from "vitest"
import { buildCoreStatDescriptors } from "@/components/tracker-detail/CoreStatCards"
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
  it("renders '∞' with unit 'x' and an 'up' trend for a zero-download account", () => {
    const stats: TrackerLatestStats = {
      ...baseStats,
      ratioIsInfinite: true,
      ratio: null,
      uploadedBytes: "1000",
    }

    const descriptor = ratioDescriptor(stats)
    expect(descriptor.value).toBe("∞")
    expect(descriptor.unit).toBe("x")
    expect(descriptor.trend).toBe("up")
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
    expect(descriptor.trend).toBe("up")
  })
})

function hnrDescriptor(latestSnapshot: Snapshot | null) {
  const descriptors = buildCoreStatDescriptors(baseStats, latestSnapshot)
  const descriptor = descriptors.find((d) => d.key === "hnr")
  if (!descriptor) throw new Error("hnr descriptor not found")
  return descriptor
}

describe("buildCoreStatDescriptors hit & runs (zero is not unknown)", () => {
  it("renders '0' when the snapshot reports zero hit & runs", () => {
    expect(hnrDescriptor({ ...baseSnapshot, hitAndRuns: 0 }).value).toBe("0")
  })

  it("renders '0' when a snapshot exists but recorded no hit & runs", () => {
    expect(hnrDescriptor({ ...baseSnapshot, hitAndRuns: null }).value).toBe("0")
  })

  it("renders '—' when there is no snapshot at all", () => {
    expect(hnrDescriptor(null).value).toBe("—")
  })

  it("still renders a non-zero count with thousand separators", () => {
    expect(hnrDescriptor({ ...baseSnapshot, hitAndRuns: 1234 }).value).toBe("1,234")
  })
})
