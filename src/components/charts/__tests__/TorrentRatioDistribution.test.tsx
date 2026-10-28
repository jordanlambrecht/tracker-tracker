// src/components/charts/__tests__/TorrentRatioDistribution.test.tsx
//
// The per-tracker path buckets raw torrents itself, so it has to place
// qBittorrent's -1 where the fleet chart does. The test captures the option
// handed to ChartECharts, as DistributionChart's does.

import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import { TorrentRatioDistribution } from "@/components/charts/TorrentRatioDistribution"

function bucketCounts(ratios: number[]): [string, number][] {
  render(<TorrentRatioDistribution torrents={ratios.map((ratio) => ({ ratio }))} />)
  const option = optionSpy.mock.calls.at(-1)?.[0] as {
    xAxis: { data: string[] }
    series: { data: { value: number }[] }[]
  }
  return option.xAxis.data.map((label, i) => [label, option.series[0].data[i].value])
}

describe("TorrentRatioDistribution per-tracker buckets", () => {
  it("counts a ratio=-1 torrent in the top bucket", () => {
    expect(bucketCounts([-1])).toEqual([
      ["<0.5", 0],
      ["0.5-1", 0],
      ["1-2", 0],
      ["2-5", 0],
      ["5-10", 0],
      ["10+", 1],
    ])
  })

  it("leaves any other negative ratio in the bottom bucket", () => {
    expect(bucketCounts([-0.5])).toEqual([
      ["<0.5", 1],
      ["0.5-1", 0],
      ["1-2", 0],
      ["2-5", 0],
      ["5-10", 0],
      ["10+", 0],
    ])
  })
})
