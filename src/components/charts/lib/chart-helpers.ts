// src/components/charts/lib/chart-helpers.ts
//
// Functions: fmtNum, formatGiB, yAxisPad, formatDateLabel, yAxisAutoRange, autoByteScale, DAY_LABELS, HOUR_LABELS, buildBucketedBarOption, buildGlowAreaStyle, buildAxisPointer, buildThemeRiverSingleAxis, adaptiveDotSize, buildTimeXAxis, insideZoom, buildDonutShell, buildStackedAreaOption

import type { EChartsOption } from "echarts"
import { formatCount, hexToRgba } from "@/lib/formatters"
import type { StackedAreaSeries } from "@/types/charts"
import {
  CHART_THEME,
  chartAxisLabel,
  chartDot,
  chartGrid,
  chartLegend,
  chartTooltip,
  chartTooltipHeader,
  chartTooltipRow,
  formatChartTimestamp,
} from "./theme"

/** Locale-formatted number with fixed decimal places — used in chart tooltips and axis labels */
export function fmtNum(v: number, decimals = 2): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Formats a GiB value with automatic TiB scaling for display in chart tooltips. */
export function formatGiB(gib: number): string {
  return gib >= 1024 ? `${fmtNum(gib / 1024)} TiB` : `${fmtNum(gib)} GiB`
}

/** Format ISO date string to short locale label (i.e "Mar 15") */
export function formatDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Compute Y-axis padding so data doesn't press against chart edges */
export function yAxisPad(value: { min: number; max: number }): number {
  const range = value.max - value.min
  return Math.max(range * 0.15, (value.max || 1) * 0.001)
}

/**
 * Standard Y-axis min/max callbacks with padding.
 * Passes ECharts value-range callbacks that recalculate when series are toggled.
 * When allowNegative is true, min is left undefined (ECharts auto-scales).
 * When baselineValue is provided, min is clamped to show 80% of that threshold.
 */
export function yAxisAutoRange(opts?: { allowNegative?: boolean; baselineValue?: number | null }): {
  min: number | undefined
  max: number
} {
  const { allowNegative = false, baselineValue } = opts ?? {}
  return {
    min: allowNegative
      ? undefined
      : (((value: { min: number; max: number }) => {
          const dataMin = Math.max(0, Math.floor((value.min - yAxisPad(value)) * 100) / 100)
          return baselineValue != null && baselineValue > 0
            ? Math.min(dataMin, Math.floor(baselineValue * 0.8 * 100) / 100)
            : dataMin
        }) as unknown as number),
    max: ((value: { min: number; max: number }) =>
      Math.ceil((value.max + yAxisPad(value)) * 100) / 100) as unknown as number,
  }
}

/** Auto-select GiB vs TiB based on the maximum GiB value. Returns the divisor and unit string. */
export function autoByteScale(maxGiB: number): { divisor: number; unit: string } {
  const useTiB = maxGiB >= 1024
  return { divisor: useTiB ? 1024 : 1, unit: useTiB ? "TiB" : "GiB" }
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
)

interface BucketedBarConfig<TBucket, TTorrent> {
  buckets: readonly TBucket[]
  torrents: readonly TTorrent[]
  getThreshold: (bucket: TBucket) => number
  getValue: (torrent: TTorrent) => number
  getLabel: (bucket: TBucket) => string
  getColor: (bucket: TBucket) => string
  labelPrefix: string
  pctSuffix?: string
  markLine?: { thresholdIdx: number; label: string; color: string }
}

