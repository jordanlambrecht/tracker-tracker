// src/components/charts/__tests__/DistributionChart.test.tsx
//
// The parallel view's axes are log scale from 0.01, so their ticks are powers of
// ten. A fixed decimal count prints two of them alike ("0%" twice when whole,
// "0.0%" for 0.01 at one decimal). The label builder is module-private, so the
// test captures the option handed to ChartECharts, as TagGroupBreakdownChart's does.

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

import { DistributionChart } from "@/components/charts/DistributionChart"

const trackers = [
  { name: "Alpha", color: "#ff0000", uploadedBytes: "3000", seedingCount: 30 },
  { name: "Beta", color: "#00ff00", uploadedBytes: "1000", seedingCount: 10 },
]

type Formatter = (v: number) => string

describe("DistributionChart parallel axes", () => {
  it("labels each log tick with the digits it needs", async () => {
    const user = userEvent.setup()
    render(<DistributionChart trackers={trackers} />)
    await user.click(screen.getByRole("tab", { name: "Parallel" }))

    const option = optionSpy.mock.calls.at(-1)?.[0] as {
      parallelAxis: { axisLabel: { formatter: Formatter } }[]
    }
    const ticks = [0.01, 0.1, 1, 10, 100]
    for (const axis of option.parallelAxis) {
      expect(ticks.map(axis.axisLabel.formatter)).toEqual(["0.01%", "0.1%", "1%", "10%", "100%"])
    }
  })
})
