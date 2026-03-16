// src/components/charts/TorrentActivityHeatmap.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { DAY_LABELS, HOUR_LABELS } from "@/components/charts/chart-helpers"
import { buildActivityMatrix } from "@/components/charts/chart-transforms"
import { CHART_THEME, chartTooltip } from "@/components/charts/theme"
import { hexToRgba } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"
import { ChartEmptyState } from "./ChartEmptyState"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TorrentActivityHeatmapProps {
  torrents: TorrentInfo[]
  accentColor: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TorrentActivityHeatmap({ torrents, accentColor }: TorrentActivityHeatmapProps) {
  const validTimestamps = torrents.map((t) => t.addedOn).filter((ts) => ts > 0)
  const { data, maxCount } = buildActivityMatrix(validTimestamps)

  if (maxCount === 0) {
    return <ChartEmptyState height={240} message="No activity data" />
  }

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { value: [number, number, number] }
        const [hour, day, count] = p.value
        return `${DAY_LABELS[day]} ${HOUR_LABELS[hour]}: ${count} torrent${count !== 1 ? "s" : ""} added`
      },
    }),
    grid: { left: 48, right: 24, top: 8, bottom: 32 },
    xAxis: {
      type: "category",
      data: HOUR_LABELS,
      splitArea: { show: false },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 9,
        interval: 2,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: DAY_LABELS,
      splitArea: { show: false },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      min: 0,
      max: maxCount,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemWidth: 12,
      itemHeight: 80,
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 9,
      },
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
            shadowColor: hexToRgba(accentColor, 0.5),
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

  return (
    <ReactECharts
      option={option}
      style={{ height: 240, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
