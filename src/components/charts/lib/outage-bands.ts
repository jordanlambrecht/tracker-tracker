// src/components/charts/lib/outage-bands.ts
//
// Turns recorded outage intervals into the hatched background bands drawn
// Functions: outageBandFill, timeRangeOf, polledAtRange, clampBandsToRange,
//            isOutageBandSeries, appendOutageBandSeries, hasVisibleBands

import type { EChartsOption } from "echarts"
import { hexToRgba } from "@/lib/color-utils"
import type { Interval } from "@/lib/outages"
import { CHART_THEME } from "./theme"

/**
 * Which system an outage band blames.
 *
 * NOT the same axis as ChartDataSource below, which happens to share the word
 * "tracker". This says WHAT WENT DOWN; that says WHERE THE NUMBERS CAME FROM.
 */
export type OutageBandKind = "app" | "qbt" | "tracker"

/**
 * Where a chart's numbers come from, which decides which bands it may show.
 */
export type ChartDataSource = "tracker" | "qbt"

export interface OutageBandStyle {
  kind: OutageBandKind
  /** Shown in the legend beside the swatch. */
  label: string
  /** Long form, used as the legend's title attribute. */
  description: string
  color: string
  /** "/" or "\" (differ by angle and hue, so they stay distinguishable
   *  without color vision). */
  angle: "forward" | "back"
}

export const OUTAGE_BAND_STYLES: Record<OutageBandKind, OutageBandStyle> = {
  app: {
    kind: "app",
    label: "App not running",
    description:
      "The app was not collecting during this range, so there is no data here — the flat or empty region is missing data, not a real zero.",
    // Slate. Deliberately not red (reads as an error in the data itself) and
    // not cyan (the dominant series accent).
    color: CHART_THEME.neutral,
    angle: "forward",
  },
  qbt: {
    kind: "qbt",
    label: "Download client unreachable",
    description:
      "The app was running but every enabled download client failed to answer, so no client data was collected during this range.",
    color: CHART_THEME.violet,
    angle: "back",
  },
  tracker: {
    kind: "tracker",
    label: "Tracker unreachable",
    description:
      "The app was running but this tracker failed to answer, so no stats were collected for it during this range. The band covers only the failures that were actually observed, so the real outage may extend up to one poll interval further at each end.",
    color: CHART_THEME.amber,
    angle: "back",
  },
}

/** Bands as one chart needs them: already scoped to what that chart may show. */
export interface ChartOutageBands {
  app: Interval[]
  qbt: Interval[]
  tracker: Interval[]
}

export const NO_OUTAGE_BANDS: ChartOutageBands = { app: [], qbt: [], tracker: [] }

/** Edge of the repeating tile in pixels. */
const TILE = 8
const STRIPE_WIDTH = 1.5
/** Flat wash under the stripes */
const WASH_ALPHA = 0.07
const STRIPE_ALPHA = 0.3
/** Flat fill used where no canvas exists */
const FALLBACK_ALPHA = 0.13

/** zrender's pattern-fill*/
interface EChartsPattern {
  image: HTMLCanvasElement
  repeat: "repeat"
}

const patternCache = new Map<OutageBandKind, EChartsPattern | string>()

/**
 * Fill for a band
 */
export function outageBandFill(kind: OutageBandKind): EChartsPattern | string {
  const cached = patternCache.get(kind)
  if (cached) return cached

  const style = OUTAGE_BAND_STYLES[kind]
  const flat = hexToRgba(style.color, FALLBACK_ALPHA)

  // Cache the fallback
  if (typeof document === "undefined") {
    patternCache.set(kind, flat)
    return flat
  }

  const canvas = document.createElement("canvas")
  canvas.width = TILE
  canvas.height = TILE
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    patternCache.set(kind, flat)
    return flat
  }

  ctx.fillStyle = hexToRgba(style.color, WASH_ALPHA)
  ctx.fillRect(0, 0, TILE, TILE)

  ctx.strokeStyle = hexToRgba(style.color, STRIPE_ALPHA)
  ctx.lineWidth = STRIPE_WIDTH
  ctx.beginPath()
  // Three stripes per tile
  for (const step of [-1, 0, 1]) {
    const c = step * TILE
    if (style.angle === "forward") {
      // y = (c + TILE) - x  →  "/"
      ctx.moveTo(-TILE, c + 2 * TILE)
      ctx.lineTo(2 * TILE, c - TILE)
    } else {
      // y = x + c  →  "\"
      ctx.moveTo(-TILE, c - TILE)
      ctx.lineTo(2 * TILE, c + 2 * TILE)
    }
  }
  ctx.stroke()

  const pattern: EChartsPattern = { image: canvas, repeat: "repeat" }
  patternCache.set(kind, pattern)
  return pattern
}
export const OUTAGE_BAND_SERIES_ID_PREFIX = "tt-outage-band-"

