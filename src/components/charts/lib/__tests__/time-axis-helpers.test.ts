// src/components/charts/lib/__tests__/time-axis-helpers.test.ts

import { describe, expect, it } from "vitest"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"
import {
  buildTimeSeriesData,
  carryForwardTimeSeries,
  collectUnifiedTimestamps,
} from "../chart-transforms"

function makeSnap(polledAt: string, ratio: number | null = 1.5): Snapshot {
  return {
    polledAt,
    uploadedBytes: "0",
    downloadedBytes: "0",
    ratio,
    bufferBytes: "0",
    seedbonus: null,
    seedingCount: null,
    leechingCount: null,
    hitAndRuns: null,
    requiredRatio: null,
    warned: false,
    freeleechTokens: null,
    username: null,
    group: null,
    shareScore: null,
    isManual: false,
  }
}

// ---------------------------------------------------------------------------
// buildTimeSeriesData
// ---------------------------------------------------------------------------

describe("buildTimeSeriesData", () => {
  it("returns correct [timestamp_ms, value] pairs from snapshots", () => {
    const t1 = "2024-01-01T00:00:00.000Z"
    const t2 = "2024-01-01T01:00:00.000Z"
    const snaps = [makeSnap(t1, 1.2), makeSnap(t2, 2.4)]
    const result = buildTimeSeriesData(snaps, (s) => s.ratio)
    expect(result).toEqual([
      [new Date(t1).getTime(), 1.2],
      [new Date(t2).getTime(), 2.4],
    ])
  })

  it("skips snapshots where fieldFn returns null", () => {
    const t1 = "2024-01-01T00:00:00.000Z"
    const t2 = "2024-01-01T01:00:00.000Z"
    const t3 = "2024-01-01T02:00:00.000Z"
    const snaps = [makeSnap(t1, 1.0), makeSnap(t2, null), makeSnap(t3, 3.0)]
    const result = buildTimeSeriesData(snaps, (s) => s.ratio)
    expect(result).toHaveLength(2)
    expect(result[0][1]).toBe(1.0)
    expect(result[1][1]).toBe(3.0)
    // the null snapshot's timestamp should not appear
    expect(result.map(([ts]) => ts)).not.toContain(new Date(t2).getTime())
  })

  it("returns empty array for empty input", () => {
    expect(buildTimeSeriesData([], (s) => s.ratio)).toEqual([])
  })

  it("handles a single snapshot", () => {
    const t = "2024-06-15T12:00:00.000Z"
    const result = buildTimeSeriesData([makeSnap(t, 0.5)], (s) => s.ratio)
    expect(result).toEqual([[new Date(t).getTime(), 0.5]])
  })
})

// ---------------------------------------------------------------------------
// carryForwardTimeSeries
// ---------------------------------------------------------------------------

