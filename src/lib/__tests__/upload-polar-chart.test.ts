// src/lib/__tests__/upload-polar-chart.test.ts

import { describe, expect, it } from "vitest"
import { computeHourlyUploadAverages } from "@/components/charts/UploadPolarChart"
import type { Snapshot } from "@/types/api"

// ── Helpers ──

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
  ...overrides,
})

/**
 * Builds a deterministic ISO timestamp at a specific LOCAL day offset and hour.
 * Uses a fixed base date (2026-03-09) so that getDay() and getHours() in the
 * component (which also use local time) align with the values asserted here.
 */
function isoAt(dayOffset: number, hour = 12): string {
  const d = new Date(2026, 2, 9, hour, 0, 0, 0) // month is 0-indexed: 2 = March
  d.setDate(d.getDate() + dayOffset)
  return d.toISOString()
}

const GiB = 1024 ** 3

// ── computeHourlyUploadAverages ──

describe("computeHourlyUploadAverages", () => {
  it("returns empty array for zero snapshots", () => {
    expect(computeHourlyUploadAverages([])).toEqual([])
  })

  it("returns empty array for exactly one snapshot", () => {
    expect(computeHourlyUploadAverages([makeSnapshot()])).toEqual([])
  })

  it("returns empty array when all deltas are non-positive", () => {
    const snapshots = [
      makeSnapshot({ polledAt: isoAt(0, 8), uploadedBytes: String(2 * GiB) }),
      makeSnapshot({ polledAt: isoAt(0, 9), uploadedBytes: String(GiB) }),
    ]
    expect(computeHourlyUploadAverages(snapshots)).toEqual([])
  })

  it("produces one bucket for a single positive delta", () => {
    const snapshots = [
      makeSnapshot({ polledAt: isoAt(0, 8), uploadedBytes: "0" }),
      makeSnapshot({ polledAt: isoAt(0, 9), uploadedBytes: String(GiB) }),
    ]

    const result = computeHourlyUploadAverages(snapshots)

    expect(result).toHaveLength(1)
    expect(result[0].avgBytes).toBeCloseTo(GiB, 0)
    expect(result[0].count).toBe(1)
  })

  it("assigns the correct day-of-week and hour from the later snapshot", () => {
    // 2026-03-09 is a Monday (getDay() === 1), hour 14 local time
    const laterTs = isoAt(0, 14)
    const snapshots = [
      makeSnapshot({ polledAt: isoAt(0, 13), uploadedBytes: "0" }),
      makeSnapshot({ polledAt: laterTs, uploadedBytes: String(GiB) }),
    ]

    const result = computeHourlyUploadAverages(snapshots)

    expect(result).toHaveLength(1)
    // Use the same Date constructor the component uses so the test is TZ-agnostic
    const expectedDate = new Date(laterTs)
    expect(result[0].day).toBe(expectedDate.getDay())
    expect(result[0].hour).toBe(expectedDate.getHours())
  })

  it("buckets two deltas in the same day-hour slot and computes the average", () => {
    // Three snapshots: two intervals both landing in the same slot
    const snapshots = [
      makeSnapshot({ polledAt: isoAt(0, 8), uploadedBytes: "0" }),
      makeSnapshot({ polledAt: isoAt(0, 9), uploadedBytes: String(GiB) }),
      makeSnapshot({ polledAt: isoAt(7, 9), uploadedBytes: String(3 * GiB) }),
    ]

    // Both deltas land on the same day-of-week (Monday) and hour (9)
    const result = computeHourlyUploadAverages(snapshots)

    expect(result).toHaveLength(1)
    // deltas: GiB and 2*GiB  → average = 1.5 GiB
    expect(result[0].avgBytes).toBeCloseTo(1.5 * GiB, 0)
    expect(result[0].count).toBe(2)
  })

  it("produces separate buckets for different hours on the same day", () => {
    const ts9 = isoAt(0, 9)
    const ts10 = isoAt(0, 10)
    const snapshots = [
      makeSnapshot({ polledAt: isoAt(0, 8), uploadedBytes: "0" }),
      makeSnapshot({ polledAt: ts9, uploadedBytes: String(GiB) }),
      makeSnapshot({ polledAt: ts10, uploadedBytes: String(3 * GiB) }),
    ]

    const result = computeHourlyUploadAverages(snapshots)

    expect(result).toHaveLength(2)
    const hours = result.map((b) => b.hour).sort((a, b) => a - b)
    const expectedHours = [new Date(ts9).getHours(), new Date(ts10).getHours()].sort(
      (a, b) => a - b
    )
    expect(hours).toEqual(expectedHours)
  })

  it("produces separate buckets for the same hour on different days", () => {
    // isoAt(0) = Monday, isoAt(1) = Tuesday
    const snapshots = [
      makeSnapshot({ polledAt: isoAt(0, 9), uploadedBytes: "0" }),
      makeSnapshot({ polledAt: isoAt(0, 10), uploadedBytes: String(GiB) }),
      makeSnapshot({ polledAt: isoAt(1, 9), uploadedBytes: String(GiB) }),
      makeSnapshot({ polledAt: isoAt(1, 10), uploadedBytes: String(3 * GiB) }),
    ]

    const result = computeHourlyUploadAverages(snapshots)

    expect(result).toHaveLength(2)
    const days = result.map((b) => b.day).sort((a, b) => a - b)
    // Both are hour 10, different days-of-week
    expect(days[0]).not.toBe(days[1])
  })

  it("sorts snapshots by polledAt before computing deltas", () => {
    // Provide snapshots in reversed order — the function must sort them first
    const snapshots = [
      makeSnapshot({ polledAt: isoAt(0, 10), uploadedBytes: String(GiB) }),
      makeSnapshot({ polledAt: isoAt(0, 8), uploadedBytes: "0" }),
    ]

    const result = computeHourlyUploadAverages(snapshots)

    // After sorting: 0 → GiB, so one positive delta
    expect(result).toHaveLength(1)
    expect(result[0].avgBytes).toBeCloseTo(GiB, 0)
  })

  it("handles large byte values via BigInt without precision loss", () => {
    const fourTiB = BigInt(4) * BigInt(1024 ** 4)
    const eightTiB = BigInt(8) * BigInt(1024 ** 4)

    const snapshots = [
      makeSnapshot({ polledAt: isoAt(0, 8), uploadedBytes: fourTiB.toString() }),
      makeSnapshot({ polledAt: isoAt(0, 9), uploadedBytes: eightTiB.toString() }),
    ]

    const result = computeHourlyUploadAverages(snapshots)

    expect(result).toHaveLength(1)
    const expectedDelta = Number(eightTiB - fourTiB)
    expect(result[0].avgBytes).toBeCloseTo(expectedDelta, -6)
  })

  it("skips zero-delta intervals between non-monotonic uploads", () => {
    const ts10 = isoAt(0, 10)
    const snapshots = [
      makeSnapshot({ polledAt: isoAt(0, 8), uploadedBytes: String(5 * GiB) }),
      makeSnapshot({ polledAt: isoAt(0, 9), uploadedBytes: String(5 * GiB) }),
      makeSnapshot({ polledAt: ts10, uploadedBytes: String(6 * GiB) }),
    ]

    const result = computeHourlyUploadAverages(snapshots)

    // The 8→9 interval has delta 0 and should be skipped
    expect(result).toHaveLength(1)
    expect(result[0].hour).toBe(new Date(ts10).getHours())
    expect(result[0].avgBytes).toBeCloseTo(GiB, 0)
  })
})
