// src/components/charts/__tests__/ParallelTorrentsChart.test.tsx
//
// The ratio axis is linear, so qBittorrent's -1 infinite ratio has no point on
// it. The chart draws it at the top of a finite axis and the tooltip still says
// infinity. The test captures the option handed to ChartECharts, as
// DistributionChart's does.

import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import { ParallelTorrentsChart } from "@/components/charts/ParallelTorrentsChart"

const DAY = 86400
const now = Math.floor(Date.now() / 1000)

interface ParallelOption {
  parallelAxis: { name: string; max: number }[]
  series: { data: number[][] }[]
  tooltip: { formatter: (params: unknown) => string }
}

function renderRatios(ratios: number[]): ParallelOption {
  const torrents = ratios.map((ratio) => ({
    addedAt: now - 10 * DAY,
    seedingTime: 5 * DAY,
    size: 1024 ** 3,
    seedCount: 4,
    availability: 1,
    ratio,
  }))
  // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
  render(<ParallelTorrentsChart torrents={torrents as any} trackerColor="#00d4ff" />)
  return optionSpy.mock.calls.at(-1)?.[0] as ParallelOption
}

describe("ParallelTorrentsChart ratio axis", () => {
  it("draws a -1 infinite ratio at the top of an axis sized by the finite ratios", () => {
    const option = renderRatios([0, 2, -1])
    const axis = option.parallelAxis[1]
    expect(axis.name).toBe("Ratio")
    // 2 plus the chart's 10% headroom
    expect(axis.max).toBeCloseTo(2.2)
    expect(option.series[0].data.map((row) => row[1])).toEqual([0, 2, axis.max])
  })

  it("shows the infinite ratio in the tooltip, not the axis top it is drawn at", () => {
    const option = renderRatios([0, 2, -1])
    const html = option.tooltip.formatter({ dataIndex: 2, data: option.series[0].data[2] })
    expect(html).toContain("∞")
    expect(html).not.toContain("2.20")
  })
})
