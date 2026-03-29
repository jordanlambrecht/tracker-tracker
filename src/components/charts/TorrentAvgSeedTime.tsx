// src/components/charts/TorrentAvgSeedTime.tsx

"use client"

import type { EChartsOption } from "echarts"
import type { TorrentInfo } from "@/lib/torrent-utils"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildGlowAreaStyle, buildTimeXAxis } from "./lib/chart-helpers"
import { CHART_THEME, chartGrid, chartTooltip, chartTooltipRow } from "./lib/theme"

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

function TorrentAvgSeedTime({ torrents, accentColor }: TorrentAvgSeedTimeProps) {
  const withDates = torrents.filter((t) => t.addedOn > 0 && t.seedingTime > 0)
  if (withDates.length === 0) return <ChartEmptyState height={280} message="No seed time data" />

  const byMonth = new Map<string, { total: number; count: number }>()
  for (const t of withDates) {
    const d = new Date(t.addedOn * 1000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const entry = byMonth.get(key) ?? { total: 0, count: 0 }
    entry.total += t.seedingTime
    entry.count += 1
    byMonth.set(key, entry)
  }

  // Convert month keys to [timestamp, avgDays] pairs
  const seriesData: [number, number][] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => [
      new Date(`${key}-15T12:00:00`).getTime(),
      Math.floor(v.total / v.count / 86400),
    ])

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", {
      formatter: (params: unknown) => {
        const p = (params as { value: [number, number] }[])[0]
        if (!p) return ""
        const label = new Date(p.value[0]).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
        return (
          `<div style="margin-bottom:4px;color:${CHART_THEME.textTertiary};font-size:${CHART_THEME.fontSizeDense}px;">${label}</div>` +
          chartTooltipRow(accentColor, "Avg Seed Time", `${p.value[1]}d`)
        )
      },
    }),
    grid: chartGrid({ top: 16, right: 16, bottom: 32, left: 48 }),
    xAxis: buildTimeXAxis(),
    yAxis: {
      type: "value",
      name: "Days",
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    series: [
      {
        type: "line",
        data: seriesData,
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: accentColor, width: 2, shadowColor: accentColor, shadowBlur: 8 },
        itemStyle: { color: accentColor },
        areaStyle: buildGlowAreaStyle(accentColor, 0.3, 0.02),
        emphasis: {
          lineStyle: { shadowBlur: 16, shadowColor: accentColor },
        },
      },
    ],
  }

  return <ChartECharts option={option} style={{ height: 280, width: "100%" }} />
}

export type { TorrentAvgSeedTimeProps }
export { TorrentAvgSeedTime }
