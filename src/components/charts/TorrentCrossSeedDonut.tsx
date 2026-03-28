// src/components/charts/TorrentCrossSeedDonut.tsx
"use client"

import { formatCount, getComplementaryColor, hexToRgba } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildDonutShell } from "./lib/chart-helpers"
import { CHART_THEME, chartTooltip, escHtml } from "./lib/theme"

interface TorrentCrossSeedDonutProps {
  crossSeeded: number
  unique: number
  accentColor: string
}

function TorrentCrossSeedDonut({ crossSeeded, unique, accentColor }: TorrentCrossSeedDonutProps) {
  const total = crossSeeded + unique

  if (total === 0) {
    return <ChartEmptyState height={300} message="No cross-seed data available" />
  }

  const secondaryColor = getComplementaryColor(accentColor)

  const crossPct = total > 0 ? ((crossSeeded / total) * 100).toFixed(1) : "0"

  const option = {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      borderColor: accentColor,
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; color: string }
        const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0"
        return `<span style="color:${p.color};">●</span> <b>${escHtml(p.name)}</b><br/>${formatCount(p.value)} torrents · ${pct}%`
      },
    }),
    graphic: [
      {
        type: "text",
        left: "center",
        top: "38%",
        style: {
          text: `${crossPct}%`,
          fill: CHART_THEME.textPrimary,
          fontSize: 24,
          fontWeight: "bold",
          fontFamily: CHART_THEME.fontMono,
          textAlign: "center" as const,
        },
      },
      {
        type: "text",
        left: "center",
        top: "50%",
        style: {
          text: "cross-seeded",
          fill: CHART_THEME.textTertiary,
          fontSize: CHART_THEME.fontSizeDense,
          fontFamily: CHART_THEME.fontMono,
          textAlign: "center" as const,
        },
      },
    ],
    series: [
      {
        ...buildDonutShell(),
        label: { show: false },
        emphasis: {
          label: { show: false },
          itemStyle: { shadowBlur: 12, shadowColor: hexToRgba(accentColor, 0.5) },
        },
        data: [
          {
            name: "Cross-seeded",
            value: crossSeeded,
            itemStyle: { color: accentColor },
          },
          {
            name: "Unique",
            value: unique,
            itemStyle: { color: secondaryColor },
          },
        ],
      },
    ],
  }

  return <ChartECharts option={option} style={{ height: 300, width: "100%" }} />
}

export type { TorrentCrossSeedDonutProps }
export { TorrentCrossSeedDonut }
