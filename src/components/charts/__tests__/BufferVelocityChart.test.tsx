// src/components/charts/__tests__/BufferVelocityChart.test.tsx
//
// The tooltip and axis labels take their sign from the value as displayed, so a
// day that rounds to zero reads "0.00" and not "+0.00" or "-0.00".

import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import { BufferVelocityChart } from "@/components/charts/BufferVelocityChart"
import { CHART_THEME } from "@/components/charts/lib/theme"
import type { Snapshot } from "@/types/api"

const GIB = 1024 ** 3

function snap(polledAt: string, bufferGiB: number): Snapshot {
  return {
    polledAt,
    bufferBytes: String(BigInt(bufferGiB) * BigInt(GIB)),
  } as unknown as Snapshot
}

interface CapturedOption {
  tooltip: { formatter: (params: unknown) => string }
  yAxis: { axisLabel: { formatter: (val: number) => string } }
}

function option(): CapturedOption {
  render(
    <BufferVelocityChart
      trackerData={[
        {
          name: "Tracker A",
          color: "#00ff00",
          snapshots: [snap("2026-08-01T12:00:00.000Z", 1), snap("2026-08-02T12:00:00.000Z", 3)],
        },
      ]}
    />
  )
  return optionSpy.mock.calls.at(-1)?.[0] as CapturedOption
}

function tooltip(value: number): string {
  return option().tooltip.formatter([
    { seriesName: "Tracker A", color: "#00ff00", value: [Date.UTC(2026, 7, 2), value] },
  ])
}

describe("BufferVelocityChart signs", () => {
  beforeEach(() => {
    optionSpy.mockClear()
  })

  it("colours a gain, a loss and a zero day apart", () => {
    expect(tooltip(1.5)).toContain(`color:${CHART_THEME.positive};font-weight:600;">+1.50 GiB`)
    expect(tooltip(-1.5)).toContain(`color:${CHART_THEME.negative};font-weight:600;">-1.50 GiB`)
    expect(tooltip(0)).toContain(`color:${CHART_THEME.neutral};font-weight:600;">0.00 GiB`)
  })

  it("shows a day that rounds to zero without a sign", () => {
    expect(tooltip(0.001)).toContain(`color:${CHART_THEME.neutral};font-weight:600;">0.00 GiB`)
    expect(tooltip(-0.001)).toContain(`color:${CHART_THEME.neutral};font-weight:600;">0.00 GiB`)
  })

  it("signs the axis labels the same way", () => {
    const label = option().yAxis.axisLabel.formatter
    expect(label(2)).toBe("+2.0")
    expect(label(-2)).toBe("-2.0")
    expect(label(-0.01)).toBe("0.0")
  })
})
