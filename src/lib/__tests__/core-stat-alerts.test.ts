// src/lib/__tests__/core-stat-alerts.test.ts

import { describe, expect, it } from "vitest"
import { buildCoreStatDescriptors } from "@/components/tracker-detail/CoreStatCards"
import type { Snapshot, TrackerLatestStats } from "@/types/api"

const baseStats: TrackerLatestStats = {
  ratio: 2.0,
  uploadedBytes: "100000000000",
  downloadedBytes: "50000000000",
  seedingCount: 100,
  leechingCount: 0,
  requiredRatio: null,
  warned: false,
  freeleechTokens: null,
  bufferBytes: null,
  hitAndRuns: null,
  seedbonus: null,
  shareScore: null,
  username: "test",
  group: "User",
}

const baseSnapshot: Snapshot = {
  polledAt: new Date().toISOString(),
  uploadedBytes: "100000000000",
  downloadedBytes: "50000000000",
  ratio: 2.0,
  bufferBytes: "50000000000",
  seedbonus: 500,
  seedingCount: 100,
  leechingCount: 0,
  hitAndRuns: 0,
  requiredRatio: null,
  warned: false,
  freeleechTokens: null,
  shareScore: null,
  username: "test",
  group: "User",
}

describe("buildCoreStatDescriptors alerts", () => {
  it("returns 8 descriptors", () => {
    const cards = buildCoreStatDescriptors(baseStats, baseSnapshot)
    expect(cards).toHaveLength(8)
  })

  it("no alerts when ratio is above required", () => {
    const stats = { ...baseStats, ratio: 2.0 }
    const snap = { ...baseSnapshot, requiredRatio: 0.6 }
    const cards = buildCoreStatDescriptors(stats, snap)
    const ratio = cards.find((c) => c.key === "ratio")
    expect(ratio?.alert).toBeUndefined()
    expect(ratio?.alertReason).toBeUndefined()
  })

  it("danger alert when ratio is below required", () => {
    const stats = { ...baseStats, ratio: 0.59 }
    const snap = { ...baseSnapshot, requiredRatio: 0.6 }
    const cards = buildCoreStatDescriptors(stats, snap)
    const ratio = cards.find((c) => c.key === "ratio")
    expect(ratio?.alert).toBe("danger")
    expect(ratio?.alertReason).toContain("Below required ratio")
    expect(ratio?.alertReason).toContain("0.60")
  })

  it("no ratio alert when requiredRatio is null", () => {
    const stats = { ...baseStats, ratio: 0.1 }
    const snap = { ...baseSnapshot, requiredRatio: null }
    const cards = buildCoreStatDescriptors(stats, snap)
    const ratio = cards.find((c) => c.key === "ratio")
    expect(ratio?.alert).toBeUndefined()
  })

  it("no buffer alert when buffer is positive", () => {
    const snap = { ...baseSnapshot, bufferBytes: "50000000000" }
    const cards = buildCoreStatDescriptors(baseStats, snap)
    const buffer = cards.find((c) => c.key === "buffer")
    expect(buffer?.alert).toBeUndefined()
  })

  it("danger alert when buffer is negative", () => {
    const snap = { ...baseSnapshot, bufferBytes: "-15561971655" }
    const cards = buildCoreStatDescriptors(baseStats, snap)
    const buffer = cards.find((c) => c.key === "buffer")
    expect(buffer?.alert).toBe("danger")
    expect(buffer?.alertReason).toBe("Negative buffer")
  })

  it("no buffer alert when snapshot is null", () => {
    const cards = buildCoreStatDescriptors(baseStats, null)
    const buffer = cards.find((c) => c.key === "buffer")
    expect(buffer?.alert).toBeUndefined()
  })

  it("ratio alert at exact boundary (equal to required = no alert)", () => {
    const stats = { ...baseStats, ratio: 0.6 }
    const snap = { ...baseSnapshot, requiredRatio: 0.6 }
    const cards = buildCoreStatDescriptors(stats, snap)
    const ratio = cards.find((c) => c.key === "ratio")
    expect(ratio?.alert).toBeUndefined()
  })
})
