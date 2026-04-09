// src/components/charts/TorrentRatioDistribution.tsx
"use client"

import type { EChartsOption } from "echarts"
import { useMemo } from "react"
import { getRatioBuckets } from "@/lib/fleet"
import { formatCount } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildBucketedBarOption } from "./lib/chart-helpers"
import { CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartTooltip } from "./lib/theme"

// Pre-aggregated props (fleet dashboard path)
interface PreAggregatedProps {
  buckets: { label: string; count: number; min: number; max: number }[]
  accentColor?: string
  height?: number
}

// Raw torrents props (per-tracker page path)
interface RawTorrentsProps {
  torrents: { ratio: number }[]
  accentColor?: string
  height?: number
}

type TorrentRatioDistributionProps = PreAggregatedProps | RawTorrentsProps

function buildRatioBucketedOption(
  buckets: { label: string; count: number }[],
  colors: string[],
  labelPrefix: string
): EChartsOption {
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  const data = buckets.map((b, i) => ({
    value: b.count,
    itemStyle: { color: colors[i], borderRadius: [4, 4, 0, 0] },
  }))

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 24, right: 16, bottom: 40, left: 48 }),
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { value: number; color: string; dataIndex: number }
        const bucket = buckets[p.dataIndex]
        if (!bucket) return ""
        const pct = total > 0 ? ((bucket.count / total) * 100).toFixed(1) : "0.0"
        return (
          chartDot(p.color) +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${labelPrefix} ${bucket.label}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${formatCount(bucket.count)} torrents</span>` +
          `<span style="color:${CHART_THEME.textTertiary};"> · ${pct}%</span>`
        )
      },
    }),
    xAxis: {
      type: "category",
      data: buckets.map((b) => b.label),
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
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" } },
      },
    ],
  }
}

function TorrentRatioDistribution(props: TorrentRatioDistributionProps) {
  const { accentColor = CHART_THEME.accent, height = 280 } = props

  const isFleet = "buckets" in props
  const fleetBuckets = isFleet ? (props as PreAggregatedProps).buckets : null
  const rawTorrents = !isFleet ? (props as RawTorrentsProps).torrents : []

  const fleetOption = useMemo<EChartsOption | null>(() => {
    if (!fleetBuckets || fleetBuckets.length === 0 || fleetBuckets.every((b) => b.count === 0)) {
      return null
    }
    const coloredBuckets = getRatioBuckets(accentColor)
    const colors = fleetBuckets.map((_b, i) => coloredBuckets[i]?.color ?? CHART_THEME.chartFallback)
    return buildRatioBucketedOption(fleetBuckets, colors, "Ratio")
  }, [fleetBuckets, accentColor])

  const perTrackerOption = useMemo<EChartsOption | null>(() => {
    if (isFleet || rawTorrents.length === 0) return null
    const buckets = getRatioBuckets(accentColor)
    return buildBucketedBarOption({
      buckets,
      torrents: rawTorrents,
      getThreshold: (b) => b.max,
      getValue: (t) => t.ratio,
      getLabel: (b) => b.label,
      getColor: (b) => b.color,
      labelPrefix: "Ratio",
    })
  }, [isFleet, rawTorrents, accentColor])

  if (isFleet) {
    if (!fleetOption) {
      return <ChartEmptyState height={height} message="No torrent data available" />
    }
    return <ChartECharts option={fleetOption} style={{ height, width: "100%" }} />
  }

  if (!perTrackerOption) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  return <ChartECharts option={perTrackerOption} style={{ height, width: "100%" }} />
}

export type { TorrentRatioDistributionProps }
export { TorrentRatioDistribution }
