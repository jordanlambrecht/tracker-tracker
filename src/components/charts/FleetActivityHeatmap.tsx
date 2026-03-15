// src/components/charts/FleetActivityHeatmap.tsx
//
// Functions: buildHourLabel, buildActivityMatrix, buildFleetActivityHeatmapOption, FleetActivityHeatmap

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartTooltip, escHtml } from "./theme"

interface FleetActivityHeatmapProps {
  torrents: { added_on: number }[]
  height?: number
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function buildHourLabel(hour: number): string {
  if (hour === 0) return "12a"
  if (hour < 12) return `${hour}a`
  if (hour === 12) return "12p"
  return `${hour - 12}p`
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => buildHourLabel(i))

function buildActivityMatrix(
  torrents: { added_on: number }[]
): [number, number, number][] {
  const counts: number[][] = Array.from({ length: 24 }, () =>
    Array.from({ length: 7 }, () => 0)
  )

  for (const torrent of torrents) {
    if (!torrent.added_on || torrent.added_on <= 0) continue
    const date = new Date(torrent.added_on * 1000)
    const hour = date.getHours()
    const day = date.getDay()
    counts[hour][day]++
  }

  const data: [number, number, number][] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let day = 0; day < 7; day++) {
      data.push([hour, day, counts[hour][day]])
    }
  }
  return data
}

function buildFleetActivityHeatmapOption(
  data: [number, number, number][],
  maxCount: number
): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
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
    grid: {
      left: 48,
      right: 24,
      top: 16,
      bottom: 40,
    },
    xAxis: {
      type: "category",
      data: HOUR_LABELS,
      splitArea: { show: false },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        interval: 1,
        formatter: (_val: string, index: number) =>
          index % 2 === 0 ? _val : "",
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
          CHART_THEME.accentGlow,
          CHART_THEME.accentGlow60,
          CHART_THEME.accent,
        ],
      },
    },
    series: [
      {
        type: "heatmap",
        data,
        itemStyle: {
          borderRadius: 3,
          borderWidth: 2,
          borderColor: CHART_THEME.surface,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: CHART_THEME.accentGlow40,
          },
        },
      },
    ],
  }
}

function FleetActivityHeatmap({
  torrents,
  height = 260,
}: FleetActivityHeatmapProps) {
  if (torrents.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  const data = buildActivityMatrix(torrents)
  const maxCount = Math.max(...data.map(([, , c]) => c), 0)

  return (
    <ReactECharts
      option={buildFleetActivityHeatmapOption(data, maxCount)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export type { FleetActivityHeatmapProps }
export { buildActivityMatrix, buildHourLabel, FleetActivityHeatmap }