export function isOutageBandSeries(series: unknown): boolean {
  if (typeof series !== "object" || series === null) return false
  const id = (series as { id?: unknown }).id
  return typeof id === "string" && id.startsWith(OUTAGE_BAND_SERIES_ID_PREFIX)
}

/**
 * Crop bands to the chart's own data range.
 */
export function clampBandsToRange(bands: Interval[], range: Interval | null): Interval[] {
  if (!range) return bands.filter((b) => b.end > b.start)
  const out: Interval[] = []
  for (const band of bands) {
    const start = Math.max(band.start, range.start)
    const end = Math.min(band.end, range.end)
    if (end > start) out.push({ start, end })
  }
  return out
}

/**
 * Span covered by a chart's own x values, or null when it plots nothing.
 */
export function timeRangeOf(timestamps: number[]): Interval | null {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  for (const t of timestamps) {
    if (!Number.isFinite(t)) continue
    if (t < start) start = t
    if (t > end) end = t
  }
  return end > start ? { start, end } : null
}

/**
 * `timeRangeOf` for the shape almost every chart here already holds: rows with
 * an ISO `polledAt`. Unparseable dates become NaN and are ignored.
 */
export function polledAtRange(rows: Array<{ polledAt: string }>): Interval | null {
  return timeRangeOf(rows.map((r) => Date.parse(r.polledAt)))
}

function buildBandSeries(kind: OutageBandKind, intervals: Interval[]): Record<string, unknown> {
  return {
    id: `${OUTAGE_BAND_SERIES_ID_PREFIX}${kind}`,
    // No `name`: an unnamed series is excluded from the ECharts legend.
    type: "line",
    data: [],
    silent: true,
    animation: false,
    legendHoverLink: false,
    z: 1,
    markArea: {
      silent: true,
      animation: false,
      z: 1,
      // markArea labels default to SHOWN. If left on, every band would stamp
      // its own name across the plot.
      label: { show: false },
      emphasis: { disabled: true },
      itemStyle: {
        color: outageBandFill(kind),
        // MarkAreaView falls back to the series' visual colour for the stroke
        // when none is given, which would outline every band in the chart's
        // accent. Zero width makes the question moot.
        borderWidth: 0,
      },
      data: intervals.map((i) => [{ xAxis: i.start }, { xAxis: i.end }]),
    },
  }
}

/** True when anything would actually be painted — drives the legend. */
export function hasVisibleBands(bands: ChartOutageBands): boolean {
  return bands.app.length > 0 || bands.qbt.length > 0 || bands.tracker.length > 0
}

/**
 * Return `option` with the three band series appended.
 *
 * ALL THREE are always present, including on charts that can never show one of
 * them — see the merge-mode note at the top of this file. A chart that emitted
 * two series and later three is fine (merge adds), but one that emitted three
 * and later two would leave the third painted forever. "Always all three, some
 * with empty data" is the only shape that cannot break that way.
 *
 * Appending (rather than prepending) keeps every real series at its original
 * index, which matters for charts that colour their series from the global
 * `option.color` palette by position.
 */
export function appendOutageBandSeries(
  option: EChartsOption,
  bands: ChartOutageBands,
  range: Interval | null = null
): EChartsOption {
  const raw = option.series
  const existing = Array.isArray(raw) ? raw : raw ? [raw] : []
  // Drop any band series already present so repeated calls stay idempotent.
  const dataSeries = existing.filter((s) => !isOutageBandSeries(s))

  return {
    ...option,
    series: [
      ...dataSeries,
      buildBandSeries("app", clampBandsToRange(bands.app, range)),
      buildBandSeries("qbt", clampBandsToRange(bands.qbt, range)),
      buildBandSeries("tracker", clampBandsToRange(bands.tracker, range)),
    ],
  } as EChartsOption
}
