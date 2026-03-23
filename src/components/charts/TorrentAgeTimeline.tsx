// src/components/charts/TorrentAgeTimeline.tsx

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

interface TorrentAgeTimelineProps {
  torrents: TorrentInfo[]
  accentColor: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TorrentAgeTimeline({ torrents, accentColor }: TorrentAgeTimelineProps) {
  const withDates = torrents.filter((t) => t.addedOn > 0).sort((a, b) => a.addedOn - b.addedOn)
  if (withDates.length < 2) {
    return <ChartEmptyState height={220} message="Need 2+ torrents with dates" />
  }

  // Group by month, accumulate cumulative counts
  const monthMap = new Map<string, number>()
  let cumulative = 0
  for (const t of withDates) {
    const d = new Date(t.addedOn * 1000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    cumulative++
    monthMap.set(key, cumulative)
  }

  // Convert month keys to [timestamp, cumulativeCount] pairs
  const seriesData: [number, number][] = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => [new Date(`${key}-15T12:00:00`).getTime(), count])

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", {
      borderColor: accentColor,
      formatter: (params: unknown) => {
        const p = (params as { value: [number, number] }[])[0]
        if (!p) return ""
        const label = new Date(p.value[0]).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
        return (
          `<div style="margin-bottom:4px;color:${CHART_THEME.textTertiary};font-size:11px;">${label}</div>` +
          chartTooltipRow(accentColor, "Torrents", String(p.value[1]))
        )
      },
    }),
    grid: chartGrid({ left: 48, right: 16, top: 16, bottom: 40 }),
    xAxis: buildTimeXAxis(),
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
        data: seriesData,
        smooth: true,
        symbol: "none",
        lineStyle: {
          color: accentColor,
          width: 2,
          shadowColor: accentColor,
          shadowBlur: 8,
        },
        areaStyle: buildGlowAreaStyle(accentColor),
        emphasis: {
          lineStyle: { shadowBlur: 16, shadowColor: accentColor },
        },
      },
    ],
  }

  return <ChartECharts option={option} style={{ height: 220, width: "100%" }} />
}

export type { TorrentAgeTimelineProps }
export { TorrentAgeTimeline }
