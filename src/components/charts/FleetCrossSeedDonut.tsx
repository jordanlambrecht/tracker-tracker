// src/components/charts/FleetCrossSeedDonut.tsx
//
// Functions: buildFleetCrossSeedOption, FleetCrossSeedDonut

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { parseTorrentTags } from "@/lib/fleet"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartDot, chartTooltip, escHtml } from "./theme"

interface FleetCrossSeedDonutProps {
  torrents: { tags: string }[]
  crossSeedTags: string[]
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
          `<span style="color:${CHART_THEME.textSecondary};">${p.value.toLocaleString()} torrents</span>` +
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
          text: total.toLocaleString(),
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
          fontSize: 10,
          fontFamily: CHART_THEME.fontMono,
        },
      },
    ],
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
        },
        label: {
          show: true,
          position: "outside",
          color: CHART_THEME.textTertiary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 10,
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number }
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0.0"
            return `${p.name}\n${pct}%`
          },
        },
        labelLine: {
          lineStyle: { color: CHART_THEME.borderMid },
          length: 10,
          length2: 8,
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
  torrents,
  crossSeedTags,
  height = 280,
}: FleetCrossSeedDonutProps) {
  if (crossSeedTags.length === 0) {
    return (
      <ChartEmptyState
        height={height}
        message="No cross-seed tags configured"
      />
    )
  }

  if (torrents.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  const csTagSet = new Set(crossSeedTags.map((t) => t.toLowerCase()))
  let crossSeeded = 0
  for (const torrent of torrents) {
    if (parseTorrentTags(torrent.tags).some((tag) => csTagSet.has(tag))) {
      crossSeeded++
    }
  }
  const unique = torrents.length - crossSeeded

  return (
    <ReactECharts
      option={buildFleetCrossSeedOption(crossSeeded, unique, torrents.length)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export type { FleetCrossSeedDonutProps }
export { FleetCrossSeedDonut }
