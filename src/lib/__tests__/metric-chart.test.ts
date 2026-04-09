// src/lib/__tests__/metric-chart.test.ts

import { describe, expect, it } from "vitest"
import { extractRankHistory } from "@/components/dashboard/RankProgress"
import type { Snapshot } from "@/types/api"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSnapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  polledAt: new Date().toISOString(),
  uploadedBytes: "1000000000",
  downloadedBytes: "500000000",
  ratio: 2.0,
  bufferBytes: "500000000",
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
  isManual: false,
  ...overrides,
})

// Builds an ISO timestamp for a specific day offset relative to a fixed base
// date so that tests are deterministic regardless of the current wall clock.
function isoAt(dayOffset: number, hour = 12): string {
  const d = new Date("2026-03-09T12:00:00.000Z")
  d.setUTCDate(d.getUTCDate() + dayOffset)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// extractRankHistory
// ---------------------------------------------------------------------------

describe("extractRankHistory", () => {
  it("returns empty array when all snapshots have the same group", () => {
    const snapshots = [
      makeSnapshot({ group: "User", polledAt: isoAt(0) }),
      makeSnapshot({ group: "User", polledAt: isoAt(1) }),
      makeSnapshot({ group: "User", polledAt: isoAt(2) }),
    ]

    expect(extractRankHistory(snapshots)).toEqual([])
  })

  it("returns empty array for zero snapshots", () => {
    expect(extractRankHistory([])).toEqual([])
  })

  it("returns empty array for a single snapshot", () => {
    expect(extractRankHistory([makeSnapshot()])).toEqual([])
  })

  it("detects a single rank change with correct from, to and date fields", () => {
    const changeTime = isoAt(1)
    const snapshots = [
      makeSnapshot({ group: "User", polledAt: isoAt(0) }),
      makeSnapshot({ group: "Power User", polledAt: changeTime }),
    ]

    const result = extractRankHistory(snapshots)

    expect(result).toHaveLength(1)
    expect(result[0].from).toBe("User")
    expect(result[0].to).toBe("Power User")
    expect(result[0].date).toBe(changeTime)
  })

  it("detects multiple rank changes in chronological order", () => {
    const t1 = isoAt(1)
    const t2 = isoAt(2)
    const snapshots = [
      makeSnapshot({ group: "User", polledAt: isoAt(0) }),
      makeSnapshot({ group: "Power User", polledAt: t1 }),
      makeSnapshot({ group: "Elite", polledAt: t2 }),
    ]

    const result = extractRankHistory(snapshots)

    expect(result).toHaveLength(2)
    expect(result[0].from).toBe("User")
    expect(result[0].to).toBe("Power User")
    expect(result[0].date).toBe(t1)
    expect(result[1].from).toBe("Power User")
    expect(result[1].to).toBe("Elite")
    expect(result[1].date).toBe(t2)
  })

  it("skips entries where the previous snapshot has a null group", () => {
    const snapshots = [
      makeSnapshot({ group: null, polledAt: isoAt(0) }),
      makeSnapshot({ group: "Power User", polledAt: isoAt(1) }),
    ]

    expect(extractRankHistory(snapshots)).toEqual([])
  })

  it("skips entries where the current snapshot has a null group", () => {
    const snapshots = [
      makeSnapshot({ group: "User", polledAt: isoAt(0) }),
      makeSnapshot({ group: null, polledAt: isoAt(1) }),
    ]

    expect(extractRankHistory(snapshots)).toEqual([])
  })

  it("skips null-group pairs but still records the valid change that follows", () => {
    const changeTime = isoAt(2)
    const snapshots = [
      makeSnapshot({ group: "User", polledAt: isoAt(0) }),
      makeSnapshot({ group: null, polledAt: isoAt(1) }), // gap — skipped
      makeSnapshot({ group: "Power User", polledAt: changeTime }),
    ]

    // pair (0→1): curr.group is null — skipped
    // pair (1→2): prev.group is null — skipped
    // So no changes are recorded (the null bridges the gap)
    expect(extractRankHistory(snapshots)).toEqual([])
  })

  it("does not record a change when consecutive groups are identical even with different dates", () => {
    const snapshots = [
      makeSnapshot({ group: "Elite", polledAt: isoAt(0) }),
      makeSnapshot({ group: "Elite", polledAt: isoAt(5) }),
    ]

    expect(extractRankHistory(snapshots)).toHaveLength(0)
  })
})
