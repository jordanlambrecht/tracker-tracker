// src/components/charts/FleetRatioDistribution.tsx
//
// Functions: buildFleetRatioOption, FleetRatioDistribution

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { RATIO_BUCKETS } from "@/lib/fleet"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartGrid, chartDot, chartTooltip } from "./theme"

interface FleetRatioDistributionProps {
  torrents: { ratio: number }[]
  height?: number
}

function buildFleetRatioOption(
  torrents: { ratio: number }[]
): EChartsOption {
  const total = torrents.length

  const buckets = RATIO_BUCKETS.map((bucket, i) => {
    const prevMax = i === 0 ? -Infinity : RATIO_BUCKETS[i - 1].max
    const count = torrents.filter(
      (t) => t.ratio >= prevMax && t.ratio < bucket.max
    ).length
    return { ...bucket, count }
  })

  const data = buckets.map((b) => ({
    value: b.count,
    itemStyle: { color: b.color, borderRadius: [4, 4, 0, 0] },
  }))

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 24, right: 16, bottom: 40, left: 48 }),
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; color: string; dataIndex: number }
        const bucket = buckets[p.dataIndex]
        if (!bucket) return ""
        const pct = total > 0 ? ((bucket.count / total) * 100).toFixed(1) : "0.0"
        return (
          chartDot(p.color) +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">Ratio ${bucket.label}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${bucket.count.toLocaleString()} torrents</span>` +
          `<span style="color:${CHART_THEME.textTertiary};"> · ${pct}%</span>`
        )
      },
    }),
    xAxis: {
      type: "category",
      data: RATIO_BUCKETS.map((b) => b.label),
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

function FleetRatioDistribution({
  torrents,
  height = 280,
}: FleetRatioDistributionProps) {
  if (torrents.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  return (
    <ReactECharts
      option={buildFleetRatioOption(torrents)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { FleetRatioDistribution }
export type { FleetRatioDistributionProps }
