// src/components/charts/TorrentAgeScatter2D.test.tsx
//
// Issue #38: the 2D substitute rendered when "Enable 3D charts" is off.
// It has to keep both view presets and all four dimensions of the 3D chart.
// The depth axis becomes symbol size and the fourth dimension keeps its
// visualMap colour scale without ever asking for a WebGL context.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import { TorrentAgeScatter2D } from "@/components/charts/TorrentAgeScatter2D"

const DAY = 86400
const GIB = 1024 ** 3
const now = Math.floor(Date.now() / 1000)

const torrents = [
  { addedAt: now - 10 * DAY, seedingTime: 5 * DAY, size: 2 * GIB, ratio: 1.5 },
  { addedAt: now - 40 * DAY, seedingTime: 30 * DAY, size: 8 * GIB, ratio: 3.25 },
  // ratio is capped at 10 by the chart, matching the 3D version
  { addedAt: now - 90 * DAY, seedingTime: 80 * DAY, size: 1 * GIB, ratio: 42 },
]

interface ScatterOption {
  dataset?: { source?: number[][] }
  series?: Array<{ type?: string; encode?: { x?: number; y?: number }; symbolSize?: unknown }>
  visualMap?: { dimension?: number; max?: number }
  xAxis?: { name?: string }
  yAxis?: { name?: string }
}

function lastOption(): ScatterOption {
  return optionSpy.mock.calls.at(-1)?.[0] as ScatterOption
}

describe("TorrentAgeScatter2D", () => {
  it("shows the same empty state as the 3D chart when there are no torrents", () => {
    optionSpy.mockClear()
    render(<TorrentAgeScatter2D torrents={[]} accentColor="#00d4ff" />)

    expect(screen.getByText("No torrent data available")).toBeInTheDocument()
    expect(optionSpy).not.toHaveBeenCalled()
  })

  it("keeps all four dimensions per torrent instead of flattening to x/y", () => {
    optionSpy.mockClear()
    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<TorrentAgeScatter2D torrents={torrents as any} accentColor="#00d4ff" />)

    const rows = lastOption().dataset?.source ?? []
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row).toHaveLength(4)
    }
    // [age, seedTime, sizeGiB, ratio]
    expect(rows[0]).toEqual([10, 5, 2, 1.5])
    expect(rows[2][3]).toBe(10)
  })

  it("maps the third dimension to symbol size rather than dropping it", () => {
    optionSpy.mockClear()
    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<TorrentAgeScatter2D torrents={torrents as any} accentColor="#00d4ff" />)

    const symbolSize = lastOption().series?.[0]?.symbolSize
    expect(typeof symbolSize).toBe("function")

    const sizeFn = symbolSize as (value: number[]) => number
    const smallest = sizeFn([90, 80, 1, 10])
    const largest = sizeFn([40, 30, 8, 3.25])
    expect(largest).toBeGreaterThan(smallest)
    expect(smallest).toBeGreaterThan(0)
  })

  it("switches both axes and the colour dimension between the two presets", async () => {
    const user = userEvent.setup()
    optionSpy.mockClear()
    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<TorrentAgeScatter2D torrents={torrents as any} accentColor="#00d4ff" />)

    const ageSeed = lastOption()
    expect(ageSeed.xAxis?.name).toBe("Age (days)")
    expect(ageSeed.yAxis?.name).toBe("Seed Time (days)")
    expect(ageSeed.series?.[0]?.encode).toEqual({ x: 0, y: 1 })
    expect(ageSeed.visualMap?.dimension).toBe(3)

    await user.click(screen.getByRole("button", { name: "Seed Time vs Ratio" }))

    const seedRatio = lastOption()
    expect(seedRatio.xAxis?.name).toBe("Seed Time (days)")
    expect(seedRatio.yAxis?.name).toBe("Ratio")
    expect(seedRatio.series?.[0]?.encode).toEqual({ x: 1, y: 3 })
    expect(seedRatio.visualMap?.dimension).toBe(0)

    // Switching presets re-encodes the same rows. No data is discarded.
    expect(seedRatio.dataset?.source).toHaveLength(3)
  })

  it("never emits WebGL option keys — that is the whole reason this chart exists", () => {
    optionSpy.mockClear()
    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<TorrentAgeScatter2D torrents={torrents as any} accentColor="#00d4ff" />)

    const keys = Object.keys(lastOption())
    expect(keys).not.toContain("grid3D")
    expect(keys).not.toContain("xAxis3D")
    expect(keys).not.toContain("yAxis3D")
    expect(keys).not.toContain("zAxis3D")
    expect(lastOption().series?.[0]?.type).toBe("scatter")
  })
})
