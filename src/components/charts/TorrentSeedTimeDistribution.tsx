// src/components/charts/TorrentSeedTimeDistribution.tsx
"use client"

import type { EChartsOption } from "echarts"
import { getSeedTimeBuckets, SEEDING_STATES } from "@/lib/fleet"
import { formatCount } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildBucketedBarOption } from "./lib/chart-helpers"
import { CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartTooltip } from "./lib/theme"

// Pre-aggregated props (fleet dashboard path)
interface PreAggregatedProps {
  buckets: { label: string; count: number; color: string; max: number }[]
  seedTimeHours?: number | null
  height?: number
}

// Raw torrents props (per-tracker page path)
interface RawTorrentsProps {
  torrents: { state: string; seedingTime: number }[]
  seedTimeHours?: number | null
  accentColor?: string
  height?: number
}

type TorrentSeedTimeDistributionProps = PreAggregatedProps | RawTorrentsProps

function computeMarkLine(
  buckets: { max: number }[],
  seedTimeHours: number | null
): { thresholdIdx: number; label: string; color: string } | undefined {
  if (seedTimeHours == null || seedTimeHours <= 0) return undefined
  const thresholdSeconds = seedTimeHours * 3600
  const idx = buckets.findIndex((b, i) => {
    const prevMax = i === 0 ? 0 : (buckets[i - 1]?.max ?? 0)
    return thresholdSeconds >= prevMax && thresholdSeconds < b.max
  })
  if (idx === -1) return undefined
  const label = seedTimeHours % 24 === 0 ? `Min: ${seedTimeHours / 24}d` : `Min: ${seedTimeHours}h`
  return { thresholdIdx: idx, label, color: CHART_THEME.warn }
}

function buildSeedTimeBucketedOption(
  buckets: { label: string; count: number; color: string; max: number }[],
  markLine?: { thresholdIdx: number; label: string; color: string }
): EChartsOption {
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  const data = buckets.map((b) => ({
    value: b.count,
    itemStyle: { color: b.color, borderRadius: [4, 4, 0, 0] },
  }))

  const seriesEntry: Record<string, unknown> = {
    type: "bar",
    data,
    barMaxWidth: 48,
    emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" } },
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
        const p = params as { value: number; color: string; dataIndex: number }
        const bucket = buckets[p.dataIndex]
        if (!bucket) return ""
        const pct = total > 0 ? ((bucket.count / total) * 100).toFixed(1) : "0.0"
        return (
          chartDot(p.color) +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">Seed Time ${bucket.label}</span><br/>` +
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
    series: [seriesEntry],
  }
}

function TorrentSeedTimeDistribution(props: TorrentSeedTimeDistributionProps) {
  const { seedTimeHours = null, height = 200 } = props

  if ("buckets" in props) {
    // Fleet path: pre-aggregated buckets (already filtered to seeding torrents)
    if (!props.buckets)
      return <ChartEmptyState height={height} message="No seeding torrents found" />
    const { buckets } = props
    if (buckets.length === 0 || buckets.every((b) => b.count === 0)) {
      return <ChartEmptyState height={height} message="No seeding torrents found" />
    }

    const markLine = computeMarkLine(buckets, seedTimeHours)

    return (
      <ChartECharts
        option={buildSeedTimeBucketedOption(buckets, markLine)}
        style={{ height, width: "100%" }}
      />
    )
  }

  // Per-tracker path: raw torrents
  const { torrents, accentColor = CHART_THEME.accent } = props
  const seeding = torrents.filter((t) => SEEDING_STATES.has(t.state))

  if (seeding.length === 0) {
    return <ChartEmptyState height={height} message="No seeding torrents found" />
  }

  const buckets = getSeedTimeBuckets(accentColor)

  const markLine = computeMarkLine(buckets, seedTimeHours)

  const option = buildBucketedBarOption({
    buckets,
    torrents: seeding,
    getThreshold: (b) => b.max,
    getValue: (t) => t.seedingTime,
    getLabel: (b) => b.label,
    getColor: (b) => b.color,
    labelPrefix: "Seed Time",
    markLine,
  })

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { TorrentSeedTimeDistributionProps }
export { TorrentSeedTimeDistribution }
