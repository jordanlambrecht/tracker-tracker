// src/components/charts/SpeedThemeRiver.tsx
//
// Functions: buildRiverData, buildOption, SpeedThemeRiver

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { formatBytesFromNumber } from "@/lib/formatters"
import { extractTagsFromSnapshots } from "@/lib/fleet"
import type { FleetSnapshot } from "@/lib/fleet"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, buildTagColors, chartAxisLabel, chartDot, chartTooltip, chartTooltipHeader, escHtml, formatChartTimestamp } from "./theme"

interface SpeedThemeRiverProps {
  snapshots: FleetSnapshot[]
  height?: number
}

function buildRiverData(
  snapshots: FleetSnapshot[],
  tags: string[]
): [number, number, string][] {
  // Group snapshots by timestamp, sum speeds per tag across all clients
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
      tagAccum.set(stat.tag, prev + stat.uploadSpeed)
    }
  }

  const riverData: [number, number, string][] = []
  const sortedTimestamps = Array.from(timeTagMap.keys()).sort((a, b) => a - b)

  for (const ts of sortedTimestamps) {
    const tagAccum = timeTagMap.get(ts)
    if (!tagAccum) continue
    for (const tag of tags) {
      const speed = tagAccum.get(tag) ?? 0
      riverData.push([ts, speed, tag])
    }
  }

  return riverData
}

function buildOption(snapshots: FleetSnapshot[]): EChartsOption {
  const tags = extractTagsFromSnapshots(snapshots)
  const colorMap = buildTagColors(tags)
  const colors = tags.map((t) => colorMap.get(t) ?? "#888")
  const riverData = buildRiverData(snapshots, tags)

  return {
    backgroundColor: "transparent",
    color: colors,
    tooltip: chartTooltip("axis", {
      axisPointer: {
        type: "line",
        lineStyle: { color: "rgba(148, 163, 184, 0.3)", type: "dashed" },
      },
      formatter: (params: unknown) => {
        const items = params as Array<{
          value: [number, number, string]
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
            const speedLabel = `${formatBytesFromNumber(item.value[1])}/s`
            return `${dot}<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.value[2])}:</span> <span style="color:${CHART_THEME.textPrimary};font-weight:600;">${speedLabel}</span>`
          })
          .join("<br/>")

        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    singleAxis: {
      type: "time",
      bottom: 40,
      top: 32,
      axisLabel: chartAxisLabel(),
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
    },
    series: [
      {
        type: "themeRiver",
        data: riverData,
        label: {
          show: true,
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 10,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 20,
            shadowColor: "rgba(0, 0, 0, 0.4)",
          },
        },
      },
    ],
  } as EChartsOption
}

function SpeedThemeRiver({ snapshots, height = 360 }: SpeedThemeRiverProps) {
  const hasTagStats = snapshots.some((s) => s.tagStats && s.tagStats.length > 0)

  if (!hasTagStats) {
    return (
      <ChartEmptyState
        height={height}
        message="No tag speed data available yet."
      />
    )
  }

  return (
    <ReactECharts
      option={buildOption(snapshots)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { SpeedThemeRiver }
export type { SpeedThemeRiverProps }
