// src/components/charts/DistributionChart.tsx
//
// Functions: buildPieOption, DistributionChart

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { formatBytesFromString } from "@/lib/formatters"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartTooltip } from "./theme"

interface TrackerSlice {
  name: string
  color: string
  uploadedBytes: string | null
  seedingCount: number | null
}

interface DistributionChartProps {
  trackers: TrackerSlice[]
  height?: number
}

function buildPieOption(
  title: string,
  data: { name: string; value: number; color: string }[],
  formatValue: (v: number) => string
): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number; color: string }
        return (
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;box-shadow:0 0 6px ${p.color};"></span>` +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${p.name}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${formatValue(p.value)}</span>` +
          `<span style="color:${CHART_THEME.textTertiary};"> · ${p.percent}%</span>`
        )
      },
    }),
    title: {
      text: title,
      left: "center",
      top: 0,
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
        fontWeight: 500,
      },
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["50%", "55%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: "#282a36",
          borderWidth: 2,
        },
        label: {
          show: true,
          position: "outside",
          color: CHART_THEME.textTertiary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 10,
          formatter: "{b}",
        },
        labelLine: {
          lineStyle: { color: "rgba(148, 163, 184, 0.3)" },
          length: 10,
          length2: 8,
        },
        emphasis: {
          label: { show: true, fontWeight: "bold", color: "#e2e8f0" },
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,0,0,0.3)" },
        },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color },
        })),
      },
    ],
  }
}

function DistributionChart({ trackers, height = 300 }: DistributionChartProps) {
  const uploadData = trackers
    .filter((t) => t.uploadedBytes !== null)
    .map((t) => ({
      name: t.name,
      value: Number(BigInt(t.uploadedBytes as string)),
      color: t.color,
    }))

  const seedingData = trackers
    .filter((t) => t.seedingCount != null && t.seedingCount > 0)
    .map((t) => ({
      name: t.name,
      value: t.seedingCount as number,
      color: t.color,
    }))

  const hasUpload = uploadData.some((d) => d.value > 0)
  const hasSeeding = seedingData.some((d) => d.value > 0)

  if (!hasUpload && !hasSeeding) {
    return <ChartEmptyState height={height} message="No distribution data yet" />
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {hasUpload && (
        <ReactECharts
          option={buildPieOption("Upload Share", uploadData, (v) =>
            formatBytesFromString(v.toString())
          )}
          style={{ height, width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
          lazyUpdate
        />
      )}
      {hasSeeding && (
        <ReactECharts
          option={buildPieOption("Seeding Share", seedingData, (v) =>
            `${v.toLocaleString()} torrents`
          )}
          style={{ height, width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
          lazyUpdate
        />
      )}
    </div>
  )
}

export { DistributionChart }
export type { DistributionChartProps, TrackerSlice }