describe("carryForwardTimeSeries", () => {
  it("fills gaps with the last known value", () => {
    const t1 = "2024-01-01T00:00:00.000Z"
    const t2 = "2024-01-01T01:00:00.000Z"
    const t3 = "2024-01-01T02:00:00.000Z"

    const allTimestamps = [new Date(t1).getTime(), new Date(t2).getTime(), new Date(t3).getTime()]
    // Tracker only has snapshots at t1 and t3 — t2 is a gap
    const snaps = [makeSnap(t1, 1.0), makeSnap(t3, 2.0)]

    const result = carryForwardTimeSeries(allTimestamps, snaps, (s) => s.ratio)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual([new Date(t1).getTime(), 1.0])
    // t2 has no snapshot, carried forward from t1
    expect(result[1]).toEqual([new Date(t2).getTime(), 1.0])
    expect(result[2]).toEqual([new Date(t3).getTime(), 2.0])
  })

  it("returns empty array when all fieldFn results are null", () => {
    const t1 = "2024-01-01T00:00:00.000Z"
    const t2 = "2024-01-01T01:00:00.000Z"
    const allTimestamps = [new Date(t1).getTime(), new Date(t2).getTime()]
    const snaps = [makeSnap(t1, null), makeSnap(t2, null)]

    const result = carryForwardTimeSeries(allTimestamps, snaps, (s) => s.ratio)
    expect(result).toEqual([])
  })

  it("handles the case where a tracker has data at every timestamp", () => {
    const t1 = "2024-01-01T00:00:00.000Z"
    const t2 = "2024-01-01T01:00:00.000Z"
    const t3 = "2024-01-01T02:00:00.000Z"
    const allTimestamps = [new Date(t1).getTime(), new Date(t2).getTime(), new Date(t3).getTime()]
    const snaps = [makeSnap(t1, 1.0), makeSnap(t2, 1.5), makeSnap(t3, 2.0)]

    const result = carryForwardTimeSeries(allTimestamps, snaps, (s) => s.ratio)
    expect(result).toEqual([
      [new Date(t1).getTime(), 1.0],
      [new Date(t2).getTime(), 1.5],
      [new Date(t3).getTime(), 2.0],
    ])
  })

  it("does not emit values before the first real data point", () => {
    const t1 = "2024-01-01T00:00:00.000Z"
    const t2 = "2024-01-01T01:00:00.000Z"
    const t3 = "2024-01-01T02:00:00.000Z"
    const allTimestamps = [new Date(t1).getTime(), new Date(t2).getTime(), new Date(t3).getTime()]
    // Tracker only joins at t2 — nothing exists for t1
    const snaps = [makeSnap(t2, 1.0), makeSnap(t3, 2.0)]

    const result = carryForwardTimeSeries(allTimestamps, snaps, (s) => s.ratio)

    // t1 should not appear because lastValue is still null at that point
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([new Date(t2).getTime(), 1.0])
    expect(result[1]).toEqual([new Date(t3).getTime(), 2.0])
    expect(result.map(([ts]) => ts)).not.toContain(new Date(t1).getTime())
  })
})

// ---------------------------------------------------------------------------
// collectUnifiedTimestamps
// ---------------------------------------------------------------------------

describe("collectUnifiedTimestamps", () => {
  it("merges timestamps from multiple tracker series", () => {
    const t1 = "2024-01-01T00:00:00.000Z"
    const t2 = "2024-01-01T01:00:00.000Z"
    const t3 = "2024-01-01T02:00:00.000Z"

    const series: TrackerSnapshotSeries[] = [
      { name: "A", color: "#fff", snapshots: [makeSnap(t1), makeSnap(t3)] },
      { name: "B", color: "#000", snapshots: [makeSnap(t2)] },
    ]

    const result = collectUnifiedTimestamps(series)
    expect(result).toEqual([new Date(t1).getTime(), new Date(t2).getTime(), new Date(t3).getTime()])
  })

  it("deduplicates shared timestamps", () => {
    const t1 = "2024-01-01T00:00:00.000Z"
    const t2 = "2024-01-01T01:00:00.000Z"

    const series: TrackerSnapshotSeries[] = [
      { name: "A", color: "#fff", snapshots: [makeSnap(t1), makeSnap(t2)] },
      { name: "B", color: "#000", snapshots: [makeSnap(t1), makeSnap(t2)] },
    ]

    const result = collectUnifiedTimestamps(series)
    expect(result).toHaveLength(2)
    expect(result).toEqual([new Date(t1).getTime(), new Date(t2).getTime()])
  })

  it("returns values sorted ascending", () => {
    // Deliberately insert newer timestamp first
    const t1 = "2024-01-01T02:00:00.000Z"
    const t2 = "2024-01-01T00:00:00.000Z"
    const t3 = "2024-01-01T01:00:00.000Z"

    const series: TrackerSnapshotSeries[] = [
      { name: "A", color: "#fff", snapshots: [makeSnap(t1), makeSnap(t2), makeSnap(t3)] },
    ]

    const result = collectUnifiedTimestamps(series)
    expect(result).toEqual([new Date(t2).getTime(), new Date(t3).getTime(), new Date(t1).getTime()])
  })

  it("returns empty array when given no trackers", () => {
    expect(collectUnifiedTimestamps([])).toEqual([])
  })

  it("returns empty array when all tracker series have no snapshots", () => {
    const series: TrackerSnapshotSeries[] = [
      { name: "A", color: "#fff", snapshots: [] },
      { name: "B", color: "#000", snapshots: [] },
    ]
    expect(collectUnifiedTimestamps(series)).toEqual([])
  })
})
