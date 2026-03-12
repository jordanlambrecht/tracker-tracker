// src/components/charts/TorrentAvgSeedTime.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { CHART_THEME, escHtml } from "@/components/charts/theme"
import { hexToRgba } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TorrentAvgSeedTimeProps {
  torrents: TorrentInfo[]
  accentColor: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TorrentAvgSeedTime({ torrents, accentColor }: TorrentAvgSeedTimeProps) {
  const withDates = torrents.filter((t) => t.addedOn > 0 && t.seedingTime > 0)
  if (withDates.length === 0) return null

  const byMonth = new Map<string, { total: number; count: number }>()
  for (const t of withDates) {
    const d = new Date(t.addedOn * 1000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const entry = byMonth.get(key) ?? { total: 0, count: 0 }
    entry.total += t.seedingTime
    entry.count += 1
    byMonth.set(key, entry)
  }

  const sorted = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
  const labels = sorted.map(([k]) => k)
  const values = sorted.map(([, v]) => Math.floor(v.total / v.count / 86400))

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
        const p = (params as { name: string; value: number }[])[0]
        if (!p) return ""
        return `${escHtml(p.name)}<br/>Avg: <b>${p.value}d</b>`
      },
    },
    grid: { top: 16, right: 16, bottom: 32, left: 48 },
    xAxis: {
      type: "category",
      data: labels,
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
      name: "Days",
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: accentColor, width: 2 },
        itemStyle: { color: accentColor },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(accentColor, 0.3) },
              { offset: 1, color: hexToRgba(accentColor, 0.02) },
            ],
          },
        },
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 280, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
