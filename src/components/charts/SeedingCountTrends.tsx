// src/components/charts/SeedingCountTrends.tsx
//
// Functions: buildSeriesData, buildOption, SeedingCountTrends

"use client"

import type { EChartsOption } from "echarts"
import { ChartECharts } from "./ChartECharts"
import type { FleetSnapshot } from "@/lib/fleet"
import { extractTagsFromSnapshots } from "@/lib/fleet"
import { ChartEmptyState } from "./ChartEmptyState"
import { buildTagColors, CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml, formatChartTimestamp } from "./theme"

interface SeedingCountTrendsProps {
  snapshots: FleetSnapshot[]
  height?: number
}

function buildSeriesData(
  snapshots: FleetSnapshot[],
  tags: string[]
): Map<string, [number, number][]> {
  // For each tag, accumulate seedingCount per timestamp across all clients
  const timeTagMap = new Map<number, Map<string, number>>()

  for (const snap of snapshots) {
    if (!snap.tagStats) continue
    const ts = new Date(snap.polledAt).getTime()

    let tagAccum = timeTagMap.get(ts)
    if (!tagAccum) {
      tagAccum = new Map<string, number>()
      timeTagMap.set(ts, tagAccum)
    }

    for (const stat of snap.tagStats) {
      const prev = tagAccum.get(stat.tag) ?? 0
      tagAccum.set(stat.tag, prev + stat.seedingCount)
    }
  }

  const sortedTimestamps = Array.from(timeTagMap.keys()).sort((a, b) => a - b)
  const seriesMap = new Map<string, [number, number][]>()

  for (const tag of tags) {
    const points: [number, number][] = []
    for (const ts of sortedTimestamps) {
      const tagAccum = timeTagMap.get(ts)
      const count = tagAccum ? (tagAccum.get(tag) ?? 0) : 0
      points.push([ts, count])
    }
    seriesMap.set(tag, points)
  }

  return seriesMap
}

function buildOption(snapshots: FleetSnapshot[]): EChartsOption {
  const tags = extractTagsFromSnapshots(snapshots)
  const colorMap = buildTagColors(tags)
  const seriesMap = buildSeriesData(snapshots, tags)

  const series: NonNullable<EChartsOption["series"]> = tags.map((tag) => ({
    name: tag,
    type: "line",
    stack: "seeding",
    data: seriesMap.get(tag) ?? [],
    smooth: true,
    symbol: "none",
    areaStyle: { opacity: 0.3 },
    lineStyle: { width: 2, color: colorMap.get(tag) ?? CHART_THEME.chartFallback },
    itemStyle: { color: colorMap.get(tag) ?? CHART_THEME.chartFallback },
  }))

  return {
    backgroundColor: "transparent",
    color: tags.map((t) => colorMap.get(t) ?? CHART_THEME.chartFallback),
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
        }>
        if (!items?.length) return ""

        const ts = items[0].value[0]
        const dateLabel = formatChartTimestamp(ts)

        const rows = items
          .filter((item) => item.value[1] > 0)
          .sort((a, b) => b.value[1] - a.value[1])
          .map((item) => {
            const dot = chartDot(item.color)
            const count = item.value[1].toLocaleString()
            return `${dot}<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> <span style="color:${CHART_THEME.textPrimary};font-weight:600;">${count}</span>`
          })
          .join("<br/>")

        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    grid: chartGrid({ right: 16, left: 56 }),
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "Seeding",
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => val.toLocaleString(),
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    series,
  }
}

function SeedingCountTrends({ snapshots, height = 360 }: SeedingCountTrendsProps) {
  const hasTagStats = snapshots.some((s) => s.tagStats && s.tagStats.length > 0)

  if (!hasTagStats) {
    return (
      <ChartEmptyState
        height={height}
        message="No tag seeding data available yet."
      />
    )
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

export { SeedingCountTrends }
export type { SeedingCountTrendsProps }
