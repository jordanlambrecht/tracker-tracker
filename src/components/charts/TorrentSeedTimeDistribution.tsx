// src/components/charts/TorrentSeedTimeDistribution.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { CHART_THEME } from "@/components/charts/theme"
import type { TorrentInfo } from "@/lib/torrent-utils"
import { SEEDING_STATES } from "@/lib/torrent-utils"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TorrentSeedTimeDistributionProps {
  torrents: TorrentInfo[]
  seedTimeHours: number | null
  accentColor: string
}

export function TorrentSeedTimeDistribution({
  torrents,
  seedTimeHours,
  accentColor,
}: TorrentSeedTimeDistributionProps) {
  const seeding = torrents.filter((t) => SEEDING_STATES.has(t.state))
  const buckets = [
    { label: "< 1d", min: 0, max: 86400, color: CHART_THEME.scale[0] },
    { label: "1-7d", min: 86400, max: 604800, color: CHART_THEME.scale[1] },
    { label: "7-30d", min: 604800, max: 2592000, color: CHART_THEME.scale[2] },
    { label: "30-90d", min: 2592000, max: 7776000, color: accentColor },
    { label: "90d+", min: 7776000, max: Infinity, color: CHART_THEME.scale[4] },
  ]

  const counts = buckets.map((b) => ({
    ...b,
    count: seeding.filter((t) => t.seedingTime >= b.min && t.seedingTime < b.max).length,
  }))

  const thresholdSeconds = seedTimeHours != null && seedTimeHours > 0 ? seedTimeHours * 3600 : null

  // Find which bucket index the threshold falls in for the markLine
  let thresholdBucketIdx: number | null = null
  if (thresholdSeconds) {
    thresholdBucketIdx = buckets.findIndex((b) => thresholdSeconds >= b.min && thresholdSeconds < b.max)
    if (thresholdBucketIdx === -1) thresholdBucketIdx = null
  }

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
    },
    grid: { left: 40, right: 16, top: 24, bottom: 28 },
    xAxis: {
      type: "category",
      data: counts.map((c) => c.label),
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
    },
    series: [
      {
        type: "bar",
        data: counts.map((c) => ({
          value: c.count,
          itemStyle: { color: c.color, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: c.color } },
        })),
        barWidth: "60%",
        markLine: thresholdBucketIdx !== null
          ? {
              silent: true,
              symbol: "none",
              label: {
                formatter: seedTimeHours != null && seedTimeHours > 0 ? `Min: ${seedTimeHours % 24 === 0 ? `${seedTimeHours / 24}d` : `${seedTimeHours}h`}` : "Min",
                color: CHART_THEME.warn,
                fontFamily: CHART_THEME.fontMono,
                fontSize: 10,
              },
              lineStyle: { color: CHART_THEME.warn, type: "dashed", width: 2 },
              data: [{ xAxis: thresholdBucketIdx }],
            }
          : undefined,
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 200, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
