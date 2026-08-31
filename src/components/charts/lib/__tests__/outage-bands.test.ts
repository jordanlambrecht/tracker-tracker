// src/components/charts/lib/__tests__/outage-bands.test.ts
//
// The bands are decoration with an unusually high cost of being wrong: they
// claim "no data was collected here", so anything that makes one appear where
// no outage was recorded turns the chart into a liar. These tests pin the
// structural properties that keep that from happening, plus the two ECharts
// details that silently break the feature if they drift (merge-mode removal,
// and markArea's default-on label).

import type { EChartsOption } from "echarts"
import { describe, expect, it } from "vitest"
import {
  appendOutageBandSeries,
  type ChartOutageBands,
  clampBandsToRange,
  hasVisibleBands,
  isOutageBandSeries,
  NO_OUTAGE_BANDS,
  OUTAGE_BAND_STYLES,
  type OutageBandKind,
  outageBandFill,
  timeRangeOf,
} from "../outage-bands"

const T0 = Date.UTC(2026, 7, 1, 0, 0, 0)
const MIN = 60_000

interface BandSeries {
  id?: string
  name?: string
  type?: string
  silent?: boolean
  z?: number
  data?: unknown[]
  markArea?: {
    silent?: boolean
    z?: number
    label?: { show?: boolean }
    itemStyle?: { borderWidth?: number; color?: unknown }
    data?: Array<[{ xAxis?: number; yAxis?: number }, { xAxis?: number; yAxis?: number }]>
  }
}

function seriesOf(option: EChartsOption): BandSeries[] {
  return option.series as unknown as BandSeries[]
}

function bandSeries(option: EChartsOption, kind: OutageBandKind): BandSeries {
  const found = seriesOf(option).find((s) => s.id === `tt-outage-band-${kind}`)
  if (!found) throw new Error(`no ${kind} band series`)
  return found
}

const baseOption: EChartsOption = {
  series: [{ name: "Ratio", type: "line", data: [[T0, 1]] }],
}

