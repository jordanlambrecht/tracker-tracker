// src/components/charts/TorrentAgeTimeline.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { CHART_THEME, escHtml } from "@/components/charts/theme"
import { hexToRgba } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TorrentAgeTimelineProps {
  torrents: TorrentInfo[]
  accentColor: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TorrentAgeTimeline({ torrents, accentColor }: TorrentAgeTimelineProps) {
  const withDates = torrents.filter((t) => t.addedOn > 0).sort((a, b) => a.addedOn - b.addedOn)
  if (withDates.length < 2) {
    return <p className="text-sm text-muted font-mono py-4">Need 2+ torrents with dates</p>
  }

  // Group by day
  const dayMap = new Map<string, number>()
  let cumulative = 0
  for (const t of withDates) {
    const day = new Date(t.addedOn * 1000).toISOString().split("T")[0]
    cumulative++
    dayMap.set(day, cumulative)
  }

  const labels = [...dayMap.keys()]
  const values = [...dayMap.values()]

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
      formatter: (params: unknown) => {
        const p = (params as { axisValueLabel: string; value: number }[])[0]
        if (!p) return ""
        return `${escHtml(String(p.axisValueLabel ?? ""))}<br/><span style="font-weight:600;color:${accentColor}">${p.value}</span> torrents`
      },
    },
    grid: { left: 48, right: 16, top: 16, bottom: 40 },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
        rotate: 30,
        interval: "auto",
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
        type: "line",
        data: values,
        smooth: true,
        symbol: "none",
        lineStyle: {
          color: accentColor,
          width: 2,
          shadowColor: accentColor,
          shadowBlur: 8,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(accentColor, 0.25) },
              { offset: 1, color: hexToRgba(accentColor, 0) },
            ],
          },
        },
        emphasis: {
          lineStyle: { shadowBlur: 16, shadowColor: accentColor },
        },
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 220, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
