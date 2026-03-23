// src/components/charts/TrackerBubbleChart.tsx
//
// Functions: computeBubbleSize, buildBubbleOption, TrackerBubbleChart

"use client"

import type { EChartsOption } from "echarts"
import { bytesToGiB } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { autoByteScale, fmtNum } from "./lib/chart-helpers"
import { LogScaleToggle } from "./lib/LogScaleToggle"
import {
  CHART_THEME,
  chartAxisLabel,
  chartDot,
  chartGrid,
  chartLegend,
  chartTooltip,
  escHtml,
  shouldUseLogScale,
} from "./lib/theme"
import { useLogScale } from "./lib/useLogScale"

interface TrackerBubbleData {
  name: string
  color: string
  uploadedBytes: string | null
  downloadedBytes: string | null
  seedingCount: number | null
}

interface TrackerBubbleChartProps {
  trackers: TrackerBubbleData[]
  height?: number
}

// Internal type for trackers that have both byte values present
interface ValidTrackerData {
  name: string
  color: string
  uploadedBytes: string
  downloadedBytes: string
  seedingCount: number | null
}

const MIN_BUBBLE = 15
const MAX_BUBBLE = 60

/**
 * Scales a seeding count to a visual bubble radius in [MIN_BUBBLE, MAX_BUBBLE].
 * Always returns at least MIN_BUBBLE so zero-seeding bubbles remain visible.
 */
function computeBubbleSize(seedingCount: number, maxSeedingCount: number): number {
  if (maxSeedingCount <= 0) return MIN_BUBBLE
  return MIN_BUBBLE + (seedingCount / maxSeedingCount) * (MAX_BUBBLE - MIN_BUBBLE)
}

/**
 * Builds the ECharts option for the bubble chart.
 */
