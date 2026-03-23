// src/components/charts/SpeedThemeRiver.tsx
//
// Functions: buildRiverData, buildOption, SpeedThemeRiver

"use client"

import type { EChartsOption } from "echarts"
import type { FleetSnapshot } from "@/lib/fleet"
import { extractTagsFromSnapshots } from "@/lib/fleet"
import { formatBytesNum } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildAxisPointer, buildThemeRiverSingleAxis } from "./lib/chart-helpers"
import {
  buildTagColors,
  CHART_THEME,
  chartTooltip,
  chartTooltipHeader,
  chartTooltipRow,
  formatChartTimestamp,
} from "./lib/theme"

interface SpeedThemeRiverProps {
  snapshots: FleetSnapshot[]
  height?: number
}

function buildRiverData(snapshots: FleetSnapshot[], tags: string[]): [number, number, string][] {
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
  const colors = tags.map((t) => colorMap.get(t) ?? CHART_THEME.chartFallback)
  const riverData = buildRiverData(snapshots, tags)

  return {
    backgroundColor: "transparent",
    color: colors,
    tooltip: chartTooltip("axis", {
      axisPointer: buildAxisPointer(),
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
          .map((item) =>
            chartTooltipRow(item.color, item.value[2], `${formatBytesNum(item.value[1])}/s`)
          )
          .join("<br/>")

        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    singleAxis: buildThemeRiverSingleAxis({ top: 32 }),
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
    return <ChartEmptyState height={height} message="No tag speed data available yet." />
  }

  return <ChartECharts option={buildOption(snapshots)} style={{ height, width: "100%" }} />
}

export type { SpeedThemeRiverProps }
export { SpeedThemeRiver }
