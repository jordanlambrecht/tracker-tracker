// src/components/charts/__tests__/comparison-viewmode.test.tsx
//
// Reproduces issue #156: "Click Stacked, then click Per-Tracker — the view
// stays stacked."

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as echarts from "echarts"
import { describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import { buildComparisonOption, ComparisonChart } from "@/components/charts/ComparisonChart"

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

// The option-level assertion above passes even when the chart on screen is
// still stacked: ECharts merges, so what matters is not what the new option
// says but what survives the merge. These drive a real instance and read the
// answer back off it. jsdom has no 2D canvas context, so the SVG renderer and
// an explicit size are both required for init to produce a usable chart.
describe("ComparisonChart view mode against a real ECharts instance (issue #156)", () => {
  function optionFor(stacked: boolean) {
    // biome-ignore lint/suspicious/noExplicitAny: fixture trimmed to what the chart reads
    return buildComparisonOption("uploaded", trackerData as any, { stacked })
  }

  function withChart(run: (chart: echarts.ECharts) => void) {
    const el = document.createElement("div")
    document.body.appendChild(el)
    const chart = echarts.init(el, null, { renderer: "svg", width: 400, height: 300 })
    try {
      run(chart)
    } finally {
      chart.dispose()
      el.remove()
    }
  }

  function mergedSeries(chart: echarts.ECharts) {
    return (chart.getOption() as { series: Array<Record<string, unknown>> }).series
  }

  it("drops the stack and the filled area when switching stacked -> lines", () => {
    withChart((chart) => {
      chart.setOption(optionFor(true))
      chart.setOption(optionFor(false), { notMerge: false })

      for (const s of mergedSeries(chart)) {
        expect(s.stack).toBeFalsy()
        expect(s.areaStyle).toBeFalsy()
      }
    })
  })

  it("drops the line glow when switching lines -> stacked", () => {
    withChart((chart) => {
      chart.setOption(optionFor(false))
      chart.setOption(optionFor(true), { notMerge: false })

      for (const s of mergedSeries(chart)) {
        const lineStyle = s.lineStyle as { shadowColor?: unknown; shadowBlur?: unknown }
        expect(lineStyle.shadowColor).toBeFalsy()
        expect(lineStyle.shadowBlur).toBeFalsy()

        // Nested one level down: emphasis merges as well, so an emphasis that
        // omits lineStyle leaves the hover glow painted on the stacked view.
        const emphasis = s.emphasis as { lineStyle?: { shadowColor?: unknown; shadowBlur?: unknown } }
        expect(emphasis.lineStyle?.shadowColor).toBeFalsy()
        expect(emphasis.lineStyle?.shadowBlur).toBeFalsy()
      }
    })
  })

  it("still reads as a changed option to ChartECharts' JSON.stringify guard", () => {
    // defaultShouldSetOption skips setOption when the serialised options match,
    // and JSON.stringify drops undefined-valued keys — so the clearing values
    // alone are invisible to it. The toggle must differ elsewhere too or the
    // fix above would never be applied.
    expect(JSON.stringify(optionFor(true))).not.toBe(JSON.stringify(optionFor(false)))
  })
})