describe("appendOutageBandSeries", () => {
  it("draws a band for a recorded gap", () => {
    const bands: ChartOutageBands = {
      app: [{ start: T0, end: T0 + 30 * MIN }],
      qbt: [],
      tracker: [],
    }
    const option = appendOutageBandSeries(baseOption, bands)

    expect(bandSeries(option, "app").markArea?.data).toEqual([
      [{ xAxis: T0 }, { xAxis: T0 + 30 * MIN }],
    ])
  })

  it("draws NOTHING for an UNKNOWN window — no record means no claim", () => {
    const option = appendOutageBandSeries(baseOption, NO_OUTAGE_BANDS)

    expect(bandSeries(option, "app").markArea?.data).toEqual([])
    expect(bandSeries(option, "qbt").markArea?.data).toEqual([])
  })

  it("keeps both band series present even with nothing to draw", () => {
    // ChartECharts renders with notMerge: false. In merge mode a series omitted
    // from the next option is NOT removed from the chart, so switching the
    // feature off by dropping the series would leave the old bands painted.
    // Emptying `data` is the only removal that actually removes.
    const option = appendOutageBandSeries(baseOption, NO_OUTAGE_BANDS)
    const ids = seriesOf(option).map((s) => s.id)

    expect(ids).toContain("tt-outage-band-app")
    expect(ids).toContain("tt-outage-band-qbt")
  })

  it("leaves the data series untouched and at its original index", () => {
    // Charts that colour series from the global `option.color` palette read it
    // by position, so a band series inserted ahead of the data would recolour
    // the chart.
    const option = appendOutageBandSeries(baseOption, NO_OUTAGE_BANDS)

    expect(seriesOf(option)[0]).toEqual({ name: "Ratio", type: "line", data: [[T0, 1]] })
    // One data series plus all three band series. All three are always emitted,
    // even the ones this chart can never show, merge mode cannot remove a
    // series that later goes missing.
    expect(seriesOf(option)).toHaveLength(4)
  })

  it("is idempotent — re-applying replaces the bands instead of stacking them", () => {
    const once = appendOutageBandSeries(baseOption, {
      app: [{ start: T0, end: T0 + 10 * MIN }],
      qbt: [],
      tracker: [],
    })
    const twice = appendOutageBandSeries(once, NO_OUTAGE_BANDS)

    expect(seriesOf(twice)).toHaveLength(4)
    expect(bandSeries(twice, "app").markArea?.data).toEqual([])
  })

  it("never gives a band a y coordinate, so it cannot rescale the y axis", () => {
    const option = appendOutageBandSeries(baseOption, {
      app: [{ start: T0, end: T0 + 10 * MIN }],
      qbt: [{ start: T0 + 20 * MIN, end: T0 + 40 * MIN }],
      tracker: [],
    })

    for (const kind of ["app", "qbt"] as const) {
      for (const pair of bandSeries(option, kind).markArea?.data ?? []) {
        expect(pair[0]).not.toHaveProperty("yAxis")
        expect(pair[1]).not.toHaveProperty("yAxis")
      }
    }
  })

  it("carries no data points, so it can never appear as a tooltip row", () => {
    const option = appendOutageBandSeries(baseOption, {
      app: [{ start: T0, end: T0 + 10 * MIN }],
      qbt: [],
      tracker: [],
    })

    expect(bandSeries(option, "app").data).toEqual([])
  })

  it("is nameless, so the ECharts legend cannot list it", () => {
    // LegendModel only lists series whose name was explicitly specified
    // (isNameSpecified, echarts/lib/util/model.js). Naming these would put a
    // stray entry in every legend.
    const option = appendOutageBandSeries(baseOption, NO_OUTAGE_BANDS)

    expect(bandSeries(option, "app").name).toBeUndefined()
    expect(bandSeries(option, "qbt").name).toBeUndefined()
  })

  it("is silent and sits below the data series", () => {
    const option = appendOutageBandSeries(baseOption, NO_OUTAGE_BANDS)
    const app = bandSeries(option, "app")

    expect(app.silent).toBe(true)
    expect(app.markArea?.silent).toBe(true)
    // Line and bar series default to z = 2.
    expect(app.z).toBeLessThan(2)
    expect(app.markArea?.z).toBeLessThan(2)
  })

  it("suppresses the markArea label, which ECharts turns on by default", () => {
    const option = appendOutageBandSeries(baseOption, NO_OUTAGE_BANDS)

    expect(bandSeries(option, "app").markArea?.label?.show).toBe(false)
  })

  it("suppresses the border, which otherwise inherits the chart accent", () => {
    const option = appendOutageBandSeries(baseOption, NO_OUTAGE_BANDS)

    expect(bandSeries(option, "app").markArea?.itemStyle?.borderWidth).toBe(0)
  })

  it("crops bands to the chart's own plotted range", () => {
    const option = appendOutageBandSeries(
      baseOption,
      { app: [{ start: T0 - 100 * MIN, end: T0 + 100 * MIN }], qbt: [], tracker: [] },
      { start: T0, end: T0 + 60 * MIN }
    )

    expect(bandSeries(option, "app").markArea?.data).toEqual([
      [{ xAxis: T0 }, { xAxis: T0 + 60 * MIN }],
    ])
  })

  it("drops a band that lies entirely outside the plotted range", () => {
    const option = appendOutageBandSeries(
      baseOption,
      { app: [{ start: T0 - 200 * MIN, end: T0 - 100 * MIN }], qbt: [], tracker: [] },
      { start: T0, end: T0 + 60 * MIN }
    )

    expect(bandSeries(option, "app").markArea?.data).toEqual([])
  })

  it("appends a tracker band series carrying its own data", () => {
    const option = appendOutageBandSeries(baseOption, {
      app: [],
      qbt: [],
      tracker: [{ start: T0, end: T0 + 10 * MIN }],
    })

    expect(bandSeries(option, "tracker").markArea?.data).toEqual([
      [{ xAxis: T0 }, { xAxis: T0 + 10 * MIN }],
    ])
    // ...and the other two are still emitted, empty.
    expect(bandSeries(option, "app").markArea?.data).toEqual([])
    expect(bandSeries(option, "qbt").markArea?.data).toEqual([])
  })

  it("crops a tracker band to the chart's own data range", () => {
    const option = appendOutageBandSeries(
      baseOption,
      { app: [], qbt: [], tracker: [{ start: T0 - 100 * MIN, end: T0 + 10 * MIN }] },
      { start: T0, end: T0 + 5 * MIN }
    )

    expect(bandSeries(option, "tracker").markArea?.data).toEqual([
      [{ xAxis: T0 }, { xAxis: T0 + 5 * MIN }],
    ])
  })

  it("accepts a single-object series as well as an array", () => {
    const single = { series: { name: "One", type: "line", data: [] } } as EChartsOption
    const option = appendOutageBandSeries(single, NO_OUTAGE_BANDS)

    expect(seriesOf(option)).toHaveLength(4)
  })
})

