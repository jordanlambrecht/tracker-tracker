// src/components/charts/VolumeSurface2D.test.tsx
//
// Issue #38: the 2D substitute rendered when "Enable 3D charts" is off.
// The point of the component is that it draws the same data without ever
// asking for a WebGL context, so the option shape is what these tests guard.

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import { VolumeSurface2D } from "@/components/charts/VolumeSurface2D"

function snapshot(polledAt: string, uploadedBytes: string, downloadedBytes: string) {
  return { polledAt, uploadedBytes, downloadedBytes, bufferBytes: "0", isManual: false }
}

const GIB = 1024 ** 3

const trackerData = [
  {
    name: "Alpha",
    color: "#ff0000",
    snapshots: [
      snapshot("2026-08-01T12:00:00.000Z", "0", "0"),
      snapshot("2026-08-02T12:00:00.000Z", String(2 * GIB), String(GIB)),
    ],
  },
  {
    name: "Beta",
    color: "#00ff00",
    snapshots: [
      snapshot("2026-08-01T12:00:00.000Z", "0", "0"),
      snapshot("2026-08-02T12:00:00.000Z", String(4 * GIB), String(GIB)),
    ],
  },
]

interface HeatmapOption {
  series?: Array<{ type?: string; data?: [number, number, number][] }>
  xAxis?: { data?: string[] }
  yAxis?: { data?: string[] }
  visualMap?: { max?: number }
}

function lastOption(): HeatmapOption {
  return optionSpy.mock.calls.at(-1)?.[0] as HeatmapOption
}

describe("VolumeSurface2D", () => {
  it("shows the same empty state as the 3D chart when no tracker has two snapshots", () => {
    optionSpy.mockClear()
    const single = [
      {
        name: "Alpha",
        color: "#ff0000",
        snapshots: [snapshot("2026-08-01T12:00:00.000Z", "0", "0")],
      },
    ]

    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<VolumeSurface2D trackerData={single as any} />)

    expect(screen.getByText("Need at least 2 days of data across trackers.")).toBeInTheDocument()
    expect(optionSpy).not.toHaveBeenCalled()
  })

  it("puts trackers on one axis and date buckets on the other", () => {
    optionSpy.mockClear()
    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<VolumeSurface2D trackerData={trackerData as any} />)

    const option = lastOption()
    expect(option.yAxis?.data).toEqual(["Alpha", "Beta"])
    expect(option.xAxis?.data).toHaveLength(2)
  })

  it("emits one heatmap cell per tracker/bucket pair, carrying upload volume as the value", () => {
    optionSpy.mockClear()
    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<VolumeSurface2D trackerData={trackerData as any} />)

    const option = lastOption()
    expect(option.series?.[0]?.type).toBe("heatmap")

    const cells = option.series?.[0]?.data ?? []
    // 2 trackers x 2 day buckets — zero cells included so the grid stays complete
    expect(cells).toHaveLength(4)

    // Day 1 has no previous day to diff against, so only day 2 carries volume.
    const alphaDay2 = cells.find(([bi, ti]) => bi === 1 && ti === 0)
    const betaDay2 = cells.find(([bi, ti]) => bi === 1 && ti === 1)
    expect(alphaDay2?.[2]).toBe(2)
    expect(betaDay2?.[2]).toBe(4)
  })

  it("never emits WebGL option keys — that is the whole reason this chart exists", () => {
    optionSpy.mockClear()
    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<VolumeSurface2D trackerData={trackerData as any} />)

    const keys = Object.keys(lastOption())
    expect(keys).not.toContain("grid3D")
    expect(keys).not.toContain("xAxis3D")
    expect(keys).not.toContain("yAxis3D")
    expect(keys).not.toContain("zAxis3D")
    expect(lastOption().series?.[0]?.type).not.toBe("bar3D")
  })
})
