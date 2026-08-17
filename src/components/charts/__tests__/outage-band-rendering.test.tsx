// src/components/charts/__tests__/outage-band-rendering.test.tsx
//
// End-to-end for the render path: a recorded gap reaches the ECharts option as
// a markArea, an UNKNOWN window reaches it as nothing, the toggle empties it,
// and a tracker-sourced chart never receives a download-client band.
//
// These drive the REAL context rather than a mocked hook, so the scoping rule
// is exercised through the same code the app runs.

import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

const optionSpy = vi.fn()
vi.mock("@/components/charts/lib/ChartECharts", () => ({
  ChartECharts: (props: { option: unknown }) => {
    optionSpy(props.option)
    return <div data-testid="chart" />
  },
}))

import {
  OutageBandsContext,
  type OutageBandsValue,
} from "@/components/charts/lib/OutageBandsProvider"
import { MetricChart } from "@/components/charts/MetricChart"
import { SpeedHistoryChart } from "@/components/charts/SpeedHistoryChart"
import type { FleetSnapshot } from "@/lib/fleet"
import type { Snapshot } from "@/types/api"

const DAY1 = "2026-08-01T00:00:00.000Z"
const DAY2 = "2026-08-02T00:00:00.000Z"
const DAY3 = "2026-08-03T00:00:00.000Z"

// A gap wholly inside the plotted range, so cropping can never be what removes it.
const APP_GAP = { start: Date.parse(DAY1) + 3_600_000, end: Date.parse(DAY1) + 7_200_000 }
const QBT_GAP = { start: Date.parse(DAY2) + 3_600_000, end: Date.parse(DAY2) + 7_200_000 }

function snap(polledAt: string): Snapshot {
  return {
    polledAt,
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
  }
}

function fleetSnap(polledAt: string): FleetSnapshot {
  return {
    clientId: 1,
    clientName: "qbt",
    polledAt,
    totalSeedingCount: 10,
    totalLeechingCount: 1,
    uploadSpeedBytes: "1048576",
    downloadSpeedBytes: "524288",
    tagStats: null,
  }
}

const SNAPSHOTS = [snap(DAY1), snap(DAY2), snap(DAY3)]
const FLEET = [fleetSnap(DAY1), fleetSnap(DAY2), fleetSnap(DAY3)]

const BOTH_RECORDED: OutageBandsValue = {
  enabled: true,
  app: [APP_GAP],
  allDown: [QBT_GAP],
}

function withBands(value: OutageBandsValue, children: ReactNode) {
  return <OutageBandsContext.Provider value={value}>{children}</OutageBandsContext.Provider>
}

interface MarkAreaPoint {
  xAxis?: number
}
interface BandSeries {
  id?: string
  markArea?: { data?: Array<[MarkAreaPoint, MarkAreaPoint]> }
}

/** markArea spans on the last rendered option, for one band kind. */
function drawn(kind: "app" | "qbt"): Array<[MarkAreaPoint, MarkAreaPoint]> {
  const option = optionSpy.mock.calls.at(-1)?.[0] as { series?: BandSeries[] }
  const series = option?.series?.find((s) => s.id === `tt-outage-band-${kind}`)
  if (!series) throw new Error(`no ${kind} band series in the rendered option`)
  return series.markArea?.data ?? []
}

