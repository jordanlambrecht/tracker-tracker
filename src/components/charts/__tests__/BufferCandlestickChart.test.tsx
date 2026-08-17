// src/components/charts/__tests__/BufferCandlestickChart.test.tsx
//
// The candlestick chart used to bucket snapshots by `polledAt.slice(0, 10)`,
// i.e. the UTC calendar date. Every neighbouring chart buckets with
// localDateStr(), so in any negative-offset zone the candlestick silently
// disagreed with them: under TZ=America/Chicago a snapshot polled at 18:00-23:59
// local carries a next-day UTC date and landed in the wrong candle.
//
// These tests pin the boundary. The fixture timestamps are chosen so the local
// date is the same under CST (-6) and CDT (-5), so the assertions do not depend
// on which side of a DST transition the fixture sits.

import { render, screen } from "@testing-library/react"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import { BufferCandlestickChart } from "@/components/charts/BufferCandlestickChart"
import { localDateStr } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"

const GIB = 1024 ** 3

/** Minimal snapshot: the candlestick chart only reads polledAt and bufferBytes. */
function snap(polledAt: string, bufferGiB: number): Snapshot {
  return {
    polledAt,
    bufferBytes: String(BigInt(bufferGiB) * BigInt(GIB)),
  } as unknown as Snapshot
}

function series(snapshots: Snapshot[]): TrackerSnapshotSeries[] {
  return [{ name: "Tracker A", color: "#00ff00", snapshots }]
}

/** Time-axis candlestick tuple: [timestamp, open, close, low, high]. */
type Candle = [number, number, number, number, number]

function lastCandles(): Candle[] {
  const option = optionSpy.mock.calls.at(-1)?.[0] as {
    series?: Array<{ data?: Candle[] }>
  }
  return option?.series?.[0]?.data ?? []
}

describe("BufferCandlestickChart day bucketing (TZ=America/Chicago)", () => {
  const originalTz = process.env.TZ

  beforeAll(() => {
    // Node re-reads the zone on assignment, and every Date/Intl call in the
    // chart happens at render time, so setting it here is enough.
    process.env.TZ = "America/Chicago"
  })

  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  })

  beforeEach(() => {
    optionSpy.mockClear()
  })

  it("buckets a late-evening snapshot into the local day, not the UTC day", () => {
    // 18:00Z -> 13:00 local Aug 1
    // 02:00Z Aug 2 -> 21:00 local Aug 1  (UTC would say Aug 2)
    // 02:00Z Aug 3 -> 21:00 local Aug 2  (UTC would say Aug 3)
    render(
      <BufferCandlestickChart
        trackerData={series([
          snap("2026-08-01T18:00:00.000Z", 1),
          snap("2026-08-02T02:00:00.000Z", 3),
          snap("2026-08-03T02:00:00.000Z", 2),
        ])}
      />
    )

    const candles = lastCandles()

    // UTC bucketing would produce three single-snapshot candles.
    expect(candles).toHaveLength(2)
    expect(candles.map(([ts]) => localDateStr(new Date(ts)))).toEqual(["2026-08-01", "2026-08-02"])
  })

  it("merges two snapshots that share a local day into one open/close candle", () => {
    render(
      <BufferCandlestickChart
        trackerData={series([
          snap("2026-08-01T18:00:00.000Z", 1),
          snap("2026-08-02T02:00:00.000Z", 3),
          snap("2026-08-03T02:00:00.000Z", 2),
        ])}
      />
    )

    const [firstDay, secondDay] = lastCandles()

    // Buffers are single-digit GiB, so autoByteScale keeps the divisor at 1.
    // [ts, open, close, low, high]
    expect(firstDay.slice(1)).toEqual([1, 3, 1, 3])
    expect(secondDay.slice(1)).toEqual([2, 2, 2, 2])
  })

  it("does not count a UTC-midnight straddle as a second day", () => {
    // Both land on local Aug 1; UTC slicing would see Aug 1 and Aug 2 and
    // wrongly satisfy the two-day minimum.
    render(
      <BufferCandlestickChart
        trackerData={series([
          snap("2026-08-01T18:00:00.000Z", 1),
          snap("2026-08-02T02:00:00.000Z", 3),
        ])}
      />
    )

    expect(screen.getByText(/Need at least 2 days of snapshots/)).toBeInTheDocument()
    expect(optionSpy).not.toHaveBeenCalled()
  })
})
