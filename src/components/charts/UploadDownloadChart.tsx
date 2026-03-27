// src/components/charts/UploadDownloadChart.tsx
//
// Functions: buildOption, UploadDownloadChart

"use client"

import type { EChartsOption } from "echarts"
import { bytesToGiB, getComplementaryColor } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import {
  adaptiveDotSize,
  autoByteScale,
  buildAxisPointer,
  buildGlowAreaStyle,
  buildTimeXAxis,
  fmtNum,
  yAxisAutoRange,
} from "./lib/chart-helpers"
import {
  CHART_THEME,
  chartAxisLabel,
  chartDataZoom,
  chartDot,
  chartGrid,
  chartLegend,
  chartTooltip,
  chartTooltipHeader,
  escHtml,
  formatChartTimestamp,
} from "./lib/theme"

interface UploadDownloadChartProps {
  snapshots: Snapshot[]
  accentColor?: string
  height?: number
  showDataZoom?: boolean
}

function buildOption(
  snapshots: Snapshot[],
  accentColor: string,
  showDataZoom: boolean
): EChartsOption {
  // Convert to GiB, then auto-detect whether TiB is more readable
  const allGiB = snapshots.flatMap((s) => [
    bytesToGiB(s.uploadedBytes),
    bytesToGiB(s.downloadedBytes),
  ])
  const maxGiB = Math.max(...allGiB, 0)
  const { divisor, unit } = autoByteScale(maxGiB)

  const uploadData: [number, number][] = []
  const downloadData: [number, number][] = []
  for (const s of snapshots) {
    const ts = new Date(s.polledAt).getTime()
    const up = bytesToGiB(s.uploadedBytes)
    const down = bytesToGiB(s.downloadedBytes)
    if (up !== null) uploadData.push([ts, Number((up / divisor).toFixed(3))])
    if (down !== null) downloadData.push([ts, Number((down / divisor).toFixed(3))])
  }

  const dotSize = adaptiveDotSize(snapshots.length)
  const complementColor = getComplementaryColor(accentColor)

  // Dynamic Y-axis padding — recalculates when series are toggled via legend
  const dataZoom: EChartsOption["dataZoom"] = showDataZoom
    ? (chartDataZoom(accentColor) as EChartsOption["dataZoom"])
    : []

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 40, right: 16, bottom: showDataZoom ? 80 : 40, left: 64 }),
    tooltip: chartTooltip("axis", {
      borderColor: accentColor,
      axisPointer: buildAxisPointer(accentColor, 0.3, 1),
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: [number, number]
          color: string
        }>
        if (!items || items.length === 0) return ""
        const time = formatChartTimestamp(items[0].value[0])
        const rows = items
          .map((item) => {
            const val = item.value[1]
            const primary = `${fmtNum(val)} ${unit}`
            const altVal = unit === "TiB" ? val * 1024 : val / 1024
            const altUnit = unit === "TiB" ? "GiB" : "TiB"
            const alt = `${fmtNum(altVal)} ${altUnit}`
            return (
              chartDot(item.color) +
              `<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> ` +
              `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${primary}</span>` +
              `<span style="color:${CHART_THEME.textTertiary};font-size:${CHART_THEME.fontSizeCompact}px;"> (${alt})</span>`
            )
          })
          .join("<br/>")
        return chartTooltipHeader(time) + rows
      },
    }),
    legend: chartLegend(),
    xAxis: buildTimeXAxis(),
    yAxis: {
      type: "value",
      name: unit,
      scale: true,
      ...yAxisAutoRange(),
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => fmtNum(val, 1),
      }),
      splitLine: {
        lineStyle: {
          color: CHART_THEME.gridLine,
          width: 1,
        },
      },
    },
    dataZoom,
    series: [
      {
        name: "Uploaded",
        type: "line",
        data: uploadData,
        smooth: true,
        symbol: "circle",
        symbolSize: dotSize,
        itemStyle: { color: accentColor },
        lineStyle: {
          color: accentColor,
          width: 2,
          shadowColor: accentColor,
          shadowBlur: 8,
        },
        areaStyle: buildGlowAreaStyle(accentColor),
        emphasis: {
          lineStyle: {
            shadowBlur: 16,
            shadowColor: accentColor,
          },
        },
      },
      {
        name: "Downloaded",
        type: "line",
        data: downloadData,
        smooth: true,
        symbol: "circle",
        symbolSize: dotSize,
        itemStyle: { color: complementColor },
        lineStyle: {
          color: complementColor,
          width: 2,
          shadowColor: complementColor,
          shadowBlur: 8,
        },
        areaStyle: buildGlowAreaStyle(complementColor, 0.2),
        emphasis: {
          lineStyle: {
            shadowBlur: 16,
            shadowColor: complementColor,
          },
        },
      },
    ],
  }
}

function UploadDownloadChart({
  snapshots,
  accentColor = CHART_THEME.accent,
  height = 400,
  showDataZoom = false,
}: UploadDownloadChartProps) {
  if (snapshots.length === 0) {
    return (
      <ChartEmptyState height={height} message="No snapshot data yet. Waiting for first poll..." />
    )
  }

  return (
    <ChartECharts
      option={buildOption(snapshots, accentColor, showDataZoom)}
      style={{ height, width: "100%" }}
    />
  )
}

export type { UploadDownloadChartProps }
export { UploadDownloadChart }
