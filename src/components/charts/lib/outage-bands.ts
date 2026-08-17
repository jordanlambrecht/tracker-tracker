// src/components/charts/lib/outage-bands.ts
//
// Turns recorded outage intervals into the hatched background bands drawn
// behind a time-series chart, so a flat or empty stretch has a visible reason
// instead of reading as real zeroes.
//
// The interval MATH lives in @/lib/outages and the coverage POLICY lives in
// /api/uptime/outages. This module is presentation only: it never decides
// whether an outage happened, only how an already-decided one is painted.
//
// ── Why a separate, nameless series ─────────────────────────────────────────
// The bands ride on their own series rather than on `markArea` of a data
// series, because a markArea attached to a real series disappears the moment
// that series is toggled off in the legend — on a multi-tracker chart, hiding
// one tracker would delete the explanation for all of them.
//
// The series is deliberately nameless. ECharts' legend only lists series whose
// name was explicitly specified (`isNameSpecified`, util/model.js), so an
// unnamed series cannot produce a stray legend entry. It carries a stable `id`
// so ECharts matches it across setOption calls by id rather than by index,
// which keeps it correct on charts whose real series count varies.
//
// ── Why the series is ALWAYS appended, even with nothing to draw ────────────
// ChartECharts renders with `notMerge: false`. In merge mode, dropping a
// series from the next option does NOT remove it from the chart — the old one
// stays painted. Turning the bands off therefore has to mean "same series,
// empty markArea data", never "no series". Every path through this module
// returns both series; only their `data` varies.
//
// ── Why nothing here can disturb the chart ─────────────────────────────────
//   * markArea data is x-only, so the y-axis never sees it.
//   * markArea never contributes to axis extent (MarkAreaView clips against
//     the axis instead — see coord/axisHelper.js, which knows nothing about
//     markers), so bands cannot rescale either axis.
//   * The series holds no data points, so an axis-trigger tooltip has nothing
//     to report and the bands can never appear as a tooltip row.
//   * `silent: true` on both the series and the markArea removes all hit
//     testing, so the bands add no hover or focus targets.
//   * markArea defaults to z = 1 while line/bar series default to z = 2, so
//     the bands paint UNDER the data without any reordering. Set explicitly
//     here so a future ECharts default change cannot silently cover the data.
//
// Functions: outageBandFill, timeRangeOf, polledAtRange, clampBandsToRange,
//            isOutageBandSeries, appendOutageBandSeries, hasVisibleBands

import type { EChartsOption } from "echarts"
import { hexToRgba } from "@/lib/color-utils"
import type { Interval } from "@/lib/outages"
import { CHART_THEME } from "./theme"

/** Which system an outage band blames. */
export type OutageBandKind = "app" | "qbt"

/**
 * Where a chart's numbers come from, which decides which bands it may show.
 *
 * Owner's decision: app bands everywhere, qBT bands only on qBT-sourced
 * charts. A qBittorrent outage cannot flatten a tracker snapshot — the tracker
 * poller does not go through qBittorrent — so a qBT band on a tracker chart
 * would blame the wrong system for a dip it did not cause.
 */
export type ChartDataSource = "tracker" | "qbt"

export interface OutageBandStyle {
  kind: OutageBandKind
  /** Shown in the legend beside the swatch. */
  label: string
  /** Long form, used as the legend's title attribute. */
  description: string
  color: string
  /** "/" or "\" — the two kinds differ by ANGLE as well as hue, so they stay
   *  distinguishable without colour vision. */
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
}

/** Bands as one chart needs them: already scoped to what that chart may show. */
export interface ChartOutageBands {
  app: Interval[]
  qbt: Interval[]
}

export const NO_OUTAGE_BANDS: ChartOutageBands = { app: [], qbt: [] }

// ── Hatch pattern ───────────────────────────────────────────────────────────

/** Edge of the repeating tile, in CSS pixels. */
const TILE = 8
const STRIPE_WIDTH = 1.5
/** Flat wash under the stripes. Low enough that gridlines still read through. */
const WASH_ALPHA = 0.07
const STRIPE_ALPHA = 0.3
/** Flat fill used where no canvas exists (server render, jsdom). */
const FALLBACK_ALPHA = 0.13

/** zrender's pattern-fill shape. Accepted anywhere a colour string is. */
interface EChartsPattern {
  image: HTMLCanvasElement
  repeat: "repeat"
}

const patternCache = new Map<OutageBandKind, EChartsPattern | string>()

/**
 * Fill for a band: a repeating diagonal hatch on the client, a flat translucent
 * wash anywhere a 2D canvas context is unavailable.
 *
 * The fallback matters in two real places. Client components still render once
 * on the server for the initial HTML, where `document` does not exist; and
 * jsdom returns a canvas whose `getContext("2d")` is null. Neither may throw,
 * and neither is a visual problem: ECharts only paints in the browser, so the
 * server's option object is discarded before anything is drawn.
 */
export function outageBandFill(kind: OutageBandKind): EChartsPattern | string {
  const cached = patternCache.get(kind)
  if (cached) return cached

  const style = OUTAGE_BAND_STYLES[kind]
  const flat = hexToRgba(style.color, FALLBACK_ALPHA)

  // The fallback is cached too. Whether a 2D context exists is a property of
  // the environment, not of the call, so retrying per band series only repeats
  // a known answer — and under jsdom each retry emits a "not implemented"
  // warning that would bury real test output.
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
  // Three stripes per tile rather than one: the outer two are the corner
  // fragments that make the tile seamless when repeated.
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

// ── Series construction ─────────────────────────────────────────────────────

export const OUTAGE_BAND_SERIES_ID_PREFIX = "tt-outage-band-"

/** True for the band series this module appends — never for a data series. */
export function isOutageBandSeries(series: unknown): boolean {
  if (typeof series !== "object" || series === null) return false
  const id = (series as { id?: unknown }).id
  return typeof id === "string" && id.startsWith(OUTAGE_BAND_SERIES_ID_PREFIX)
}

/**
 * Crop bands to the chart's own data range.
 *
 * Display only. The API has already decided which outages are worth drawing,
 * measuring each against its TRUE length before any cropping — so a ten-hour
 * outage whose visible sliver is two minutes wide still draws those two
 * minutes here, and a genuinely four-minute one was dropped upstream and can
 * never be resurrected by this function.
 *
 * A null range means "do not crop" and lets ECharts clip against the axis.
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
 *
 * Used as the crop bound so a band never advertises a range the chart has no
 * axis for — an outage that ended before the first plotted point would
 * otherwise paint a band with no data anywhere near it.
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
      // markArea labels default to SHOWN — left on, every band would stamp its
      // own name across the plot.
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
  return bands.app.length > 0 || bands.qbt.length > 0
}

/**
 * Return `option` with the two band series appended.
 *
 * Both series are always present, so toggling the feature off empties their
 * data rather than removing them — see the merge-mode note at the top of this
 * file. Appending (rather than prepending) keeps every real series at its
 * original index, which matters for charts that colour their series from the
 * global `option.color` palette by position.
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
    ],
  } as EChartsOption
}
