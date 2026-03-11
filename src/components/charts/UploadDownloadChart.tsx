// src/components/charts/UploadDownloadChart.tsx
//
// Functions: buildOption, UploadDownloadChart

"use client"

import type { EChartsOption } from "echarts"
import { ChartECharts } from "./ChartECharts"
import { bytesToGiB, getComplementaryColor, hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml } from "./theme"

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
  const labels = snapshots.map((s) =>
    new Date(s.polledAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  )

  // Convert to GiB, then auto-detect whether TiB is more readable
  const uploadGiB = snapshots.map((s) => bytesToGiB(s.uploadedBytes))
  const downloadGiB = snapshots.map((s) => bytesToGiB(s.downloadedBytes))
  const maxGiB = Math.max(...uploadGiB, ...downloadGiB, 0)
  const useTiB = maxGiB >= 1024
  const divisor = useTiB ? 1024 : 1
  const unit = useTiB ? "TiB" : "GiB"

  const uploadData = uploadGiB.map((v) => Number((v / divisor).toFixed(3)))
  const downloadData = downloadGiB.map((v) => Number((v / divisor).toFixed(3)))

  // Adaptive dot size based on data density
  const dotSize = snapshots.length > 100 ? 2 : snapshots.length > 30 ? 4 : 6

  const complementColor = getComplementaryColor(accentColor)

  const fmtNum = (v: number, decimals = 2): string =>
    v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })

  // Dynamic Y-axis padding — recalculates when series are toggled via legend
  const yAxisPad = (value: { min: number; max: number }) => {
    const range = value.max - value.min
    return Math.max(range * 0.15, (value.max || 1) * 0.001)
  }

  const dataZoom: EChartsOption["dataZoom"] = []
  if (showDataZoom) {
    dataZoom.push({
      type: "slider",
      bottom: 8,
      height: 24,
      borderColor: CHART_THEME.gridLine,
      backgroundColor: CHART_THEME.surfaceSemi,
      fillerColor: hexToRgba(accentColor, 0.06),
      handleStyle: { color: accentColor, borderColor: accentColor },
      moveHandleStyle: { color: accentColor },
      handleLabel: { show: false },
      selectedDataBackground: {
        lineStyle: { color: accentColor, opacity: 0.3 },
        areaStyle: { color: accentColor, opacity: 0.05 },
      },
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
    })
  }

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 16, bottom: showDataZoom ? 80 : 40, left: 64 }),
    tooltip: chartTooltip("axis", {
      borderColor: accentColor,
      axisPointer: {
        type: "line",
        lineStyle: {
          color: accentColor,
          opacity: 0.3,
          width: 1,
          type: "dashed",
        },
      },
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
            const altVal = useTiB ? item.value * 1024 : item.value / 1024
            const altUnit = useTiB ? "GiB" : "TiB"
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
      axisLabel: chartAxisLabel({ rotate: 30, interval: "auto" }),
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: unit,
      scale: true,
      // ECharts accepts function callbacks for min/max that recalculate when
      // series are toggled via legend — the echarts TS types don't express this
      min: ((value: { min: number; max: number }) =>
        Math.max(0, Math.floor((value.min - yAxisPad(value)) * 100) / 100)) as unknown as number,
      max: ((value: { min: number; max: number }) =>
        Math.ceil((value.max + yAxisPad(value)) * 100) / 100) as unknown as number,
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
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(accentColor, 0.25) },
              { offset: 1, color: hexToRgba(accentColor, 0) },
            ],
          },
        },
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
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(complementColor, 0.2) },
              { offset: 1, color: hexToRgba(complementColor, 0) },
            ],
          },
        },
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

export { UploadDownloadChart }
export type { UploadDownloadChartProps }
