// src/components/charts/FleetCrossSeedDonut.tsx

"use client"

import type { EChartsOption } from "echarts"
import { useMemo } from "react"
import { formatCount } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildDonutShell } from "./lib/chart-helpers"
import { CHART_THEME, chartDot, chartTooltip, escHtml } from "./lib/theme"

interface FleetCrossSeedDonutProps {
  crossSeeded: number
  unique: number
  total: number
  height?: number
}

function buildFleetCrossSeedOption(
  crossSeeded: number,
  unique: number,
  total: number
): EChartsOption {
  const crossPct = total > 0 ? ((crossSeeded / total) * 100).toFixed(1) : "0.0"
  const uniquePct = total > 0 ? ((unique / total) * 100).toFixed(1) : "0.0"

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number; color: string }
        return (
          chartDot(p.color) +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(p.name)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${formatCount(p.value)} torrents</span>` +
          `<span style="color:${CHART_THEME.textTertiary};"> · ${p.percent}%</span>`
        )
      },
    }),
    graphic: [
      {
        type: "text",
        left: "center",
        top: "middle",
        style: {
          text: formatCount(total),
          fill: CHART_THEME.textPrimary,
          fontSize: 20,
          fontWeight: "bold",
          fontFamily: CHART_THEME.fontMono,
        },
      },
      {
        type: "text",
        left: "center",
        top: "56%",
        style: {
          text: "total",
          fill: CHART_THEME.textTertiary,
          fontSize: CHART_THEME.fontSizeCompact,
          fontFamily: CHART_THEME.fontMono,
        },
      },
    ],
    series: [
      {
        ...buildDonutShell({ labelLineLength: [10, 8] }),
        label: {
          show: true,
          position: "outside",
          color: CHART_THEME.textTertiary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeCompact,
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number }
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0.0"
            return `${p.name}\n${pct}%`
          },
        },
        emphasis: {
          label: { show: true, fontWeight: "bold", color: CHART_THEME.textPrimary },
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,0,0,0.3)" },
        },
        data: [
          {
            name: "Cross-seeded",
            value: crossSeeded,
            itemStyle: { color: CHART_THEME.accent },
            label: {
              color: CHART_THEME.accent,
              formatter: () => `Cross-seeded\n${crossPct}%`,
            },
          },
          {
            name: "Unique",
            value: unique,
            itemStyle: { color: CHART_THEME.borderMid },
            label: {
              color: CHART_THEME.textTertiary,
              formatter: () => `Unique\n${uniquePct}%`,
            },
          },
        ],
      },
    ],
  }
}

function FleetCrossSeedDonut({
  crossSeeded,
  unique,
  total,
  height = 280,
}: FleetCrossSeedDonutProps) {
  const option = useMemo(
    () => buildFleetCrossSeedOption(crossSeeded, unique, total),
    [crossSeeded, unique, total]
  )

  if (total === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { FleetCrossSeedDonutProps }
export { FleetCrossSeedDonut }