describe("clampBandsToRange", () => {
  it("keeps a long outage's visible sliver rather than discarding it", () => {
    // The API already decided this outage is worth drawing, measuring it at its
    // TRUE length before any cropping. Dropping the sliver here would blank the
    // explanation precisely where a user scrolled to ask "why is this flat?".
    const tenHours = { start: T0, end: T0 + 600 * MIN }
    const visible = clampBandsToRange([tenHours], { start: T0 + 598 * MIN, end: T0 + 700 * MIN })

    expect(visible).toEqual([{ start: T0 + 598 * MIN, end: T0 + 600 * MIN }])
  })

  it("passes bands through untouched when there is no range", () => {
    const bands = [{ start: T0, end: T0 + MIN }]
    expect(clampBandsToRange(bands, null)).toEqual(bands)
  })

  it("drops zero-length and inverted spans", () => {
    expect(clampBandsToRange([{ start: T0, end: T0 }], null)).toEqual([])
    expect(clampBandsToRange([{ start: T0 + MIN, end: T0 }], null)).toEqual([])
  })
})

describe("timeRangeOf", () => {
  it("spans the smallest and largest timestamp", () => {
    expect(timeRangeOf([T0 + 5 * MIN, T0, T0 + 2 * MIN])).toEqual({
      start: T0,
      end: T0 + 5 * MIN,
    })
  })

  it("returns null for an empty or single-point chart", () => {
    expect(timeRangeOf([])).toBeNull()
    expect(timeRangeOf([T0])).toBeNull()
  })

  it("ignores non-finite timestamps from unparseable dates", () => {
    expect(timeRangeOf([Number.NaN, T0, T0 + MIN])).toEqual({ start: T0, end: T0 + MIN })
  })
})

describe("isOutageBandSeries", () => {
  it("recognises band series and nothing else", () => {
    expect(isOutageBandSeries({ id: "tt-outage-band-app" })).toBe(true)
    expect(isOutageBandSeries({ id: "some-other-series" })).toBe(false)
    expect(isOutageBandSeries({ name: "Upload", type: "line" })).toBe(false)
    expect(isOutageBandSeries(null)).toBe(false)
    expect(isOutageBandSeries(undefined)).toBe(false)
  })
})

describe("hasVisibleBands", () => {
  it("is false when nothing is drawn, so the legend stays hidden", () => {
    expect(hasVisibleBands(NO_OUTAGE_BANDS)).toBe(false)
    expect(hasVisibleBands({ app: [{ start: T0, end: T0 + MIN }], qbt: [], tracker: [] })).toBe(
      true
    )
    expect(hasVisibleBands({ app: [], qbt: [{ start: T0, end: T0 + MIN }], tracker: [] })).toBe(
      true
    )
    expect(hasVisibleBands({ app: [], qbt: [], tracker: [{ start: T0, end: T0 + MIN }] })).toBe(
      true
    )
  })
})

describe("outageBandFill", () => {
  it("returns a usable fill without a canvas context instead of throwing", () => {
    // jsdom has no 2D context, and a client component still renders once on the
    // server where `document` does not exist at all. Neither may throw.
    const fill = outageBandFill("app")
    expect(typeof fill === "string" || typeof fill === "object").toBe(true)
  })

  it("gives the two kinds different hues AND different stripe angles", () => {
    // Angle survives colour blindness; hue alone does not.
    expect(OUTAGE_BAND_STYLES.app.color).not.toBe(OUTAGE_BAND_STYLES.qbt.color)
    expect(OUTAGE_BAND_STYLES.app.angle).not.toBe(OUTAGE_BAND_STYLES.qbt.angle)
  })

  it("separates the tracker kind from app by BOTH hue and angle", () => {
    // These two CAN co-render, a tracker page draws app and tracker bands
    // together, so they must be distinguishable without colour vision.
    expect(OUTAGE_BAND_STYLES.tracker.color).not.toBe(OUTAGE_BAND_STYLES.app.color)
    expect(OUTAGE_BAND_STYLES.tracker.angle).not.toBe(OUTAGE_BAND_STYLES.app.angle)
  })

  it("lets tracker and qbt share an angle, because they can never co-render", () => {
    // Deliberate, not an oversight: useOutageBands scopes bands by data source,
    // so a chart shows app+tracker or app+qbt and never tracker+qbt. Hue alone
    // separating them is therefore never asked to do any work. Pinned so a
    // future "fix" has to read this reasoning first.
    expect(OUTAGE_BAND_STYLES.tracker.color).not.toBe(OUTAGE_BAND_STYLES.qbt.color)
  })

  it("has a style entry for every band kind", () => {
    // A kind with no entry throws inside outageBandFill on first paint.
    for (const kind of ["app", "qbt", "tracker"] as const) {
      expect(OUTAGE_BAND_STYLES[kind]?.kind).toBe(kind)
      expect(() => outageBandFill(kind)).not.toThrow()
    }
  })
})
