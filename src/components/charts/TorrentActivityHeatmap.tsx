// src/components/charts/TorrentActivityHeatmap.tsx
//
// Functions: TorrentActivityHeatmap

"use client"

import type { EChartsOption } from "echarts"
import { hexToRgba } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { DAY_LABELS, HOUR_LABELS } from "./lib/chart-helpers"
import { buildActivityMatrix } from "./lib/chart-transforms"
import { CHART_THEME, chartAxisLabel, chartTooltip, escHtml } from "./lib/theme"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TorrentActivityHeatmapProps {
  torrents: { addedOn: number }[]
  accentColor?: string
  height?: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TorrentActivityHeatmap({
  torrents,
  accentColor = CHART_THEME.accent,
  height = 240,
}: TorrentActivityHeatmapProps) {
  const validTimestamps = torrents.map((t) => t.addedOn).filter((ts) => ts > 0)
  const { data, maxCount } = buildActivityMatrix(validTimestamps)

  if (maxCount === 0) {
    return <ChartEmptyState height={height} message="No activity data" />
  }

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      borderColor: accentColor,
      formatter: (params: unknown) => {
        const p = params as { value: [number, number, number] }
        const [hour, day, count] = p.value
        const dayLabel = DAY_LABELS[day] ?? ""
        const hourLabel = HOUR_LABELS[hour] ?? ""
        return (
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(dayLabel)} at ${escHtml(hourLabel)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${count.toLocaleString()} torrent${count !== 1 ? "s" : ""} added</span>`
        )
      },
    }),
    grid: { left: 48, right: 24, top: 16, bottom: 40 },
    xAxis: {
      type: "category",
      data: HOUR_LABELS,
      splitArea: { show: false },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        interval: 1,
        formatter: (_val: string, index: number) => (index % 2 === 0 ? _val : ""),
      }),
    },
    yAxis: {
      type: "category",
      data: DAY_LABELS,
      splitArea: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
    },
    visualMap: {
      min: 0,
      max: Math.max(maxCount, 1),
      show: false,
      inRange: {
        color: [
          CHART_THEME.gridLine,
          hexToRgba(accentColor, 0.3),
          hexToRgba(accentColor, 0.6),
          accentColor,
        ],
      },
    },
    series: [
      {
        type: "heatmap",
        data,
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: hexToRgba(accentColor, 0.4),
          },
        },
        itemStyle: {
          borderRadius: 3,
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
        },
      },
    ],
  }

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { TorrentActivityHeatmapProps }
export { TorrentActivityHeatmap }
