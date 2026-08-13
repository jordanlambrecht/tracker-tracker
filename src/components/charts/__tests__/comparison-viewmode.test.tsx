// src/components/charts/__tests__/comparison-viewmode.test.tsx
//
// Reproduces issue #156: "Click Stacked, then click Per-Tracker — the view
// stays stacked."

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

import { ComparisonChart } from "@/components/charts/ComparisonChart"

const trackerData = [
  {
    id: 1,
    name: "Alpha",
    color: "#ff0000",
    snapshots: [
      { polledAt: "2026-08-01T00:00:00.000Z", uploadedBytes: "100", downloadedBytes: "50" },
      { polledAt: "2026-08-02T00:00:00.000Z", uploadedBytes: "200", downloadedBytes: "60" },
    ],
  },
]

describe("ComparisonChart view mode (issue #156)", () => {
  it("returns to per-tracker lines after switching to stacked", async () => {
    const user = userEvent.setup()
    optionSpy.mockClear()

    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    render(<ComparisonChart metric="uploaded" trackerData={trackerData as any} enableStacked />)

    // eslint-disable-next-line no-console
    await user.click(screen.getByRole("tab", { name: "Stacked" }))
    await user.click(screen.getByRole("tab", { name: "Lines" }))

    const lastOption = optionSpy.mock.calls.at(-1)?.[0] as { series?: Array<{ stack?: string }> }
    const stackedSeries = (lastOption?.series ?? []).filter((s) => s.stack)
    expect(stackedSeries).toHaveLength(0)
  })

  it("does not present two different controls both labelled Per-Tracker", async () => {
    optionSpy.mockClear()
    render(
      // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
      <ComparisonChart metric="uploaded" trackerData={trackerData as any} enableStacked enableAverage />
    )

    // The average toggle and the view-mode tab used to share this label, so a
    // user aiming for the view-mode control could hit the averaging one and
    // see nothing change (issue #156).
    const perTracker = screen.queryAllByText("Per-Tracker")
    expect(perTracker.length).toBeLessThanOrEqual(1)
  })

})