describe("outage bands on a tracker-sourced chart (MetricChart)", () => {
  it("draws a band for a recorded app gap", () => {
    optionSpy.mockClear()
    render(withBands(BOTH_RECORDED, <MetricChart metric="ratio" snapshots={SNAPSHOTS} />))

    expect(drawn("app")).toEqual([[{ xAxis: APP_GAP.start }, { xAxis: APP_GAP.end }]])
  })

  it("never draws a download-client band, even when one is recorded", () => {
    // A qBittorrent outage cannot flatten a tracker snapshot. Banding this
    // chart for it would blame the wrong system for the dip.
    optionSpy.mockClear()
    render(withBands(BOTH_RECORDED, <MetricChart metric="ratio" snapshots={SNAPSHOTS} />))

    expect(drawn("qbt")).toEqual([])
  })

  it("draws nothing for an UNKNOWN window", () => {
    // Nothing recorded means nothing observed. That is not "healthy", and it
    // gets no band and no legend note.
    optionSpy.mockClear()
    render(
      withBands(
        { enabled: true, app: [], allDown: [] },
        <MetricChart metric="ratio" snapshots={SNAPSHOTS} />
      )
    )

    expect(drawn("app")).toEqual([])
    expect(drawn("qbt")).toEqual([])
  })

  it("hides the bands when the toggle is off, without removing the series", () => {
    // Removing the series would not remove the bands: ChartECharts renders in
    // merge mode, where an omitted series stays painted.
    optionSpy.mockClear()
    render(withBands({ ...BOTH_RECORDED, enabled: false }, <MetricChart metric="ratio" snapshots={SNAPSHOTS} />))

    expect(drawn("app")).toEqual([])
    expect(drawn("qbt")).toEqual([])
  })

  it("leaves the y axis alone", () => {
    optionSpy.mockClear()
    render(withBands(BOTH_RECORDED, <MetricChart metric="ratio" snapshots={SNAPSHOTS} />))

    const option = optionSpy.mock.calls.at(-1)?.[0] as { yAxis?: { type?: string } }
    expect(option?.yAxis?.type).toBe("value")
    for (const pair of drawn("app")) {
      expect(pair[0]).not.toHaveProperty("yAxis")
    }
  })

  it("draws nothing on the day-bucketed delta view, whose x axis is categorical", () => {
    // A sub-day outage cannot be honestly positioned inside a day-wide bar.
    optionSpy.mockClear()
    render(withBands(BOTH_RECORDED, <MetricChart metric="dailyDelta" snapshots={SNAPSHOTS} />))

    expect(drawn("app")).toEqual([])
    expect(drawn("qbt")).toEqual([])
  })
})

describe("outage bands on a qBT-sourced chart (SpeedHistoryChart)", () => {
  it("draws both layers", () => {
    optionSpy.mockClear()
    render(withBands(BOTH_RECORDED, <SpeedHistoryChart snapshots={FLEET} />))

    expect(drawn("app")).toEqual([[{ xAxis: APP_GAP.start }, { xAxis: APP_GAP.end }]])
    expect(drawn("qbt")).toEqual([[{ xAxis: QBT_GAP.start }, { xAxis: QBT_GAP.end }]])
  })

  it("draws nothing for an UNKNOWN window", () => {
    optionSpy.mockClear()
    render(
      withBands({ enabled: true, app: [], allDown: [] }, <SpeedHistoryChart snapshots={FLEET} />)
    )

    expect(drawn("app")).toEqual([])
    expect(drawn("qbt")).toEqual([])
  })
})

describe("the legend", () => {
  it("names only the kinds actually drawn", () => {
    render(withBands(BOTH_RECORDED, <MetricChart metric="ratio" snapshots={SNAPSHOTS} />))

    expect(screen.getByText("App not running")).toBeInTheDocument()
    // The tracker chart never draws a qBT band, so it must never explain one.
    expect(screen.queryByText("Download client unreachable")).not.toBeInTheDocument()
  })

  it("names both kinds on a chart that draws both", () => {
    render(withBands(BOTH_RECORDED, <SpeedHistoryChart snapshots={FLEET} />))

    expect(screen.getByText("App not running")).toBeInTheDocument()
    expect(screen.getByText("Download client unreachable")).toBeInTheDocument()
  })

  it("says nothing at all for an UNKNOWN window", () => {
    render(
      withBands(
        { enabled: true, app: [], allDown: [] },
        <MetricChart metric="ratio" snapshots={SNAPSHOTS} />
      )
    )

    expect(screen.queryByTestId("outage-band-legend")).not.toBeInTheDocument()
  })

  it("disappears with the bands when the toggle is off", () => {
    render(
      withBands({ ...BOTH_RECORDED, enabled: false }, <SpeedHistoryChart snapshots={FLEET} />)
    )

    expect(screen.queryByTestId("outage-band-legend")).not.toBeInTheDocument()
  })

  it("adds no focusable element — the bands are decoration, not a control", () => {
    const { container } = render(
      withBands(BOTH_RECORDED, <SpeedHistoryChart snapshots={FLEET} />)
    )
    const legend = screen.getByTestId("outage-band-legend")

    expect(legend.querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0)
    expect(container.querySelectorAll("button")).toHaveLength(0)
  })
})
