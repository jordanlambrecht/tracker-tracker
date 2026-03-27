// src/components/charts/PercentileRadarChart.tsx
//
// Functions: PercentileRadarChart

"use client"

import { useMemo } from "react"
import { hexToRgba } from "@/lib/formatters"
import type { GazelleRanks } from "@/types/api"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { CHART_THEME, chartTooltip, chartTooltipRow } from "./lib/theme"

interface PercentileRadarChartProps {
  ranks: GazelleRanks
  accentColor: string
}

const AXIS_LABELS: { key: keyof GazelleRanks; label: string }[] = [
  { key: "uploaded", label: "Uploaded" },
  { key: "overall", label: "Overall" },
  { key: "artists", label: "Artists" },
  { key: "posts", label: "Posts" },
  { key: "bounty", label: "Bounty" },
  { key: "requests", label: "Requests" },
  { key: "uploads", label: "Uploads" },
  { key: "downloaded", label: "Downloaded" },
]

function PercentileRadarChart({ ranks, accentColor }: PercentileRadarChartProps) {
  const allZero = AXIS_LABELS.every(({ key }) => !ranks[key])

  const option = useMemo(() => {
    const indicator = AXIS_LABELS.map(({ label }) => ({
      name: label,
      max: 100,
    }))

    const values = AXIS_LABELS.map(({ key }) => ranks[key] ?? 0)

    return {
      radar: {
        indicator,
        shape: "circle" as const,
        radius: "65%",
        axisName: {
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeDense,
        },
        splitArea: {
          areaStyle: {
            color: ["transparent", "rgba(148, 163, 184, 0.02)"],
          },
        },
        splitLine: {
          lineStyle: {
            color: CHART_THEME.gridLine,
          },
        },
        axisLine: {
          lineStyle: {
            color: CHART_THEME.gridLine,
          },
        },
      },
      tooltip: chartTooltip("item", {
        borderColor: accentColor,
        formatter: (params: { value: number[] }) => {
          return AXIS_LABELS.map(({ label }, i) =>
            chartTooltipRow(accentColor, label, `${params.value[i]}th`)
          ).join("<br/>")
        },
      }),
      series: [
        {
          type: "radar" as const,
          data: [
            {
              value: values,
              name: "Percentile Rank",
              areaStyle: {
                color: hexToRgba(accentColor, 0.15),
              },
              lineStyle: {
                color: accentColor,
                width: 2,
              },
              itemStyle: {
                color: accentColor,
                borderColor: accentColor,
                borderWidth: 1,
              },
              symbol: "circle",
              symbolSize: 6,
            },
          ],
          animationDuration: 600,
          animationEasing: "cubicOut" as const,
        },
      ],
    }
  }, [ranks, accentColor])

  if (allZero) {
    return <ChartEmptyState height={320} message="No percentile rank data available" />
  }

  return <ChartECharts option={option} style={{ height: 320, width: "100%" }} />
}

export type { PercentileRadarChartProps }
export { PercentileRadarChart }
