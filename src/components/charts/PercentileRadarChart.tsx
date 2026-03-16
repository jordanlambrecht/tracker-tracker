// src/components/charts/PercentileRadarChart.tsx
//
// Functions: PercentileRadarChart

"use client"

import ReactECharts from "echarts-for-react"
import { useMemo } from "react"
import { CHART_THEME, chartTooltip } from "@/components/charts/theme"
import { hexToRgba } from "@/lib/formatters"
import type { GazelleRanks } from "@/types/api"

export interface PercentileRadarChartProps {
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
  const option = useMemo(() => {
    const indicator = AXIS_LABELS.map(({ label }) => ({
      name: label,
      max: 100,
    }))

    const values = AXIS_LABELS.map(({ key }) => ranks[key] ?? 0)

    return {
      radar: {
        indicator,
        shape: "circle",
        radius: "65%",
        axisName: {
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 11,
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
        formatter: (params: { value: number[] }) => {
          return AXIS_LABELS.map(
            ({ label }, i) => `${label}: <b>${params.value[i]}th</b>`
          ).join("<br/>")
        },
      }),
      series: [
        {
          type: "radar",
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
          animationEasing: "cubicOut",
        },
      ],
    }
  }, [ranks, accentColor])

  return (
    <ReactECharts
      option={option}
      style={{ height: 320, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  )
}

export { PercentileRadarChart }
