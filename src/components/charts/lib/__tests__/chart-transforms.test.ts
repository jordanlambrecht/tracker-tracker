// src/components/charts/lib/__tests__/chart-transforms.test.ts
//
// Functions: makeSnap, localDay, localIso, series, makeDaily

import { describe, expect, it } from "vitest"
import {
  bucketGrid,
  carryForwardValues,
  computeDailyDeltas,
  computeDailyGrid,
  formatBucketLabel,
  getBucketKey,
} from "@/components/charts/lib/chart-transforms"
import { localDateStr } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

function makeSnap(polledAt: string, overrides?: Partial<Snapshot>): Snapshot {
  return {
    polledAt,
    uploadedBytes: "0",
    downloadedBytes: "0",
    ratio: null,
    ratioIsInfinite: false,
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
    isManual: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeDailyDeltas
// ---------------------------------------------------------------------------

// One GiB in bytes. Makes byte counts readable in tests.
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

  it("handles large byte values correctly via BigInt arithmetic", () => {
    // Values that would overflow a 32-bit integer (~4 GiB boundary)
    const fourGiB = BigInt(4) * BigInt(GiB)
    const eightGiB = BigInt(8) * BigInt(GiB)

    const snaps = [
      makeSnap("2024-05-01T00:00:00.000Z", {
        uploadedBytes: fourGiB.toString(),
        downloadedBytes: "0",
      }),
      makeSnap("2024-05-02T00:00:00.000Z", {
        uploadedBytes: eightGiB.toString(),
        downloadedBytes: "0",
      }),
    ]

    const result = computeDailyDeltas(snaps)

    expect(result).toHaveLength(1)
    expect(result[0].uploadDelta).toBeCloseTo(4, 5)
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

    // t1 has no entry. initialValue (0) is used.
    expect(result[0]).toBe(0)
    // t2 has an entry. updates lastValue.
    expect(result[1]).toBe(500)
    // t3 has no entry. carries forward 500.
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
    // t2 has no entry. 100 carried forward.
    expect(result[1]).toBe(100)
    // t3 updates to 200.
    expect(result[2]).toBe(200)
    // t4 has no entry. 200 carried forward.
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

// ---------------------------------------------------------------------------
// computeDailyGrid
// ---------------------------------------------------------------------------

// Local-time day builder: keeps expectations timezone-independent.
function localDay(year: number, month1: number, day: number): string {
  return localDateStr(new Date(year, month1 - 1, day, 12, 0, 0))
}

function localIso(year: number, month1: number, day: number, hour = 12): string {
  return new Date(year, month1 - 1, day, hour, 0, 0).toISOString()
}

function series(name: string, color: string, snapshots: Snapshot[]): TrackerSnapshotSeries {
  return { name, color, snapshots }
}

describe("computeDailyGrid", () => {
  it("leaves the first day at zero because there is no previous day to diff against", () => {
    const data = [
      series("Alpha", "#f00", [
        makeSnap(localIso(2024, 1, 1), { uploadedBytes: String(GiB) }),
        makeSnap(localIso(2024, 1, 2), { uploadedBytes: String(3 * GiB) }),
      ]),
    ]

    const grid = computeDailyGrid(data)

    expect(grid.days).toEqual([localDay(2024, 1, 1), localDay(2024, 1, 2)])
    expect(grid.trackerNames).toEqual(["Alpha"])
    expect(grid.trackerColors).toEqual(["#f00"])
    expect(grid.uploadGrid[0][0]).toBe(0)
    expect(grid.uploadGrid[0][1]).toBeCloseTo(2, 6)
  })

  it("clamps negative deltas to zero when a tracker resets its stats", () => {
    // Unlike computeDailyDeltas, this transform floors at zero. a reset must
    // not paint a negative cell on the chart.
    const data = [
      series("Alpha", "#f00", [
        makeSnap(localIso(2024, 2, 1), {
          uploadedBytes: String(5 * GiB),
          downloadedBytes: String(5 * GiB),
        }),
        makeSnap(localIso(2024, 2, 2), {
          uploadedBytes: String(GiB),
          downloadedBytes: String(GiB),
        }),
      ]),
    ]

    const grid = computeDailyGrid(data)

    expect(grid.uploadGrid[0][1]).toBe(0)
    expect(grid.downloadGrid[0][1]).toBe(0)
  })

  it("uses the last snapshot of each day when a day has several", () => {
    const data = [
      series("Alpha", "#f00", [
        makeSnap(localIso(2024, 3, 1, 9), { uploadedBytes: "0" }),
        makeSnap(localIso(2024, 3, 2, 9), { uploadedBytes: String(GiB) }),
        makeSnap(localIso(2024, 3, 2, 21), { uploadedBytes: String(4 * GiB) }),
      ]),
    ]

    const grid = computeDailyGrid(data)

    expect(grid.days).toHaveLength(2)
    // 4 GiB (last of day 2) minus 0 (day 1), not 1 GiB.
    expect(grid.uploadGrid[0][1]).toBeCloseTo(4, 6)
  })

  it("diffs against the nearest earlier day a tracker actually reported", () => {
    // The unified day axis carries day 2 because Beta reported then; Alpha has
    // no day-2 snapshot, so its day-3 delta reaches back to day 1.
    const data = [
      series("Alpha", "#f00", [
        makeSnap(localIso(2024, 4, 1), { uploadedBytes: "0" }),
        makeSnap(localIso(2024, 4, 3), { uploadedBytes: String(6 * GiB) }),
      ]),
      series("Beta", "#0f0", [makeSnap(localIso(2024, 4, 2), { uploadedBytes: String(GiB) })]),
    ]

    const grid = computeDailyGrid(data)

    expect(grid.days).toEqual([localDay(2024, 4, 1), localDay(2024, 4, 2), localDay(2024, 4, 3)])
    // Alpha: no day-2 reading, so day 2 is zero and day 3 diffs against day 1.
    expect(grid.uploadGrid[0]).toHaveLength(3)
    expect(grid.uploadGrid[0][1]).toBe(0)
    expect(grid.uploadGrid[0][2]).toBeCloseTo(6, 6)
    // Beta only ever reported once. no previous day, so nothing anywhere.
    expect(grid.uploadGrid[1]).toEqual([0, 0, 0])
  })

  it("keeps precision on byte counts past the 32-bit boundary", () => {
    const data = [
      series("Alpha", "#f00", [
        makeSnap(localIso(2024, 5, 1), { uploadedBytes: (BigInt(4) * BigInt(GiB)).toString() }),
        makeSnap(localIso(2024, 5, 2), { uploadedBytes: (BigInt(12) * BigInt(GiB)).toString() }),
      ]),
    ]

    const grid = computeDailyGrid(data)

    expect(grid.uploadGrid[0][1]).toBeCloseTo(8, 5)
  })

  it("returns empty grids for no trackers", () => {
    const grid = computeDailyGrid([])
    expect(grid.days).toEqual([])
    expect(grid.uploadGrid).toEqual([])
    expect(grid.downloadGrid).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getBucketKey
// ---------------------------------------------------------------------------

describe("getBucketKey", () => {
  it("returns the day itself at day granularity", () => {
    expect(getBucketKey("2024-03-14", "day")).toBe("2024-03-14")
  })

  it("truncates to YYYY-MM at month granularity", () => {
    expect(getBucketKey("2024-03-14", "month")).toBe("2024-03")
  })

  it("snaps to the Monday of the week at week granularity", () => {
    // 2024-01-01 is a Monday; the whole week collapses onto it.
    expect(getBucketKey("2024-01-01", "week")).toBe("2024-01-01")
    expect(getBucketKey("2024-01-03", "week")).toBe("2024-01-01")
    // Sunday belongs to the week that started the previous Monday.
    expect(getBucketKey("2024-01-07", "week")).toBe("2024-01-01")
    expect(getBucketKey("2024-01-08", "week")).toBe("2024-01-08")
  })

  it("walks back across a month boundary to find Monday", () => {
    // 2024-03-01 is a Friday → Monday 2024-02-26.
    expect(getBucketKey("2024-03-01", "week")).toBe("2024-02-26")
  })
})

// ---------------------------------------------------------------------------
// formatBucketLabel
// ---------------------------------------------------------------------------

describe("formatBucketLabel", () => {
  it("formats a month key as short month and 2-digit year", () => {
    expect(formatBucketLabel("2024-03", "month")).toBe("Mar 24")
  })

  it("prefixes week labels with Wk", () => {
    expect(formatBucketLabel("2024-03-04", "week")).toBe("Wk Mar 4")
  })

  it("formats a day key as short month and day", () => {
    expect(formatBucketLabel("2024-03-04", "day")).toBe("Mar 4")
  })
})

// ---------------------------------------------------------------------------
// bucketGrid
// ---------------------------------------------------------------------------

/** Build the daily-grid shape bucketGrid consumes, without going through snapshots. */
function makeDaily(dayCount: number, uploadPerDay = 1, startDay = new Date(2024, 0, 1)) {
  const days: string[] = []
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startDay)
    d.setDate(startDay.getDate() + i)
    days.push(localDateStr(d))
  }
  return {
    days,
    trackerNames: ["Alpha"],
    trackerColors: ["#f00"],
    uploadGrid: [days.map(() => uploadPerDay)],
    downloadGrid: [days.map(() => uploadPerDay * 2)],
  }
}

describe("bucketGrid", () => {
  it("keeps day granularity at the 45-day threshold and passes the grids through", () => {
    const daily = makeDaily(45)
    const result = bucketGrid(daily)

    expect(result.granularity).toBe("day")
    expect(result.bucketLabels).toEqual(daily.days)
    expect(result.uploadGrid).toEqual(daily.uploadGrid)
    expect(result.downloadGrid).toEqual(daily.downloadGrid)
    expect(result.trackerNames).toEqual(["Alpha"])
    expect(result.trackerColors).toEqual(["#f00"])
  })

  it("switches to week granularity one day past the threshold", () => {
    expect(bucketGrid(makeDaily(46)).granularity).toBe("week")
  })

  it("keeps week granularity at the 180-day threshold and switches to month past it", () => {
    expect(bucketGrid(makeDaily(180)).granularity).toBe("week")
    expect(bucketGrid(makeDaily(181)).granularity).toBe("month")
  })

  it("sums daily values into weekly buckets without losing volume", () => {
    // 46 days from Monday 2024-01-01 → 6 full weeks plus a 4-day tail.
    const daily = makeDaily(46, 1, new Date(2024, 0, 1))
    const result = bucketGrid(daily)

    expect(result.bucketLabels).toHaveLength(7)
    expect(result.bucketLabels[0]).toBe("2024-01-01")
    expect(result.uploadGrid[0].slice(0, 6)).toEqual([7, 7, 7, 7, 7, 7])
    expect(result.uploadGrid[0][6]).toBe(4)
    // Nothing is dropped on the way into buckets.
    const total = result.uploadGrid[0].reduce((a, b) => a + b, 0)
    expect(total).toBe(46)
    expect(result.downloadGrid[0].reduce((a, b) => a + b, 0)).toBe(92)
  })

  it("sums daily values into monthly buckets", () => {
    // 181 days from 2024-01-01 crosses into July.
    const daily = makeDaily(181, 1, new Date(2024, 0, 1))
    const result = bucketGrid(daily)

    expect(result.granularity).toBe("month")
    expect(result.bucketLabels[0]).toBe("2024-01")
    // Jan has 31 days, and 2024 is a leap year so Feb has 29.
    expect(result.uploadGrid[0][0]).toBe(31)
    expect(result.uploadGrid[0][1]).toBe(29)
    expect(result.uploadGrid[0].reduce((a, b) => a + b, 0)).toBe(181)
  })

  it("returns an empty day-granularity result for an empty grid", () => {
    const result = bucketGrid({
      days: [],
      trackerNames: [],
      trackerColors: [],
      uploadGrid: [],
      downloadGrid: [],
    })

    expect(result.granularity).toBe("day")
    expect(result.bucketLabels).toEqual([])
    expect(result.uploadGrid).toEqual([])
  })
})
