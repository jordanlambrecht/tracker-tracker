// src/components/charts/FleetVolumeCalendar.tsx
"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { TabBar } from "@/components/ui/TabBar"
import { hexToRgba, localDateStr } from "@/lib/formatters"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { formatGiB } from "./lib/chart-helpers"
import { computeDailyDeltas } from "./lib/chart-transforms"
import { CHART_THEME, chartTooltip, chartTooltipRow, escHtml } from "./lib/theme"

type VolumeField = "upload" | "download"

interface FleetVolumeCalendarProps {
  trackerData: TrackerSnapshotSeries[]
  height?: number
}

/**
 * Aggregate daily upload/download deltas across all trackers.
 * Returns [dateString, gibValue][] sorted by date.
 */
function buildCalendarData(
  trackerData: TrackerSnapshotSeries[],
  field: VolumeField
): { entries: [string, number][]; maxValue: number; dateRange: [string, string] } {
  const dayMap = new Map<string, number>()

  for (const { snapshots } of trackerData) {
    const deltas = computeDailyDeltas(snapshots)
    for (const d of deltas) {
      const value = field === "upload" ? d.uploadDelta : d.downloadDelta
      if (value <= 0) continue
      dayMap.set(d.label, (dayMap.get(d.label) ?? 0) + value)
    }
  }

  const entries = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b))

  // Fixed 365-day window ending today
  const today = new Date()
  const yearAgo = new Date(today)
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  yearAgo.setDate(yearAgo.getDate() + 1)
  const dateRange: [string, string] = [localDateStr(yearAgo), localDateStr(today)]

  const maxValue = entries.length > 0 ? Math.max(...entries.map(([, v]) => v)) : 0

  return { entries, maxValue, dateRange }
}

function buildFleetVolumeCalendarOption(
  entries: [string, number][],
  maxValue: number,
  dateRange: [string, string],
  field: VolumeField
): EChartsOption {
  const color = field === "upload" ? CHART_THEME.upload : CHART_THEME.download
  const label = field === "upload" ? "Uploaded" : "Downloaded"

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { value: [string, number] }
        const [date, gib] = p.value
        const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
        if (!gib || gib === 0) {
          return (
            `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(dateLabel)}</span><br/>` +
            `<span style="color:${CHART_THEME.textTertiary};">No data</span>`
          )
        }
        const display = formatGiB(gib)
        return (
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(dateLabel)}</span><br/>` +
          chartTooltipRow(color, label, display)
        )
      },
    }),
    visualMap: {
      min: 0,
      max: Math.max(maxValue, 1),
      show: false,
      inRange: {
        color: [CHART_THEME.gridLine, hexToRgba(color, 0.25), hexToRgba(color, 0.6), color],
      },
    },
    calendar: {
      top: 32,
      left: 40,
      right: 24,
      bottom: 8,
      cellSize: 14,
      range: dateRange,
      itemStyle: {
        borderWidth: 3,
        borderColor: CHART_THEME.surface,
        color: CHART_THEME.gridLine,
      },
      yearLabel: { show: false },
      monthLabel: {
        color: CHART_THEME.textTertiary,
        fontSize: CHART_THEME.fontSizeCompact,
        fontFamily: CHART_THEME.fontMono,
      },
      dayLabel: {
        firstDay: 1,
        color: CHART_THEME.textTertiary,
        fontSize: CHART_THEME.fontSizeCompact,
        fontFamily: CHART_THEME.fontMono,
        nameMap: ["S", "M", "T", "W", "T", "F", "S"],
      },
      splitLine: { show: false },
    },
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        data: entries,
        itemStyle: {
          borderRadius: 2,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: hexToRgba(color, 0.4),
          },
        },
      },
    ],
  }
}

function FleetVolumeCalendar({ trackerData, height = 200 }: FleetVolumeCalendarProps) {
  const [field, setField] = useState<VolumeField>("upload")

  const totalSnapshots = trackerData.reduce((sum, t) => sum + t.snapshots.length, 0)
  if (totalSnapshots < 2) {
    return <ChartEmptyState height={height} message="Not enough snapshot data" />
  }

  const { entries, maxValue, dateRange } = buildCalendarData(trackerData, field)
  if (entries.length === 0) {
    return <ChartEmptyState height={height} message="No volume data available" />
  }

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
        option={buildFleetVolumeCalendarOption(entries, maxValue, dateRange, field)}
        style={{ height, width: "100%" }}
      />
    </div>
  )
}

export type { FleetVolumeCalendarProps }
export { FleetVolumeCalendar }