export function buildBucketedBarOption<TBucket, TTorrent>(
  config: BucketedBarConfig<TBucket, TTorrent>
): EChartsOption {
  const {
    buckets,
    torrents,
    getThreshold,
    getValue,
    getLabel,
    getColor,
    labelPrefix,
    pctSuffix = "",
    markLine,
  } = config
  const total = torrents.length

  const enriched = buckets.map((bucket, i) => {
    const prevThreshold = i === 0 ? -Infinity : getThreshold(buckets[i - 1])
    const count = torrents.filter(
      (t) => getValue(t) >= prevThreshold && getValue(t) < getThreshold(bucket)
    ).length
    return { bucket, count }
  })

  const data = enriched.map(({ bucket, count }) => ({
    value: count,
    itemStyle: { color: getColor(bucket), borderRadius: [4, 4, 0, 0] },
  }))

  const seriesEntry: Record<string, unknown> = {
    type: "bar",
    data,
    barMaxWidth: 48,
    emphasis: {
      itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" },
    },
  }

  if (markLine) {
    seriesEntry.markLine = {
      silent: true,
      symbol: "none",
      data: [{ xAxis: markLine.thresholdIdx }],
      lineStyle: { color: markLine.color, type: "dashed", width: 1 },
      label: {
        show: true,
        formatter: markLine.label,
        position: "end",
        color: markLine.color,
        fontSize: CHART_THEME.fontSizeCompact,
      },
    }
  }

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 24, right: 16, bottom: 40, left: 48 }),
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; color: string; dataIndex: number }
        const entry = enriched[p.dataIndex]
        if (!entry) return ""
        const pct = total > 0 ? ((entry.count / total) * 100).toFixed(1) : "0.0"
        return (
          chartDot(p.color) +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${labelPrefix} ${getLabel(entry.bucket)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${formatCount(entry.count)} torrents</span>` +
          `<span style="color:${CHART_THEME.textTertiary};"> · ${pct}%${pctSuffix}</span>`
        )
      },
    }),
    xAxis: {
      type: "category",
      data: buckets.map((b) => getLabel(b)),
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    series: [seriesEntry],
  }
}

/**
 * Builds a vertical linear gradient area style for line chart glow fills.
 * @param color - Hex color string
 * @param topOpacity - Opacity at the top of the gradient (default 0.25)
 * @param bottomOpacity - Opacity at the bottom of the gradient (default 0)
 */
export function buildGlowAreaStyle(
  color: string,
  topOpacity = 0.25,
  bottomOpacity = 0
): Record<string, unknown> {
  return {
    color: {
      type: "linear",
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: hexToRgba(color, topOpacity) },
        { offset: 1, color: hexToRgba(color, bottomOpacity) },
      ],
    },
  }
}

/**
 * Builds a standard dashed line axisPointer config for chart tooltips.
 * @param color - Line color (default CHART_THEME.borderMid)
 * @param opacity - Optional opacity
 * @param width - Optional line width
 */
export function buildAxisPointer(
  color: string = CHART_THEME.borderMid,
  opacity?: number,
  width?: number
): Record<string, unknown> {
  const lineStyle: Record<string, unknown> = { color, type: "dashed" }
  if (opacity !== undefined) lineStyle.opacity = opacity
  if (width !== undefined) lineStyle.width = width
  return { type: "line", lineStyle }
}

/**
 * Builds the singleAxis config for ThemeRiver charts.
 * @param overrides - Optional top/bottom pixel overrides
 */
export function buildThemeRiverSingleAxis(overrides?: {
  top?: number
  bottom?: number
}): Record<string, unknown> {
  return {
    type: "time",
    bottom: overrides?.bottom ?? 40,
    ...(overrides?.top !== undefined ? { top: overrides.top } : {}),
    axisLabel: chartAxisLabel(),
    axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
    axisTick: { show: false },
  }
}

/**
 * Computes an adaptive symbol dot size based on data point count.
 * Returns smaller dots for dense data and larger dots for sparse data.
 * @param count - Number of data points
 * @param thresholds - [high, low] count thresholds (default [100, 30])
 */
export function adaptiveDotSize(count: number, thresholds: [number, number] = [100, 30]): number {
  if (count > thresholds[0]) return 2
  if (count > thresholds[1]) return 4
  return 6
}

/**
 * Standard time-axis xAxis config.
 * Uses ECharts cascading label formatter for automatic granularity —
 * ECharts picks month/day/hour format based on the visible data range.
 */
export function buildTimeXAxis(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "time",
    boundaryGap: false,
    axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
    axisTick: { show: false },
    axisLabel: chartAxisLabel({
      hideOverlap: true,
      formatter: {
        year: "{yyyy}",
        month: "{MMM}",
        day: "{MMM} {d}",
        hour: "{HH}:{mm}",
        minute: "{HH}:{mm}",
      },
    }),
    splitLine: { show: true, lineStyle: { color: CHART_THEME.gridLine, width: 1 } },
    ...overrides,
  }
}

/** Inside-only dataZoom (wheel zoom + drag). Returns empty array when data is too sparse to need it. */
export function insideZoom(dataPointCount: number, minPoints = 14): EChartsOption["dataZoom"] {
  if (dataPointCount < minPoints) return []
  return [{ type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true }]
}

/**
 * Shared donut chart shell — common radius, border, emphasis, and label config.
 * Consumers provide `data`, `label` overrides, and optional extras.
 */
export function buildDonutShell(overrides?: {
  radius?: [string, string]
  center?: [string, string]
  avoidLabelOverlap?: boolean
  labelLineLength?: [number, number]
}): {
  type: "pie"
  radius: [string, string]
  center: [string, string]
  avoidLabelOverlap: boolean
  itemStyle: { borderRadius: number; borderColor: string; borderWidth: number }
  emphasis: { label: { show: boolean; fontWeight: string; color: string } }
  labelLine: { lineStyle: { color: string }; length: number; length2: number }
} {
  const radius = overrides?.radius ?? ["45%", "72%"]
  const center = overrides?.center ?? ["50%", "50%"]
  const [len1, len2] = overrides?.labelLineLength ?? [12, 8]
  return {
    type: "pie" as const,
    radius,
    center,
    avoidLabelOverlap: overrides?.avoidLabelOverlap ?? true,
    itemStyle: {
      borderRadius: 4,
      borderColor: CHART_THEME.surface,
      borderWidth: 2,
    },
    emphasis: {
      label: { show: true, fontWeight: "bold", color: CHART_THEME.textPrimary },
    },
    labelLine: {
      lineStyle: { color: CHART_THEME.borderMid },
      length: len1,
      length2: len2,
    },
  }
}

/**
 * Builds a stacked area chart option for cumulative monthly series.
 * Used by FleetAgeTimeline and FleetCategoryTimeline.
 */
export function buildStackedAreaOption(
  sortedMonths: string[],
  series: StackedAreaSeries[],
  stackId = "default"
): EChartsOption {
  const eChartsSeries: NonNullable<EChartsOption["series"]> = series.map((s) => {
    let running = 0
    const data: [number, number][] = sortedMonths.map((month) => {
      running += s.monthMap.get(month) ?? 0
      const ts = new Date(`${month}-15T12:00:00`).getTime()
      return [ts, running]
    })

    return {
      name: s.name,
      type: "line",
      stack: stackId,
      smooth: true,
      symbol: "none",
      data,
      itemStyle: { color: s.color },
      lineStyle: { color: s.color, width: 1.5 },
      areaStyle: { color: s.color, opacity: 0.3 },
    }
  })

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 16, bottom: 48, left: 56 }),
    tooltip: chartTooltip("axis", {
      axisPointer: buildAxisPointer(),
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: [number, number]
          color: string
        }>
        if (!items?.length) return ""
        const ts = items[0].value[0]
        const dateLabel = formatChartTimestamp(ts)
        const rows = items
          .filter((item) => item.value[1] > 0)
          .sort((a, b) => b.value[1] - a.value[1])
          .map((item) =>
            chartTooltipRow(item.color, item.seriesName, formatCount(item.value[1]))
          )
          .join("<br/>")
        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    legend: chartLegend(),
    xAxis: buildTimeXAxis({ boundaryGap: false }),
    yAxis: {
      type: "value",
      name: "Torrents",
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    dataZoom: insideZoom(sortedMonths.length),
    series: eChartsSeries,
  }
}
