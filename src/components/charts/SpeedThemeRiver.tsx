// src/components/charts/SpeedThemeRiver.tsx
"use client"

import type { EChartsOption } from "echarts"
import { useMemo } from "react"
import type { FleetSnapshot } from "@/lib/fleet"
import { extractTagsFromSnapshots } from "@/lib/fleet"
import { formatSpeed } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildAxisPointer, buildThemeRiverSingleAxis, floorTimestamp } from "./lib/chart-helpers"
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
  // Bucket snapshots by hour, averaging speeds per tag within each bucket.
  // This gives the river bands visible width at 7d/30d zoom levels.
  const bucketMap = new Map<number, Map<string, { sum: number; count: number }>>()

  for (const snap of snapshots) {
    if (!snap.tagStats) continue
    const bucket = floorTimestamp(new Date(snap.polledAt).getTime(), "hour")

    let tagAccum = bucketMap.get(bucket)
    if (!tagAccum) {
      tagAccum = new Map<string, { sum: number; count: number }>()
      bucketMap.set(bucket, tagAccum)
    }

    for (const stat of snap.tagStats) {
      const prev = tagAccum.get(stat.tag) ?? { sum: 0, count: 0 }
      tagAccum.set(stat.tag, { sum: prev.sum + stat.uploadSpeed, count: prev.count + 1 })
    }
  }

  const riverData: [number, number, string][] = []
  const sortedBuckets = Array.from(bucketMap.keys()).sort((a, b) => a - b)

  for (const bucket of sortedBuckets) {
    const tagAccum = bucketMap.get(bucket)
    if (!tagAccum) continue
    for (const tag of tags) {
      const entry = tagAccum.get(tag)
      const avgSpeed = entry ? entry.sum / entry.count : 0
      riverData.push([bucket, avgSpeed, tag])
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
          .map((item) => chartTooltipRow(item.color, item.value[2], formatSpeed(item.value[1])))
          .join("<br/>")

        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    singleAxis: buildThemeRiverSingleAxis({ top: 32 }),
    series: [
      {
        type: "themeRiver",
        data: riverData,
        label: { show: false },
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
  const option = useMemo(() => buildOption(snapshots), [snapshots])

  const hasTagStats = snapshots.some((s) => s.tagStats && s.tagStats.length > 0)

  if (!hasTagStats) {
    return <ChartEmptyState height={height} message="No tag speed data available yet." />
  }

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { SpeedThemeRiverProps }
export { SpeedThemeRiver }
