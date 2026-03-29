// src/components/charts/lib/__tests__/chart-transforms.test.ts

import { describe, expect, it } from "vitest"
import { carryForwardValues, computeDailyDeltas } from "@/components/charts/lib/chart-transforms"
import { localDateStr } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

function makeSnap(polledAt: string, overrides?: Partial<Snapshot>): Snapshot {
  return {
    polledAt,
    uploadedBytes: "0",
    downloadedBytes: "0",
    ratio: null,
    bufferBytes: "0",
    seedbonus: null,
    seedingCount: null,
    leechingCount: null,
    hitAndRuns: null,
    requiredRatio: null,
    warned: false,
    freeleechTokens: null,
    username: null,
    shareScore: null,
    group: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeDailyDeltas
// ---------------------------------------------------------------------------

// One GiB in bytes — makes byte counts readable in tests.
const GiB = 1024 ** 3

describe("computeDailyDeltas", () => {
  it("returns empty array when given fewer than 2 snapshots", () => {
    expect(computeDailyDeltas([])).toEqual([])
    expect(computeDailyDeltas([makeSnap("2024-01-01T00:00:00.000Z")])).toEqual([])
  })

  it("computes upload and download deltas in GiB for two snapshots on the same day", () => {
    const snaps = [
      makeSnap("2024-01-01T00:00:00.000Z", {
        uploadedBytes: String(0),
        downloadedBytes: String(0),
      }),
      makeSnap("2024-01-01T12:00:00.000Z", {
        uploadedBytes: String(2 * GiB),
        downloadedBytes: String(GiB),
      }),
    ]

    const result = computeDailyDeltas(snaps)

    expect(result).toHaveLength(1)
    expect(result[0].label).toBe(localDateStr(new Date("2024-01-01T12:00:00.000Z")))
    expect(result[0].uploadDelta).toBeCloseTo(2, 6)
    expect(result[0].downloadDelta).toBeCloseTo(1, 6)
  })

  it("aggregates multiple snapshot pairs within the same day into one bucket", () => {
    // Three snapshots → two consecutive diffs, both attributed to the same calendar day.
    const snaps = [
      makeSnap("2024-02-05T00:00:00.000Z", {
        uploadedBytes: String(0),
        downloadedBytes: String(0),
      }),
      makeSnap("2024-02-05T06:00:00.000Z", {
        uploadedBytes: String(GiB),
        downloadedBytes: String(0),
      }),
      makeSnap("2024-02-05T12:00:00.000Z", {
        uploadedBytes: String(3 * GiB),
        downloadedBytes: String(GiB),
      }),
    ]

    const result = computeDailyDeltas(snaps)

    expect(result).toHaveLength(1)
    expect(result[0].label).toBe(localDateStr(new Date("2024-02-05T06:00:00.000Z")))
    // Upload: (1 GiB - 0) + (3 GiB - 1 GiB) = 3 GiB total
    expect(result[0].uploadDelta).toBeCloseTo(3, 6)
    // Download: (0 - 0) + (1 GiB - 0) = 1 GiB total
    expect(result[0].downloadDelta).toBeCloseTo(1, 6)
  })

  it("produces one bucket per calendar day for multi-day data", () => {
    const snaps = [
      makeSnap("2024-03-01T00:00:00.000Z", {
        uploadedBytes: String(0),
        downloadedBytes: String(0),
      }),
      makeSnap("2024-03-02T00:00:00.000Z", {
        uploadedBytes: String(GiB),
        downloadedBytes: String(0),
      }),
      makeSnap("2024-03-03T00:00:00.000Z", {
        uploadedBytes: String(4 * GiB),
        downloadedBytes: String(2 * GiB),
      }),
    ]

    const result = computeDailyDeltas(snaps)

    expect(result).toHaveLength(2)
    const byLabel = Object.fromEntries(result.map((b) => [b.label, b]))

    const day2 = localDateStr(new Date("2024-03-02T00:00:00.000Z"))
    const day3 = localDateStr(new Date("2024-03-03T00:00:00.000Z"))
    expect(byLabel[day2].uploadDelta).toBeCloseTo(1, 6)
    expect(byLabel[day2].downloadDelta).toBeCloseTo(0, 6)
    expect(byLabel[day3].uploadDelta).toBeCloseTo(3, 6)
    expect(byLabel[day3].downloadDelta).toBeCloseTo(2, 6)
  })

  it("handles negative deltas when bytes decrease between snapshots", () => {
    // Can occur if a tracker resets stats or reports a corrected lower value.
    const snaps = [
      makeSnap("2024-04-10T00:00:00.000Z", {
        uploadedBytes: String(5 * GiB),
        downloadedBytes: String(3 * GiB),
      }),
      makeSnap("2024-04-10T06:00:00.000Z", {
        uploadedBytes: String(4 * GiB),
        downloadedBytes: String(2 * GiB),
      }),
    ]

    const result = computeDailyDeltas(snaps)

    expect(result).toHaveLength(1)
    expect(result[0].uploadDelta).toBeCloseTo(-1, 6)
    expect(result[0].downloadDelta).toBeCloseTo(-1, 6)
  })
})

// ---------------------------------------------------------------------------
// carryForwardValues
// ---------------------------------------------------------------------------

describe("carryForwardValues", () => {
  it("returns array of nulls when valueMap is empty and no initialValue provided", () => {
    const timestamps = [
      "2024-01-01T00:00:00.000Z",
      "2024-01-01T01:00:00.000Z",
      "2024-01-01T02:00:00.000Z",
    ]
    const result = carryForwardValues(timestamps, new Map())
    expect(result).toEqual([null, null, null])
  })

  it("uses initialValue before the first real entry", () => {
    const t1 = "2024-01-01T00:00:00.000Z"
    const t2 = "2024-01-01T01:00:00.000Z"
    const t3 = "2024-01-01T02:00:00.000Z"

    const valueMap = new Map([[t2, 500]])
    const result = carryForwardValues([t1, t2, t3], valueMap, 0)

    // t1 has no entry — initialValue (0) is used.
    expect(result[0]).toBe(0)
    // t2 has an entry — updates lastValue.
    expect(result[1]).toBe(500)
    // t3 has no entry — carries forward 500.
    expect(result[2]).toBe(500)
  })

  it("carries the last known value forward across gaps", () => {
    const t1 = "2024-01-01T00:00:00.000Z"
    const t2 = "2024-01-01T01:00:00.000Z"
    const t3 = "2024-01-01T02:00:00.000Z"
    const t4 = "2024-01-01T03:00:00.000Z"

    const valueMap = new Map([
      [t1, 100],
      [t3, 200],
    ])
    const result = carryForwardValues([t1, t2, t3, t4], valueMap)

    expect(result[0]).toBe(100)
    // t2 has no entry — 100 carried forward.
    expect(result[1]).toBe(100)
    // t3 updates to 200.
    expect(result[2]).toBe(200)
    // t4 has no entry — 200 carried forward.
    expect(result[3]).toBe(200)
  })

  it("returns the exact value at every position when all timestamps have entries", () => {
    const t1 = "2024-05-01T00:00:00.000Z"
    const t2 = "2024-05-01T01:00:00.000Z"
    const t3 = "2024-05-01T02:00:00.000Z"

    const valueMap = new Map([
      [t1, 10],
      [t2, 20],
      [t3, 30],
    ])
    const result = carryForwardValues([t1, t2, t3], valueMap)

    expect(result).toEqual([10, 20, 30])
  })

  it("returns empty array when timestamps array is empty", () => {
    const result = carryForwardValues([], new Map([["2024-01-01T00:00:00.000Z", 42]]))
    expect(result).toEqual([])
  })
})
