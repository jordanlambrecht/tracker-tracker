// src/components/charts/__tests__/metric-log-axis.test.tsx
//
// Issue #36: the buffer chart's log view had a broken range. Buffer is a
// signed quantity, and a log axis cannot represent 0 or negative values.

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import { METRIC_CONFIGS, MetricChart } from "@/components/charts/MetricChart"

// Buffer legitimately crosses zero: you can owe more than you've uploaded.
const snapshots = [
  { polledAt: "2026-08-01T00:00:00.000Z", bufferBytes: "-5000000000", ratio: 0.5 },
  { polledAt: "2026-08-02T00:00:00.000Z", bufferBytes: "0", ratio: 1 },
  { polledAt: "2026-08-03T00:00:00.000Z", bufferBytes: "10000000000", ratio: 2 },
]

describe("log axis (issue #36)", () => {
  it("declares buffer as a signed metric", () => {
    expect(METRIC_CONFIGS.buffer.allowNegative).toBe(true)
  })

  it("does not offer a log toggle for buffer", () => {
    optionSpy.mockClear()
    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<MetricChart metric="buffer" snapshots={snapshots as any} accentColor="#00ff00" />)

    // The toggle is the only control that would put a log axis under a
    // metric that goes negative.
    expect(screen.queryByText(/log/i)).toBeNull()
  })

  it("keeps the buffer axis linear so negative values still plot", () => {
    optionSpy.mockClear()
    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<MetricChart metric="buffer" snapshots={snapshots as any} accentColor="#00ff00" />)

    const option = optionSpy.mock.calls.at(-1)?.[0] as { yAxis?: { type?: string } }
    expect(option?.yAxis?.type).toBe("value")
  })
})