function buildBubbleOption(trackers: ValidTrackerData[], forceLog: boolean | null): EChartsOption {
  // Convert bytes to GiB for all trackers
  const allGiB = trackers.map((t) => ({
    tracker: t,
    uploadGiB: bytesToGiB(t.uploadedBytes),
    downloadGiB: bytesToGiB(t.downloadedBytes),
  }))

  // Determine scale: GiB or TiB
  const maxGiB = Math.max(...allGiB.map((d) => Math.max(d.uploadGiB, d.downloadGiB)), 0)
  const { divisor, unit } = autoByteScale(maxGiB)

  // Scale all values to the chosen unit
  const scaled = allGiB.map((d) => ({
    tracker: d.tracker,
    x: d.downloadGiB / divisor,
    y: d.uploadGiB / divisor,
  }))

  // Log scale: manual override (forceLog) takes precedence, otherwise auto-detect
  const xValues = scaled.map((d) => d.x)
  const yValues = scaled.map((d) => d.y)
  const useLogX = forceLog ?? shouldUseLogScale(xValues)
  const useLogY = forceLog ?? shouldUseLogScale(yValues)

  // Compute explicit min/max for log axes from positive values
  const logBounds = (values: number[]) => {
    const pos = values.filter((v) => v > 0)
    if (pos.length === 0) return {}
    return { min: Math.min(...pos) * 0.5, max: Math.max(...pos) * 2 }
  }
  const xLogBounds = useLogX ? logBounds(xValues) : {}
  const yLogBounds = useLogY ? logBounds(yValues) : {}

  // Compute max seeding count for bubble size scaling
  const maxSeedingCount = Math.max(...trackers.map((t) => t.seedingCount ?? 0), 0)

  // Diagonal reference line endpoint — max of all axis values
  const maxAxisVal = Math.max(...scaled.map((d) => Math.max(d.x, d.y)), 1)

  // One series per tracker — required for legend + per-tracker color control
  const series: EChartsOption["series"] = scaled.map((d, i) => {
    const seedingCount = d.tracker.seedingCount ?? 0
    const bubbleSize = computeBubbleSize(seedingCount, maxSeedingCount)
    const color = d.tracker.color

    // Only the first series carries the markLine to avoid rendering it N times
    const markLine =
      i === 0
        ? {
            silent: true,
            symbol: ["none", "none"] as [string, string],
            lineStyle: {
              color: CHART_THEME.borderEmphasis,
              type: "dashed" as const,
              width: 1,
            },
            label: {
              formatter: "1:1 ratio",
              color: CHART_THEME.textTertiary,
              fontFamily: CHART_THEME.fontMono,
              fontSize: 10,
            },
            data: [
              [
                { coord: [0, 0] as [number, number] },
                { coord: [maxAxisVal, maxAxisVal] as [number, number] },
              ] as [{ coord: [number, number] }, { coord: [number, number] }],
            ],
          }
        : undefined

    return {
      name: d.tracker.name,
      type: "scatter" as const,
      data: [[d.x, d.y]],
      symbolSize: bubbleSize,
      itemStyle: {
        color,
        shadowColor: color,
        shadowBlur: 12,
      },
      emphasis: {
        itemStyle: {
          color,
          shadowColor: color,
          shadowBlur: 20,
        },
      },
      ...(markLine ? { markLine } : {}),
    }
  })

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 24, bottom: 48, left: 72 }),
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as {
          seriesName: string
          color: string
          data: number[]
        }
        const downloadVal = p.data[0]
        const uploadVal = p.data[1]
        const color = p.color as string

        // Find matching tracker to retrieve seeding count
        const match = scaled.find((d) => d.tracker.name === p.seriesName)
        const seedingCount = match?.tracker.seedingCount ?? 0

        const ratio = downloadVal > 0 ? (uploadVal / downloadVal).toFixed(2) : "∞"

        return [
          `<div style="font-family:${CHART_THEME.fontMono};font-size:12px;">`,
          `${chartDot(color.startsWith("#") ? color : CHART_THEME.neutral)}<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(p.seriesName)}</span>`,
          `<br/><span style="color:${CHART_THEME.textSecondary};">Uploaded:</span> <span style="color:${CHART_THEME.textPrimary};">${fmtNum(uploadVal)} ${unit}</span>`,
          `<br/><span style="color:${CHART_THEME.textSecondary};">Downloaded:</span> <span style="color:${CHART_THEME.textPrimary};">${fmtNum(downloadVal)} ${unit}</span>`,
          `<br/><span style="color:${CHART_THEME.textSecondary};">Seeding:</span> <span style="color:${CHART_THEME.textPrimary};">${seedingCount.toLocaleString()} torrents</span>`,
          `<br/><span style="color:${CHART_THEME.textSecondary};">Ratio:</span> <span style="color:${CHART_THEME.textPrimary};">${ratio}×</span>`,
          "</div>",
        ].join("")
      },
    }),
    legend: chartLegend(),
    xAxis: {
      type: useLogX ? "log" : "value",
      name: useLogX ? `Downloaded (${unit}, log)` : `Downloaded (${unit})`,
      ...(useLogX ? xLogBounds : { min: 0 }),
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => fmtNum(val, 1),
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    yAxis: {
      type: useLogY ? "log" : "value",
      name: useLogY ? `Uploaded (${unit}, log)` : `Uploaded (${unit})`,
      ...(useLogY ? yLogBounds : { min: 0 }),
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => fmtNum(val, 1),
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    series,
  }
}

function TrackerBubbleChart({ trackers, height = 360 }: TrackerBubbleChartProps) {
  // Narrow to trackers that have both byte values present
  const validTrackers: ValidTrackerData[] = trackers.flatMap((t) =>
    t.uploadedBytes !== null && t.downloadedBytes !== null
      ? [
          {
            name: t.name,
            color: t.color,
            uploadedBytes: t.uploadedBytes,
            downloadedBytes: t.downloadedBytes,
            seedingCount: t.seedingCount,
          },
        ]
      : []
  )

  // Hook must be called before any early return (React rules of hooks)
  const xValues = validTrackers.map((t) => bytesToGiB(t.downloadedBytes))
  const yValues = validTrackers.map((t) => bytesToGiB(t.uploadedBytes))
  const allValues = [...xValues, ...yValues]
  const { effectiveLog, isAuto, onToggle } = useLogScale(allValues)

  if (validTrackers.length === 0) {
    return <ChartEmptyState height={height} message="No tracker data available" />
  }

  // Derive per-axis log override to pass into the option builder.
  // useLogScale auto-detects across all values; we pass null for auto, or the
  // effective boolean when the user has manually overridden.
  const logOverride = isAuto ? null : effectiveLog

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <LogScaleToggle effectiveLog={effectiveLog} isAuto={isAuto} onToggle={onToggle} />
      </div>
      <ChartECharts
        option={buildBubbleOption(validTrackers, logOverride)}
        style={{ height, width: "100%" }}
      />
    </div>
  )
}

export type { TrackerBubbleChartProps, TrackerBubbleData }
export { TrackerBubbleChart }
