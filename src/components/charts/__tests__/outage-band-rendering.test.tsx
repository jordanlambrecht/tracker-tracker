// src/components/charts/__tests__/outage-band-rendering.test.tsx

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

// A gap fully inside the plotted range
const APP_GAP = { start: Date.parse(DAY1) + 3_600_000, end: Date.parse(DAY1) + 7_200_000 }
const QBT_GAP = { start: Date.parse(DAY2) + 3_600_000, end: Date.parse(DAY2) + 7_200_000 }
const TRACKER_GAP = { start: Date.parse(DAY3) - 7_200_000, end: Date.parse(DAY3) - 3_600_000 }

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
  tracker: [TRACKER_GAP],
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

/** markArea spans on the last rendered option*/
function drawn(kind: "app" | "qbt" | "tracker"): Array<[MarkAreaPoint, MarkAreaPoint]> {
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

  it("draws a band for a recorded tracker outage", () => {
    optionSpy.mockClear()
    render(withBands(BOTH_RECORDED, <MetricChart metric="ratio" snapshots={SNAPSHOTS} />))

    expect(drawn("tracker")).toEqual([[{ xAxis: TRACKER_GAP.start }, { xAxis: TRACKER_GAP.end }]])
  })

  it("emits the tracker band series even with nothing to draw", () => {
    // ChartECharts renders in merge mode, where a series omitted from the next
    // option stays painted from the previous one. Navigating from a tracker
    // page to the dashboard must empty this series, never drop it.
    optionSpy.mockClear()
    render(
      withBands(
        { enabled: true, app: [], allDown: [], tracker: [] },
        <MetricChart metric="ratio" snapshots={SNAPSHOTS} />
      )
    )

    expect(drawn("tracker")).toEqual([])
  })

  it("draws nothing for an UNKNOWN window", () => {
    // Nothing recorded means nothing observed. That is not "healthy", and it
    // gets no band and no legend note.
    optionSpy.mockClear()
    render(
      withBands(
        { enabled: true, app: [], allDown: [], tracker: [] },
        <MetricChart metric="ratio" snapshots={SNAPSHOTS} />
      )
    )

    expect(drawn("app")).toEqual([])
    expect(drawn("qbt")).toEqual([])
    expect(drawn("tracker")).toEqual([])
  })

  it("hides the bands when the toggle is off, without removing the series", () => {
    // Removing the series would not remove the bands. ChartECharts renders in
    // merge mode, where an omitted series stays painted.
    optionSpy.mockClear()
    render(
      withBands(
        { ...BOTH_RECORDED, enabled: false },
        <MetricChart metric="ratio" snapshots={SNAPSHOTS} />
      )
    )

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
    // A sub-day outage cannot be honestly positioned inside a day-wide bar
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

  it("never draws a tracker band, even when one is recorded", () => {
    // The mirror of the rule on the tracker chart. A tracker being unreachable
    // says nothing about the torrents sitting in a download client. This is also
    // why tracker and qBT bands can never co-render, which is what lets them
    // share a hatch angle without becoming indistinguishable.
    optionSpy.mockClear()
    render(withBands(BOTH_RECORDED, <SpeedHistoryChart snapshots={FLEET} />))

    expect(drawn("tracker")).toEqual([])
  })

  it("draws nothing for an UNKNOWN window", () => {
    optionSpy.mockClear()
    render(
      withBands(
        { enabled: true, app: [], allDown: [], tracker: [] },
        <SpeedHistoryChart snapshots={FLEET} />
      )
    )

    expect(drawn("app")).toEqual([])
    expect(drawn("qbt")).toEqual([])
    expect(drawn("tracker")).toEqual([])
  })
})

describe("the legend", () => {
  it("names only the kinds actually drawn", () => {
    render(withBands(BOTH_RECORDED, <MetricChart metric="ratio" snapshots={SNAPSHOTS} />))

    expect(screen.getByText("App not running")).toBeInTheDocument()
    expect(screen.getByText("Tracker unreachable")).toBeInTheDocument()
    // The tracker chart never draws a qBT band, so it must never explain one.
    expect(screen.queryByText("Download client unreachable")).not.toBeInTheDocument()
  })

  it("names both kinds on a chart that draws both", () => {
    render(withBands(BOTH_RECORDED, <SpeedHistoryChart snapshots={FLEET} />))

    expect(screen.getByText("App not running")).toBeInTheDocument()
    expect(screen.getByText("Download client unreachable")).toBeInTheDocument()
    // ...and never names a band it did not draw.
    expect(screen.queryByText("Tracker unreachable")).not.toBeInTheDocument()
  })

  it("does NOT name a kind whose band was cropped out of the visible range", () => {
    const ancient = {
      start: Date.parse(DAY1) - 90 * 86_400_000,
      end: Date.parse(DAY1) - 89 * 86_400_000,
    }
    render(
      withBands(
        { enabled: true, app: [ancient], allDown: [], tracker: [ancient] },
        <MetricChart metric="ratio" snapshots={SNAPSHOTS} />
      )
    )

    expect(screen.queryByText("App not running")).not.toBeInTheDocument()
    expect(screen.queryByText("Tracker unreachable")).not.toBeInTheDocument()
    expect(screen.queryByTestId("outage-band-legend")).not.toBeInTheDocument()
  })

  it("still names a kind that is only PARTLY in range", () => {
    // Cropping must not become over-eager: a band straddling the left edge is
    // drawn, so it must also be explained.
    const straddling = { start: Date.parse(DAY1) - 86_400_000, end: Date.parse(DAY1) + 3_600_000 }
    render(
      withBands(
        { enabled: true, app: [straddling], allDown: [], tracker: [] },
        <MetricChart metric="ratio" snapshots={SNAPSHOTS} />
      )
    )

    expect(screen.getByText("App not running")).toBeInTheDocument()
  })

  it("says nothing at all for an UNKNOWN window", () => {
    render(
      withBands(
        { enabled: true, app: [], allDown: [], tracker: [] },
        <MetricChart metric="ratio" snapshots={SNAPSHOTS} />
      )
    )

    expect(screen.queryByTestId("outage-band-legend")).not.toBeInTheDocument()
  })

  it("disappears with the bands when the toggle is off", () => {
    render(withBands({ ...BOTH_RECORDED, enabled: false }, <SpeedHistoryChart snapshots={FLEET} />))

    expect(screen.queryByTestId("outage-band-legend")).not.toBeInTheDocument()
  })

  it("adds no focusable element — the bands are decoration, not a control", () => {
    const { container } = render(withBands(BOTH_RECORDED, <SpeedHistoryChart snapshots={FLEET} />))
    const legend = screen.getByTestId("outage-band-legend")

    expect(legend.querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0)
    expect(container.querySelectorAll("button")).toHaveLength(0)
  })
})
