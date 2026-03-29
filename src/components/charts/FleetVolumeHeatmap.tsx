// src/components/charts/FleetVolumeHeatmap.tsx

"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { TabBar } from "@/components/ui/TabBar"
import { hexToRgba } from "@/lib/color-utils"
import type { FleetChartProps, TrackerSnapshotSeries, VolumeField } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { DAY_LABELS, formatGiB, HOUR_LABELS } from "./lib/chart-helpers"
import { CHART_THEME, chartAxisLabel, chartTooltip, chartTooltipRow, escHtml } from "./lib/theme"

interface FleetVolumeHeatmapProps extends FleetChartProps {}

/**
 * Build a 7x24 volume matrix from snapshot series.
 * For each consecutive snapshot pair, compute the byte delta and bucket
 * it by the dayOfWeek x hourOfDay of the later snapshot.
 * Returns values in GiB.
 */
function buildVolumeMatrix(
  trackerData: TrackerSnapshotSeries[],
  field: VolumeField
): { data: [number, number, number][]; maxValue: number } {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])

  for (const { snapshots } of trackerData) {
    if (snapshots.length < 2) continue
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
    )

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      const key = field === "upload" ? "uploadedBytes" : "downloadedBytes"
      const delta = Number(BigInt(curr[key]) - BigInt(prev[key]))
      if (delta <= 0) continue

      const d = new Date(curr.polledAt)
      grid[d.getDay()][d.getHours()] += delta / 1024 ** 3
    }
  }

  let maxValue = 0
  const data: [number, number, number][] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let day = 0; day < 7; day++) {
      const value = grid[day][hour]
      if (value > maxValue) maxValue = value
      data.push([hour, day, value])
    }
  }

  return { data, maxValue }
}

function buildFleetVolumeHeatmapOption(
  data: [number, number, number][],
  maxValue: number,
  field: VolumeField
): EChartsOption {
  const color = field === "upload" ? CHART_THEME.upload : CHART_THEME.download
  const label = field === "upload" ? "Uploaded" : "Downloaded"

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { value: [number, number, number] }
        const [hour, day, gib] = p.value
        const dayLabel = DAY_LABELS[day] ?? ""
        const hourLabel = HOUR_LABELS[hour] ?? ""
        if (gib === 0) {
          return (
            `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(dayLabel)} at ${escHtml(hourLabel)}</span><br/>` +
            `<span style="color:${CHART_THEME.textTertiary};">No data</span>`
          )
        }
        const display = formatGiB(gib)
        return (
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(dayLabel)} at ${escHtml(hourLabel)}</span><br/>` +
          chartTooltipRow(color, label, display)
        )
      },
    }),
    grid: {
      left: 48,
      right: 24,
      top: 16,
      bottom: 40,
    },
    xAxis: {
      type: "category",
      data: HOUR_LABELS,
      splitArea: { show: false },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        interval: 1,
        formatter: (_val: string, index: number) => (index % 2 === 0 ? _val : ""),
      }),
    },
    yAxis: {
      type: "category",
      data: DAY_LABELS,
      splitArea: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
    },
    visualMap: {
      min: 0,
      max: Math.max(maxValue, 1),
      show: false,
      inRange: {
        color: [CHART_THEME.gridLine, hexToRgba(color, 0.25), hexToRgba(color, 0.6), color],
      },
    },
    series: [
      {
        type: "heatmap",
        data,
        itemStyle: {
          borderRadius: 3,
          borderWidth: 2,
          borderColor: CHART_THEME.surface,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: hexToRgba(color, 0.4),
          },
        },
      },
    ],
  }
}

function FleetVolumeHeatmap({ trackerData, height = 260 }: FleetVolumeHeatmapProps) {
  const [field, setField] = useState<VolumeField>("upload")

  const totalSnapshots = trackerData.reduce((sum, t) => sum + t.snapshots.length, 0)
  if (totalSnapshots < 2) {
    return <ChartEmptyState height={height} message="Not enough snapshot data" />
  }

  const { data, maxValue } = buildVolumeMatrix(trackerData, field)

  return (
    <div>
      <div className="flex justify-end pb-2">
        <TabBar
          compact
          tabs={[
            { key: "upload" as const, label: "Upload" },
            { key: "download" as const, label: "Download" },
          ]}
          activeTab={field}
          onChange={setField}
        />
      </div>
      <ChartECharts
        option={buildFleetVolumeHeatmapOption(data, maxValue, field)}
        style={{ height, width: "100%" }}
      />
    </div>
  )
}

export type { FleetVolumeHeatmapProps }
export { FleetVolumeHeatmap }
