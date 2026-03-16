// src/components/charts/UploadDownloadChart.tsx
//
// Functions: buildOption, UploadDownloadChart

"use client"

import type { EChartsOption } from "echarts"
import { bytesToGiB, getComplementaryColor } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import { ChartECharts } from "./ChartECharts"
import { ChartEmptyState } from "./ChartEmptyState"
import { adaptiveDotSize, autoByteScale, buildAxisPointer, buildGlowAreaStyle, fmtNum, yAxisAutoRange } from "./chart-helpers"
import { buildSmartLabels, formatSnapshotLabel } from "./chart-transforms"
import { CHART_THEME, chartAxisLabel, chartDataZoom, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml } from "./theme"

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
  const labels = snapshots.map((s) => formatSnapshotLabel(s.polledAt))
  const smartLabels = buildSmartLabels(snapshots.map((s) => s.polledAt))

  // Convert to GiB, then auto-detect whether TiB is more readable
  const uploadGiB = snapshots.map((s) => bytesToGiB(s.uploadedBytes))
  const downloadGiB = snapshots.map((s) => bytesToGiB(s.downloadedBytes))
  const maxGiB = Math.max(...uploadGiB, ...downloadGiB, 0)
  const { divisor, unit } = autoByteScale(maxGiB)

  const uploadData = uploadGiB.map((v) => Number((v / divisor).toFixed(3)))
  const downloadData = downloadGiB.map((v) => Number((v / divisor).toFixed(3)))

  const dotSize = adaptiveDotSize(snapshots.length)
  const complementColor = getComplementaryColor(accentColor)

  // Dynamic Y-axis padding — recalculates when series are toggled via legend
  const dataZoom: EChartsOption["dataZoom"] = showDataZoom ? chartDataZoom(accentColor) as EChartsOption["dataZoom"] : []

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 40, right: 16, bottom: showDataZoom ? 80 : 40, left: 64 }),
    tooltip: chartTooltip("axis", {
      borderColor: accentColor,
      axisPointer: buildAxisPointer(accentColor, 0.3, 1),
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number
          color: string
          axisValueLabel: string
        }>
        if (!items || items.length === 0) return ""
        const time = items[0].axisValueLabel
        const rows = items
          .map((item) => {
            const primary = `${fmtNum(item.value)} ${unit}`
            const altVal = unit === "TiB" ? item.value * 1024 : item.value / 1024
            const altUnit = unit === "TiB" ? "GiB" : "TiB"
            const alt = `${fmtNum(altVal)} ${altUnit}`
            return (
              chartDot(item.color) +
              `<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> ` +
              `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${primary}</span>` +
              `<span style="color:${CHART_THEME.textTertiary};font-size:10px;"> (${alt})</span>`
            )
          })
          .join("<br/>")
        return chartTooltipHeader(time) + rows
      },
    }),
    legend: chartLegend(),
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: 30, interval: "auto", formatter: (_: string, idx: number) => smartLabels[idx] ?? "" }),
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: unit,
      scale: true,
      ...yAxisAutoRange(),
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
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
    return <ChartEmptyState height={height} message="No snapshot data yet. Waiting for first poll..." />
  }

  return (
    <ChartECharts
      option={buildOption(snapshots, accentColor, showDataZoom)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export type { UploadDownloadChartProps }
export { UploadDownloadChart }
