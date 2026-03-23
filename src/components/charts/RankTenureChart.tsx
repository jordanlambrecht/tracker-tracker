// src/components/charts/RankTenureChart.tsx
//
// Functions: computeRankPeriods, buildRankColorMap, buildRankTenureOption, RankTenureChart

"use client"

import type {
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  EChartsOption,
} from "echarts"
import { generatePalette } from "@/lib/formatters"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import {
  CHART_THEME,
  chartAxisLabel,
  chartGrid,
  chartTooltip,
  chartTooltipRow,
  escHtml,
} from "./lib/theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RankTenureChartProps {
  trackerData: TrackerSnapshotSeries[]
  height?: number
}

interface RankPeriod {
  tracker: string
  rank: string
  start: Date
  end: Date
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

function computeRankPeriods(trackerData: TrackerSnapshotSeries[]): RankPeriod[] {
  const periods: RankPeriod[] = []

  for (const tracker of trackerData) {
    // Sort ascending by polledAt
    const sorted = [...tracker.snapshots].sort(
      (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
    )

    // Filter out null-group snapshots entirely before walking
    const withGroup = sorted.filter((s) => s.group !== null)
    if (withGroup.length === 0) continue

    let periodStart = new Date(withGroup[0].polledAt)
    let currentRank = withGroup[0].group as string

    for (let i = 1; i < withGroup.length; i++) {
      const snap = withGroup[i]
      const snapRank = snap.group as string

      if (snapRank !== currentRank) {
        // Rank changed — close the current period at the previous snapshot's time
        const prevSnap = withGroup[i - 1]
        periods.push({
          tracker: tracker.name,
          rank: currentRank,
          start: periodStart,
          end: new Date(prevSnap.polledAt),
        })
        periodStart = new Date(snap.polledAt)
        currentRank = snapRank
      }
    }

    // Close the final period at the last snapshot's polledAt
    const lastSnap = withGroup[withGroup.length - 1]
    periods.push({
      tracker: tracker.name,
      rank: currentRank,
      start: periodStart,
      end: new Date(lastSnap.polledAt),
    })
  }

  return periods
}

// ---------------------------------------------------------------------------
// Color map builder
// ---------------------------------------------------------------------------

function buildRankColorMap(
  trackerData: TrackerSnapshotSeries[],
  periods: RankPeriod[]
): Map<string, string> {
  const allRanks = Array.from(new Set(periods.map((p) => p.rank)))
  if (allRanks.length === 0) return new Map()

  const baseColor = trackerData[0]?.color ?? CHART_THEME.accent
  const colors = generatePalette(allRanks.length, baseColor)

  return new Map(allRanks.map((rank, i) => [rank, colors[i]]))
}

// ---------------------------------------------------------------------------
// Chart builder
// ---------------------------------------------------------------------------

function buildRankTenureOption(
  trackerData: TrackerSnapshotSeries[],
  periods: RankPeriod[]
): EChartsOption {
  const trackerNames = trackerData.map((t) => t.name)
  const colorMap = buildRankColorMap(trackerData, periods)

  // Format dates for display
  const fmtDate = (d: Date): string =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  // Build data items: [trackerIndex, startMs, endMs, rankName, trackerName]
  const data: [number, number, number, string, string][] = periods.map((p) => [
    trackerNames.indexOf(p.tracker),
    p.start.getTime(),
    p.end.getTime(),
    p.rank,
    p.tracker,
  ])

  // Bar height from category axis — use api.size in renderItem
  const BAR_HEIGHT_RATIO = 0.6 // fraction of category slot height

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { data: [number, number, number, string, string] }
        if (!p?.data) return ""
        const [, startMs, endMs, rankName, trackerName] = p.data
        const durationDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))
        const startDate = fmtDate(new Date(startMs))
        const endDate = fmtDate(new Date(endMs))
        const color = colorMap.get(rankName) ?? CHART_THEME.neutral

        const durationLabel = `${durationDays} day${durationDays !== 1 ? "s" : ""}`
        return [
          `<div style="font-family:${CHART_THEME.fontMono};font-size:11px;color:${CHART_THEME.textTertiary};margin-bottom:4px;">${escHtml(trackerName)}</div>`,
          `${chartTooltipRow(color, "Rank", rankName)}<br/>`,
          `${chartTooltipRow(CHART_THEME.neutral, "Duration", durationLabel)}<br/>`,
          `<span style="color:${CHART_THEME.textTertiary};font-size:11px;">${escHtml(startDate)} → ${escHtml(endDate)}</span>`,
        ].join("")
      },
    }),
    grid: chartGrid({ right: 24, left: 120 }),
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => {
          const d = new Date(val)
          return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        },
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    yAxis: {
      type: "category",
      data: trackerNames,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_THEME.textSecondary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
        width: 112,
        overflow: "truncate",
      },
      splitLine: { show: false },
    },
    series: [
      {
        type: "custom",
        renderItem: (
          params: CustomSeriesRenderItemParams,
          api: CustomSeriesRenderItemAPI
        ): CustomSeriesRenderItemReturn => {
          // suppress unused-param lint — params is required by ECharts signature
          void params

          const categoryIndex = Number(api.value(0))
          const startMs = Number(api.value(1))
          const endMs = Number(api.value(2))
          // rank name is stored at dimension 3 in the data tuple
          const rankName = String(api.value(3))

          const startCoord = api.coord([startMs, categoryIndex])
          const endCoord = api.coord([endMs, categoryIndex])

          const slotSize = api.size?.([0, 1]) ?? [0, 24]
          const slotHeight = Array.isArray(slotSize) ? Number(slotSize[1]) : 24
          const barHeight = slotHeight * BAR_HEIGHT_RATIO

          const x = startCoord[0]
          const y = startCoord[1] - barHeight / 2
          const width = endCoord[0] - startCoord[0]
          const height = barHeight

          const fillColor = colorMap.get(rankName) ?? CHART_THEME.neutral

          // Return type is cast via CustomSeriesRenderItemReturn; we use
          // unknown intermediate to satisfy the strict union without importing
          // the unexported CustomElementOption type.
          const rectEl = {
            type: "rect" as const,
            shape: { x, y, width: Math.max(width, 1), height, r: 2 },
            style: { fill: fillColor, opacity: 0.85 },
          }

          // Only show label if segment is wide enough (> 80px)
          const textEl =
            width > 80
              ? {
                  type: "text" as const,
                  x: x + 6,
                  y: startCoord[1],
                  style: {
                    text: rankName,
                    textAlign: "left" as const,
                    textVerticalAlign: "middle" as const,
                    fill: CHART_THEME.textPrimary,
                    fontSize: 10,
                    fontFamily: CHART_THEME.fontMono,
                    truncate: { outerWidth: width - 12, ellipsis: "…" },
                  },
                }
              : null

          const children = textEl ? [rectEl, textEl] : [rectEl]

          return {
            type: "group" as const,
            children,
          } as unknown as CustomSeriesRenderItemReturn
        },
        encode: {
          x: [1, 2],
          y: 0,
        },
        data,
        itemStyle: {
          borderRadius: 2,
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function RankTenureChart({ trackerData, height = 300 }: RankTenureChartProps) {
  const periods = computeRankPeriods(trackerData)
  const hasData = periods.length > 0

  if (!hasData) {
    return <ChartEmptyState height={height} message="No rank data available" />
  }

  return (
    <ChartECharts
      option={buildRankTenureOption(trackerData, periods)}
      style={{ height, width: "100%" }}
    />
  )
}

export type { RankTenureChartProps }
export { computeRankPeriods, RankTenureChart }
