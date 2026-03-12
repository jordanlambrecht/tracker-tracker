// src/components/charts/TorrentActivityHeatmap.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { CHART_THEME } from "@/components/charts/theme"
import { hexToRgba } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TorrentActivityHeatmapProps {
  torrents: TorrentInfo[]
  accentColor: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TorrentActivityHeatmap({ torrents, accentColor }: TorrentActivityHeatmapProps) {
  // Build 7x24 grid from addedOn timestamps
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])
  for (const t of torrents) {
    if (t.addedOn <= 0) continue
    const d = new Date(t.addedOn * 1000)
    grid[d.getDay()][d.getHours()] += 1
  }

  // Flatten to [hour, day, count] for ECharts
  const data: [number, number, number][] = []
  let maxCount = 0
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = grid[day][hour]
      data.push([hour, day, count])
      if (count > maxCount) maxCount = count
    }
  }

  if (maxCount === 0) {
    return <p className="text-sm text-muted font-mono py-4">No activity data</p>
  }

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      formatter: (params: unknown) => {
        const p = params as { value: [number, number, number] }
        const [hour, day, count] = p.value
        return `${DAY_LABELS[day]} ${HOUR_LABELS[hour]}: ${count} torrent${count !== 1 ? "s" : ""} added`
      },
    },
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
