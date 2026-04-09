// src/components/charts/TagCountTrends.tsx
"use client"

import type { EChartsOption } from "echarts"
import { useMemo } from "react"
import type { FleetSnapshot } from "@/lib/fleet"
import { extractTagsFromSnapshots } from "@/lib/fleet"
import { formatCount } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildAxisPointer, buildTimeXAxis } from "./lib/chart-helpers"
import {
  buildTagColors,
  CHART_THEME,
  chartAxisLabel,
  chartGrid,
  chartLegend,
  chartTooltip,
  chartTooltipHeader,
  chartTooltipRow,
  formatChartTimestamp,
} from "./lib/theme"

type TagCountMode = "seeding" | "leeching"

interface TagCountTrendsProps {
  snapshots: FleetSnapshot[]
  mode: TagCountMode
  height?: number
}

function buildSeriesData(
  snapshots: FleetSnapshot[],
  tags: string[],
  mode: TagCountMode
): Map<string, [number, number][]> {
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
      tagAccum.set(stat.tag, prev + (mode === "seeding" ? stat.seedingCount : stat.leechingCount))
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

function buildOption(snapshots: FleetSnapshot[], mode: TagCountMode): EChartsOption {
  const tags = extractTagsFromSnapshots(snapshots)
  const colorMap = buildTagColors(tags)
  const seriesMap = buildSeriesData(snapshots, tags, mode)

  const isSeeding = mode === "seeding"

  const series: NonNullable<EChartsOption["series"]> = tags.map((tag) => {
    const color = colorMap.get(tag) ?? CHART_THEME.chartFallback
    return {
      name: tag,
      type: "line",
      data: seriesMap.get(tag) ?? [],
      smooth: true,
      lineStyle: { width: isSeeding ? 2 : 1.5, color },
      itemStyle: { color },
      ...(isSeeding
        ? { stack: "seeding", symbol: "none", areaStyle: { opacity: 0.3 } }
        : { symbol: "circle", symbolSize: 3 }),
    }
  })

  return {
    backgroundColor: "transparent",
    color: tags.map((t) => colorMap.get(t) ?? CHART_THEME.chartFallback),
    legend: chartLegend(),
    tooltip: chartTooltip("axis", {
      axisPointer: buildAxisPointer(),
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
          .map((item) => chartTooltipRow(item.color, item.seriesName, formatCount(item.value[1])))
          .join("<br/>")

        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    grid: chartGrid({ right: 16, left: 56 }),
    xAxis: {
      ...buildTimeXAxis(),
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: isSeeding ? "Seeding" : "Leeching",
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => formatCount(Math.round(val)),
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    series,
  }
}

function TagCountTrends({ snapshots, mode, height = 360 }: TagCountTrendsProps) {
  const option = useMemo(() => buildOption(snapshots, mode), [snapshots, mode])

  const hasTagStats = snapshots.some((s) => s.tagStats && s.tagStats.length > 0)

  if (!hasTagStats) {
    return (
      <ChartEmptyState
        height={height}
        message={
          mode === "seeding"
            ? "No tag seeding data available yet."
            : "No tag leeching data available yet."
        }
      />
    )
  }

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { TagCountTrendsProps }
export { TagCountTrends }
