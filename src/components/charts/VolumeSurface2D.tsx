// src/components/charts/VolumeSurface2D.tsx
//
// 2D substitute for VolumeSurface3D, rendered when the dashboard's
// "Enable 3D charts" setting is off. Same props and same data source —
// tracker on the Y axis, date bucket on the X axis, upload volume as
// color intensity instead of bar height.
//
// The bucketing helpers come from ./lib/chart-transforms, not from
// VolumeSurface3D: that module has a top-level `import "echarts-gl"` side
// effect, and this component is statically imported, so importing from it
// would pull WebGL into the main bundle — exactly what this chart exists to
// avoid. chart-transforms must stay free of echarts-gl for the same reason.

"use client"

import type { EChartsOption } from "echarts"
import { hexToRgba } from "@/lib/color-utils"
import type { FleetChartProps } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { autoByteScale, fmtNum } from "./lib/chart-helpers"
import {
  bucketGrid,
  computeDailyGrid,
  formatBucketLabel,
  type GridResult,
} from "./lib/chart-transforms"
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

interface VolumeSurface2DProps extends FleetChartProps {}

// ---------------------------------------------------------------------------
// ECharts option builder
// ---------------------------------------------------------------------------

function buildVolumeSurface2DOption(grid: GridResult): EChartsOption {
  if (grid.bucketLabels.length === 0 || grid.trackerNames.length === 0) return {}

  const displayLabels = grid.bucketLabels.map((k) => formatBucketLabel(k, grid.granularity))
  const bucketCount = grid.bucketLabels.length

  // Determine unit
  let maxVal = 0
  for (const row of grid.uploadGrid) {
    for (const v of row) maxVal = Math.max(maxVal, v)
  }
  const { divisor, unit } = autoByteScale(maxVal)

  // Build heatmap data: [bucketIndex, trackerIndex, value]. Every cell is
  // emitted (including zeros) so the grid stays complete.
  const heatmapData: [number, number, number][] = []
  for (let ti = 0; ti < grid.trackerNames.length; ti++) {
    for (let bi = 0; bi < bucketCount; bi++) {
      heatmapData.push([bi, ti, Number((grid.uploadGrid[ti][bi] / divisor).toFixed(3))])
    }
  }

  const periodLabel =
    grid.granularity === "month" ? "Month" : grid.granularity === "week" ? "Week" : "Day"

  const color = CHART_THEME.upload

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { data: [number, number, number] }
        const [bi, ti, val] = p.data
        const bucketLabel = displayLabels[bi] ?? "?"
        const tracker = grid.trackerNames[ti] ?? "?"
        const header =
          `<div style="font-family:var(--font-mono),monospace;font-size:${CHART_THEME.fontSizeDense}px;` +
          `color:${CHART_THEME.textTertiary};margin-bottom:4px;">${escHtml(tracker)} · ${escHtml(bucketLabel)}</div>`
        if (val <= 0) {
          return `${header}<span style="color:${CHART_THEME.textTertiary};">No upload recorded</span>`
        }
        return (
          header +
          chartTooltipRow(
            grid.trackerColors[ti] ?? color,
            "Uploaded",
            `${fmtNum(Math.abs(val))} ${unit}`
          )
        )
      },
    }),
    grid: chartGrid({ left: 12, right: 12, top: 12, bottom: 40, containLabel: true }),
    xAxis: {
      type: "category",
      data: displayLabels,
      name: periodLabel,
      nameLocation: "center",
      nameGap: 28,
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        interval: Math.max(0, Math.floor(displayLabels.length / 8) - 1),
      }),
    },
    yAxis: {
      type: "category",
      data: grid.trackerNames,
      splitArea: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
    },
    visualMap: {
      show: false,
      min: 0,
      max: Math.max(maxVal / divisor, 1),
      inRange: {
        color: [CHART_THEME.gridLine, hexToRgba(color, 0.25), hexToRgba(color, 0.6), color],
      },
    },
    series: [
      {
        type: "heatmap",
        data: heatmapData,
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function VolumeSurface2D({ trackerData, height = 480 }: VolumeSurface2DProps) {
  const hasData = trackerData.some((t) => t.snapshots.length > 1)

  if (!hasData) {
    return (
      <ChartEmptyState height={height} message="Need at least 2 days of data across trackers." />
    )
  }

  const daily = computeDailyGrid(trackerData)
  const grid = bucketGrid(daily)
  const option = buildVolumeSurface2DOption(grid)

  if (!option.series) {
    return <ChartEmptyState height={height} message="No daily volume data to display." />
  }

  // Rows must stay legible as tracker count grows — same sizing rule as
  // FleetAgeBandHeatmap.
  const dynamicHeight = Math.max(height, 60 + grid.trackerNames.length * 36)

  return <ChartECharts option={option} style={{ height: dynamicHeight, width: "100%" }} />
}

export type { VolumeSurface2DProps }
export { VolumeSurface2D }
