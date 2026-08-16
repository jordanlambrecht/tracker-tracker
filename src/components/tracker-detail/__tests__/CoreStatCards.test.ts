// src/components/tracker-detail/__tests__/CoreStatCards.test.ts
//
// Regression coverage: an infinite ratio (uploaded > 0, downloaded === 0)
// crosses the wire as `ratio: null` plus `ratioIsInfinite`. The ratio
// descriptor used to read `ratio` alone and render "—" with no trend,
// identical to a tracker with no stats at all.

import { describe, expect, it } from "vitest"
import { buildCoreStatDescriptors } from "@/components/tracker-detail/CoreStatCards"
import type { TrackerLatestStats } from "@/types/api"

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
