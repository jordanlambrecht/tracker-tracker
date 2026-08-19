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
import userEvent from "@testing-library/user-event"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import {
  BufferCandlestickChart,
  computeCandlestickData,
} from "@/components/charts/BufferCandlestickChart"
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

// Buffer is signed, so a candle can straddle zero — an account that crosses from
// surplus into deficit within a day is exactly the movement this chart exists to
// show.
describe("BufferCandlestickChart with a signed buffer", () => {
  beforeEach(() => {
    optionSpy.mockClear()
  })

  it("orders OHLC correctly over a series that crosses zero", () => {
    const { ohlc } = computeCandlestickData(
      [
        snap("2026-08-01T12:00:00.000Z", 2),
        snap("2026-08-01T13:00:00.000Z", -3),
        snap("2026-08-01T14:00:00.000Z", 5),
        snap("2026-08-01T15:00:00.000Z", -1),
      ],
      1
    )

    // [open, close, low, high] — open/close are first/last chronologically,
    // low/high are the true extremes across the sign change.
    expect(ohlc).toHaveLength(1)
    expect(ohlc[0]).toEqual([2, -1, -3, 5])

    const [open, close, low, high] = ohlc[0]
    expect(high).toBeGreaterThanOrEqual(low)
    expect(low).toBeLessThanOrEqual(Math.min(open, close))
    expect(high).toBeGreaterThanOrEqual(Math.max(open, close))
  })

  it("keeps an all-negative day's candle below zero and correctly ordered", () => {
    const { ohlc } = computeCandlestickData(
      [
        snap("2026-08-01T12:00:00.000Z", -1),
        snap("2026-08-01T13:00:00.000Z", -8),
        snap("2026-08-01T14:00:00.000Z", -4),
      ],
      1
    )

    expect(ohlc[0]).toEqual([-1, -4, -8, -1])
  })

  it("sorts snapshots before reading open and close", () => {
    // Out-of-order input must not invert the candle body.
    const { ohlc } = computeCandlestickData(
      [
        snap("2026-08-01T15:00:00.000Z", -1),
        snap("2026-08-01T12:00:00.000Z", 2),
        snap("2026-08-01T13:00:00.000Z", -3),
      ],
      1
    )

    expect(ohlc[0]).toEqual([2, -1, -3, 2])
  })

  it("withholds the log toggle and stays linear when any value is non-positive", () => {
    // A log axis cannot plot a non-positive value; its min/max here come from
    // positive values alone, so a deficit candle would be dropped while the
    // axis quietly rescaled around what was left.
    render(
      <BufferCandlestickChart
        trackerData={series([
          snap("2026-08-01T12:00:00.000Z", 5),
          snap("2026-08-02T12:00:00.000Z", -3),
        ])}
      />
    )

    expect(screen.queryByText("Linear")).not.toBeInTheDocument()
    expect(screen.queryByText("Log")).not.toBeInTheDocument()

    const option = optionSpy.mock.calls.at(-1)?.[0] as { yAxis?: { type?: string } }
    expect(option.yAxis?.type).toBe("value")
  })

  it("drops a forced log axis when new data turns negative", async () => {
    // useLogScale keeps the user's override in state, so forcing log on while
    // everything was positive would otherwise survive the arrival of a negative
    // snapshot — dropping the candle that just went into deficit, with the
    // toggle now unmounted and no way to turn it back off.
    const user = userEvent.setup()
    const positives = series([
      snap("2026-08-01T12:00:00.000Z", 5),
      snap("2026-08-02T12:00:00.000Z", 9),
    ])

    const { rerender } = render(<BufferCandlestickChart trackerData={positives} />)
    await user.click(screen.getByRole("button", { name: /Linear|Log/ }))

    const forced = optionSpy.mock.calls.at(-1)?.[0] as { yAxis?: { type?: string } }
    expect(forced.yAxis?.type).toBe("log")

    rerender(
      <BufferCandlestickChart
        trackerData={series([
          snap("2026-08-01T12:00:00.000Z", 5),
          snap("2026-08-02T12:00:00.000Z", -9),
        ])}
      />
    )

    const after = optionSpy.mock.calls.at(-1)?.[0] as { yAxis?: { type?: string } }
    expect(after.yAxis?.type).toBe("value")
    expect(screen.queryByRole("button", { name: /Linear|Log/ })).not.toBeInTheDocument()
  })

  it("scales an all-negative series by magnitude rather than labelling it GiB", () => {
    // Max is below zero for a deficit account, so a max-based divisor would
    // render -2.4 TiB as -2446 GiB.
    render(
      <BufferCandlestickChart
        trackerData={series([
          snap("2026-08-01T12:00:00.000Z", -2048),
          snap("2026-08-02T12:00:00.000Z", -3072),
        ])}
      />
    )

    const option = optionSpy.mock.calls.at(-1)?.[0] as {
      yAxis?: { name?: string }
      series?: Array<{ data?: Candle[] }>
    }
    expect(option.yAxis?.name).toBe("TiB")
    // -2048 GiB is -2 TiB once the divisor is applied.
    expect(option.series?.[0]?.data?.[0]?.[1]).toBe(-2)
  })
})
