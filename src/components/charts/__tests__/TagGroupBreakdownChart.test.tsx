// src/components/charts/__tests__/TagGroupBreakdownChart.test.tsx
//
// Tag-group charts render torrent COUNTS, and every count slot used to print the
// raw number, a fleet with 12345 matching torrents showed "12345". The numbers
// mode of this same component already used formatCount(), so the bar/donut/treemap
// modes were the odd ones out.
//
// The formatters live inside module-private option builders, so these tests reach
// them the way comparison-viewmode.test.tsx does: capture the option object handed
// to ChartECharts, then invoke the formatter callbacks directly.

import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import { TagGroupBreakdownChart } from "@/components/charts/TagGroupBreakdownChart"
import type { TagGroupChartType } from "@/types/api"

const members = [
  { label: "1080p", count: 12345, color: "#ff0000" },
  { label: "2160p", count: 987, color: "#00ff00" },
]

type Formatter = (params: unknown) => string

/** Renders the chart and returns the option object handed to ECharts. */
function optionFor(chartType: TagGroupChartType): Record<string, never> {
  optionSpy.mockClear()
  render(
    <TagGroupBreakdownChart
      groupName="Resolution"
      members={members}
      accentColor="#22c55e"
      chartType={chartType}
    />
  )
  return optionSpy.mock.calls.at(-1)?.[0]
}

// biome-ignore lint/suspicious/noExplicitAny: reaching into ECharts option internals
function series(option: any) {
  return option.series[0]
}

// biome-ignore lint/suspicious/noExplicitAny: reaching into ECharts option internals
function tooltipFormatter(option: any): Formatter {
  return option.tooltip.formatter as Formatter
}

// biome-ignore lint/suspicious/noExplicitAny: reaching into ECharts option internals
function labelFormatter(option: any): Formatter {
  return series(option).label.formatter as Formatter
}

describe("TagGroupBreakdownChart — thousand separators", () => {
  beforeEach(() => optionSpy.mockClear())

  describe("bar", () => {
    it("separates thousands in the tooltip", () => {
      const option = optionFor("bar")
      // Axis tooltips receive an array of series params.
      expect(tooltipFormatter(option)([{ name: "1080p", value: 12345 }])).toContain("12,345")
    })

    it("separates thousands in the data label", () => {
      const option = optionFor("bar")
      expect(labelFormatter(option)({ value: 12345 })).toBe("12,345")
    })

    it("separates thousands on the value axis", () => {
      // biome-ignore lint/suspicious/noExplicitAny: reaching into ECharts option internals
      const option = optionFor("bar") as any
      const axis = option.xAxis.axisLabel.formatter as (v: number) => string
      expect(axis(20000)).toBe("20,000")
    })

    it("rounds fractional axis ticks rather than showing decimals on integer counts", () => {
      // biome-ignore lint/suspicious/noExplicitAny: reaching into ECharts option internals
      const option = optionFor("bar") as any
      const axis = option.xAxis.axisLabel.formatter as (v: number) => string
      expect(axis(1234.5)).toBe("1,235")
    })

    it("leaves counts under a thousand unpunctuated", () => {
      const option = optionFor("bar")
      expect(labelFormatter(option)({ value: 987 })).toBe("987")
    })
  })

  describe("donut", () => {
    it("separates thousands in the tooltip while keeping the percentage", () => {
      const option = optionFor("donut")
      const out = tooltipFormatter(option)({ name: "1080p", value: 12345, percent: 42 })
      expect(out).toContain("12,345")
      expect(out).toContain("42%")
    })

    it("separates thousands in the slice label", () => {
      const option = optionFor("donut")
      expect(labelFormatter(option)({ name: "1080p", value: 12345 })).toBe("1080p: 12,345")
    })
  })

  describe("treemap", () => {
    it("separates thousands in the tooltip", () => {
      const option = optionFor("treemap")
      expect(tooltipFormatter(option)({ name: "1080p", value: 12345 })).toContain("12,345")
    })

    it("separates thousands in the tile label", () => {
      const option = optionFor("treemap")
      expect(labelFormatter(option)({ name: "1080p", value: 12345 })).toBe("1080p\n12,345")
    })
  })
})
