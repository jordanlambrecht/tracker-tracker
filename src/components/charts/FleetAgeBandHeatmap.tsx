// src/components/charts/FleetAgeBandHeatmap.tsx
"use client"

import type { EChartsOption } from "echarts"
import { hexToRgba } from "@/lib/color-utils"
import { AGE_BUCKETS } from "@/lib/fleet"
import type { AgeBandEntry } from "@/lib/fleet-aggregation"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { CHART_THEME, chartTooltip, chartTooltipRow, escHtml } from "./lib/theme"

interface FleetAgeBandHeatmapProps {
  data: AgeBandEntry[]
  height?: number
}

function buildAgeBandHeatmapOption(trackers: AgeBandEntry[]): EChartsOption {
  const bucketLabels = AGE_BUCKETS.map((b) => b.label)
  const trackerNames = trackers.map((t) => t.name)

  let maxCount = 0
  const heatmapData: [number, number, number][] = []
  for (let y = 0; y < trackers.length; y++) {
    for (let x = 0; x < AGE_BUCKETS.length; x++) {
      const val = trackers[y].counts[x]
      heatmapData.push([x, y, val])
      if (val > maxCount) maxCount = val
    }
  }

  const axisLabelStyle = {
    color: CHART_THEME.textTertiary,
    fontFamily: CHART_THEME.fontMono,
    fontSize: CHART_THEME.fontSizeCompact,
  }

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { data: [number, number, number] }
        const [bucketIdx, trackerIdx, count] = p.data
        const tracker = trackers[trackerIdx]
        const bucket = bucketLabels[bucketIdx]
        const pct = tracker.total > 0 ? ((count / tracker.total) * 100).toFixed(1) : "0"
        return (
          `<div style="font-family:var(--font-mono),monospace;font-size:${CHART_THEME.fontSizeDense}px;` +
          `color:${CHART_THEME.textTertiary};margin-bottom:4px;">${escHtml(tracker.name)} · ${escHtml(bucket)}</div>` +
          chartTooltipRow(tracker.color, "Torrents", String(count)) +
          "<br/>" +
          chartTooltipRow(tracker.color, "Share", `${pct}%`)
        )
      },
    }),
    grid: {
      left: 12,
      right: 12,
      top: 12,
      bottom: 12,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: bucketLabels,
      position: "top",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabelStyle,
      splitArea: { show: false },
    },
    yAxis: {
      type: "category",
      data: trackerNames,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabelStyle,
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxCount || 1,
      inRange: {
        color: [
          hexToRgba(CHART_THEME.accent, 0.04),
          hexToRgba(CHART_THEME.accent, 0.15),
          hexToRgba(CHART_THEME.accent, 0.35),
          hexToRgba(CHART_THEME.accent, 0.6),
          hexToRgba(CHART_THEME.accent, 0.9),
        ],
      },
    },
    series: [
      {
        type: "heatmap",
        data: heatmapData,
        emphasis: {
          itemStyle: {
            borderColor: CHART_THEME.accent,
            borderWidth: 1,
          },
        },
        itemStyle: {
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
          borderRadius: 4,
        },
        label: {
          show: true,
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeDense,
          formatter: (params: unknown) => {
            const p = params as { data: [number, number, number] }
            return p.data[2] > 0 ? String(p.data[2]) : ""
          },
        },
      },
    ],
  }
}

function FleetAgeBandHeatmap({ data, height = 300 }: FleetAgeBandHeatmapProps) {
  if (data.length === 0) {
    return <ChartEmptyState height={height} message="No torrent age data available" />
  }

  const dynamicHeight = Math.max(height, 60 + data.length * 36)

  return (
    <ChartECharts
      option={buildAgeBandHeatmapOption(data)}
      style={{ height: dynamicHeight, width: "100%" }}
    />
  )
}

export type { FleetAgeBandHeatmapProps }
export { FleetAgeBandHeatmap }
