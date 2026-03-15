// src/components/charts/chart-helpers.ts
//
// Functions: fmtNum, yAxisPad, formatDateLabel, buildBucketedBarOption

import type { EChartsOption } from "echarts"
import { CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartTooltip } from "./theme"

/** Locale-formatted number with fixed decimal places — used in chart tooltips and axis labels */
export function fmtNum(v: number, decimals = 2): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
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

interface BucketedBarConfig<TBucket, TTorrent> {
  buckets: readonly TBucket[]
  torrents: readonly TTorrent[]
  getThreshold: (bucket: TBucket) => number
  getValue: (torrent: TTorrent) => number
  getLabel: (bucket: TBucket) => string
  getColor: (bucket: TBucket) => string
  labelPrefix: string
  pctSuffix?: string
}

export function buildBucketedBarOption<TBucket, TTorrent>(
  config: BucketedBarConfig<TBucket, TTorrent>
): EChartsOption {
  const { buckets, torrents, getThreshold, getValue, getLabel, getColor, labelPrefix, pctSuffix = "" } = config
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
          `<span style="color:${CHART_THEME.textSecondary};">${entry.count.toLocaleString()} torrents</span>` +
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
    series: [
      {
        type: "bar",
        data,
        barMaxWidth: 48,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" },
        },
      },
    ],
  }
}
