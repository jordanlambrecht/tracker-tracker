// src/components/charts/SpeedHistoryChart.tsx
//
// Functions: parseSpeedBytes, buildOption, SpeedHistoryChart

"use client"

import type { EChartsOption } from "echarts"
import type { FleetSnapshot } from "@/lib/fleet"
import { formatBytesNum } from "@/lib/formatters"
import { ChartECharts } from "./ChartECharts"
import { ChartEmptyState } from "./ChartEmptyState"
import {
  CHART_THEME,
  chartAxisLabel,
  chartDot,
  chartGrid,
  chartLegend,
  chartTooltip,
  chartTooltipHeader,
  escHtml,
  formatChartTimestamp,
} from "./theme"

interface SpeedHistoryChartProps {
  snapshots: FleetSnapshot[]
  height?: number
}

const CYAN = CHART_THEME.accent
const AMBER = CHART_THEME.warn

function parseSpeedBytes(val: string | null): number {
  if (!val) return 0
  // Stored as bigint string; convert safely without losing precision for speeds
  // Speeds are typically well within Number.MAX_SAFE_INTEGER range
  const n = Number(BigInt(val))
  return Number.isFinite(n) ? n : 0
}

function buildOption(snapshots: FleetSnapshot[]): EChartsOption {
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
  )

  const uploadData: [number, number][] = []
  const downloadData: [number, number][] = []

  for (const snap of sorted) {
    const ts = new Date(snap.polledAt).getTime()
    const up = parseSpeedBytes(snap.uploadSpeedBytes)
    const down = parseSpeedBytes(snap.downloadSpeedBytes)
    uploadData.push([ts, up])
    downloadData.push([ts, down])
  }

  return {
    backgroundColor: "transparent",
    legend: chartLegend(),
    tooltip: chartTooltip("axis", {
      axisPointer: {
        type: "line",
        lineStyle: { color: CHART_THEME.borderMid, type: "dashed" },
      },
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: [number, number]
          color: string
          axisIndex: number
        }>
        if (!items?.length) return ""

        const ts = items[0].value[0]
        const dateLabel = formatChartTimestamp(ts)

        const rows = items
          .map((item) => {
            const dot = chartDot(item.color)
            const speedLabel = `${formatBytesNum(item.value[1])}/s`
            return `${dot}<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> <span style="color:${CHART_THEME.textPrimary};font-weight:600;">${speedLabel}</span>`
          })
          .join("<br/>")

        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    grid: chartGrid({ right: 64, left: 72 }),
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: "value",
        name: "Upload",
        nameTextStyle: {
          color: CYAN,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 10,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: chartAxisLabel({
          color: CYAN,
          formatter: (val: number) => `${formatBytesNum(val)}/s`,
        }),
        splitLine: {
          lineStyle: { color: CHART_THEME.gridLine, width: 1 },
        },
      },
      {
        type: "value",
        name: "Download",
        nameTextStyle: {
          color: AMBER,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 10,
        },
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: chartAxisLabel({
          color: AMBER,
          formatter: (val: number) => `${formatBytesNum(val)}/s`,
        }),
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Upload",
        type: "line",
        yAxisIndex: 0,
        data: uploadData,
        smooth: true,
        symbol: "none",
        itemStyle: { color: CYAN },
        lineStyle: { color: CYAN, width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: CHART_THEME.accentGlow },
              { offset: 1, color: "rgba(0, 212, 255, 0)" },
            ],
          },
        },
      },
      {
        name: "Download",
        type: "line",
        yAxisIndex: 1,
        data: downloadData,
        smooth: true,
        symbol: "none",
        itemStyle: { color: AMBER },
        lineStyle: { color: AMBER, width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: CHART_THEME.warnGlow },
              { offset: 1, color: "rgba(245, 158, 11, 0)" },
            ],
          },
        },
      },
    ],
  }
}

function SpeedHistoryChart({ snapshots, height = 360 }: SpeedHistoryChartProps) {
  const hasSpeedData = snapshots.some(
    (s) => s.uploadSpeedBytes !== null || s.downloadSpeedBytes !== null
  )

  if (!hasSpeedData) {
    return <ChartEmptyState height={height} message="No speed history data available yet." />
  }

  return (
    <ChartECharts
      option={buildOption(snapshots)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export type { SpeedHistoryChartProps }
export { SpeedHistoryChart }
