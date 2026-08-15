// src/components/charts/__tests__/MetricChart.test.tsx
//
// Issues #154 and #172: an account with uploads and zero downloads has a
// mathematically infinite ratio. JSON cannot carry Infinity, so `ratio` arrives
// as null and every point was filtered out — the Ratio chart rendered a bare
// grid that looked exactly like having no data at all, for precisely the
// accounts those issues were filed about.
//
// Infinity genuinely cannot be plotted on a linear or log axis, so the fix is
// not to plot it. It is to stop the chart lying about why it is empty.

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: () => <div data-testid="chart" />,
}))

import { MetricChart } from "@/components/charts/MetricChart"
import type { Snapshot } from "@/types/api"

function snap(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    polledAt: "2026-08-01T00:00:00.000Z",
    uploadedBytes: "1000000000",
    downloadedBytes: "500000000",
    ratio: 2,
    ratioIsInfinite: false,
    bufferBytes: "500000000",
    seedbonus: null,
    seedingCount: null,
    leechingCount: null,
    hitAndRuns: null,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
    shareScore: null,
    username: null,
    group: null,
    isManual: false,
    ...overrides,
  }
}

const infinite = (polledAt: string) =>
  snap({ polledAt, ratio: null, ratioIsInfinite: true, downloadedBytes: "0" })

describe("MetricChart — ratio", () => {
  it("says the ratio is infinite rather than rendering an empty grid", () => {
    render(
      <MetricChart
        metric="ratio"
        snapshots={[infinite("2026-08-01T00:00:00.000Z"), infinite("2026-08-02T00:00:00.000Z")]}
        accentColor="#22c55e"
      />
    )

    expect(screen.getByText(/Ratio is infinite/i)).toBeInTheDocument()
    // ...and does not fall through to a chart with nothing in it.
    expect(screen.queryByTestId("chart")).not.toBeInTheDocument()
  })

  it("does not confuse an infinite ratio with missing data", () => {
    render(<MetricChart metric="ratio" snapshots={[]} accentColor="#22c55e" />)

    expect(screen.getByText(/No snapshot data yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/Ratio is infinite/i)).not.toBeInTheDocument()
  })

  it("still charts finite ratios normally", () => {
    render(
      <MetricChart
        metric="ratio"
        snapshots={[snap(), snap({ polledAt: "2026-08-02T00:00:00.000Z", ratio: 3 })]}
        accentColor="#22c55e"
      />
    )

    expect(screen.getByTestId("chart")).toBeInTheDocument()
    expect(screen.queryByText(/Ratio is infinite/i)).not.toBeInTheDocument()
  })
})
