// src/components/charts/__tests__/comparison-buffer-negative.test.tsx
//
// Buffer is signed. This chart used to pin its axis floor to zero and, on the
// log path, drop every non-positive point, so a tracker sliding into deficit
// vanished from the fleet comparison instead of being the thing you came to
// look at.

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import { buildComparisonOption, ComparisonChart } from "@/components/charts/ComparisonChart"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"

const GIB = 1024 ** 3

function snap(polledAt: string, bufferGiB: number): Snapshot {
  return {
    polledAt,
    bufferBytes: String(BigInt(bufferGiB) * BigInt(GIB)),
  } as unknown as Snapshot
}

function series(snapshots: Snapshot[]): TrackerSnapshotSeries[] {
  return [{ name: "Deficit Tracker", color: "#00ff00", snapshots }]
}

type YAxis = { min?: unknown; max?: unknown; type?: string; name?: string }

describe("ComparisonChart with a signed buffer", () => {
  it("leaves the y-axis floor open for the buffer metric", () => {
    const option = buildComparisonOption(
      "buffer",
      series([snap("2026-08-01T00:00:00.000Z", -5), snap("2026-08-02T00:00:00.000Z", -9)])
    )

    // allowNegative leaves min undefined so ECharts auto-scales below zero.
    // A min callback here would clamp the floor to 0 and clip every point.
    expect((option.yAxis as YAxis).min).toBeUndefined()
  })

  it("still pins non-negative metrics to a zero floor", () => {
    const option = buildComparisonOption("uploaded", [
      {
        name: "Alpha",
        color: "#ff0000",
        snapshots: [
          { polledAt: "2026-08-01T00:00:00.000Z", uploadedBytes: String(GIB) },
          { polledAt: "2026-08-02T00:00:00.000Z", uploadedBytes: String(2 * GIB) },
        ] as unknown as Snapshot[],
      },
    ])

    expect(typeof (option.yAxis as YAxis).min).toBe("function")
  })

  it("plots every negative point rather than dropping it", () => {
    const option = buildComparisonOption(
      "buffer",
      series([snap("2026-08-01T00:00:00.000Z", -5), snap("2026-08-02T00:00:00.000Z", -9)])
    )

    const data = (option.series as Array<{ data: [number, number][] }>)[0].data
    expect(data).toHaveLength(2)
    expect(data.map(([, v]) => v)).toEqual([-5, -9])
  })

  it("scales an all-negative fleet by magnitude rather than labelling it GiB", () => {
    const option = buildComparisonOption(
      "buffer",
      series([snap("2026-08-01T00:00:00.000Z", -2048), snap("2026-08-02T00:00:00.000Z", -3072)])
    )

    expect((option.yAxis as YAxis).name).toBe("TiB")
    const data = (option.series as Array<{ data: [number, number][] }>)[0].data
    expect(data[0][1]).toBe(-2)
  })

  it("offers no log toggle on the fleet buffer comparison", () => {
    // A log axis cannot represent a non-positive value, so the buffer view is
    // rendered without enableLogScale, matching MetricChart's issue-#36 call.
    optionSpy.mockClear()
    render(
      <ComparisonChart
        metric="buffer"
        trackerData={series([
          snap("2026-08-01T00:00:00.000Z", -5),
          snap("2026-08-02T00:00:00.000Z", -9),
        ])}
      />
    )

    expect(screen.queryByText("Linear")).not.toBeInTheDocument()
    expect(screen.queryByText("Log")).not.toBeInTheDocument()

    const option = optionSpy.mock.calls.at(-1)?.[0] as { yAxis?: YAxis }
    expect(option.yAxis?.type).toBe("value")
  })
})
