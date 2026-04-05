// src/components/charts/FleetSizeJitter.tsx
"use client"

import type { EChartsOption } from "echarts"
import { useMemo } from "react"
import type { TrackerSizes } from "@/lib/fleet-aggregation"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { autoByteScale, fmtNum } from "./lib/chart-helpers"
import { CHART_THEME, chartAxisLabel, chartDataZoom, chartTooltip, escHtml } from "./lib/theme"

interface FleetSizeJitterProps {
  data: TrackerSizes[]
  height?: number
}

function buildFleetSizeJitterOption(data: TrackerSizes[]): EChartsOption {
  const trackerNames = data.map((d) => d.name)

  // Find max size for scaling
  let maxBytes = 0
  for (const entry of data) {
    for (const s of entry.sizes) {
      if (s > maxBytes) maxBytes = s
    }
  }
  const { divisor, unit } = autoByteScale(maxBytes / 1024 ** 3)
  const scaleDivisor = 1024 ** 3 * divisor

  // Build one scatter series per tracker for coloring
  const series: NonNullable<EChartsOption["series"]> = data.map((entry, trackerIndex) => {
    // Gaussian jitter for beeswarm cloud that's wide spread, clamped to avoid overlap with neighbors
    const points = entry.sizes.map((sizeBytes) => {
      const u1 = Math.random()
      const u2 = Math.random()
      const gaussian = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2)
      const jitter = Math.max(-0.42, Math.min(0.42, gaussian * 0.25))
      return [trackerIndex + jitter, sizeBytes / scaleDivisor]
    })

    return {
      type: "scatter" as const,
      name: entry.name,
      data: points,
      large: true,
      symbolSize: 4,
      itemStyle: {
        color: entry.color,
        opacity: 0.45,
      },
      emphasis: {
        itemStyle: {
          opacity: 1,
          shadowBlur: 8,
          shadowColor: entry.color,
        },
      },
    }
  })

  return {
    animation: false,
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { seriesName: string; value: [number, number]; color: string }
        return (
          `<span style="color:${p.color};font-weight:600;">${escHtml(p.seriesName)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${fmtNum(p.value[1])} ${unit}</span>`
        )
      },
    }),
    grid: {
      left: 64,
      right: 24,
      top: 16,
      bottom: 48,
    },
    xAxis: {
      type: "category",
      data: trackerNames,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        rotate: trackerNames.length > 8 ? 30 : 0,
        interval: 0,
      }),
    },
    yAxis: {
      type: "log",
      name: unit,
      min: 0.001,
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => {
          if (val >= 1) return fmtNum(val, 0)
          if (val >= 0.01) return fmtNum(val, 2)
          return fmtNum(val, 3)
        },
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    legend: { show: false },
    dataZoom:
      trackerNames.length > 10
        ? [
            ...chartDataZoom(CHART_THEME.accent).map((z) => ({ ...z, start: 0, end: 100 })),
            { type: "inside", xAxisIndex: 0 },
          ]
        : undefined,
    series,
  }
}

function FleetSizeJitter({ data, height = 360 }: FleetSizeJitterProps) {
  // Memoize the full option so the jitter scatter points are stable across unrelated re-renders.
  // Hook must be unconditional, so it runs before any early return.
  const option = useMemo(() => buildFleetSizeJitterOption(data), [data])

  if (data.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { FleetSizeJitterProps }
export { FleetSizeJitter }
