// src/components/charts/VolumeSurface3D.tsx
"use client"

import ReactECharts from "echarts-for-react"
import "echarts-gl"
import type { FleetChartProps } from "@/types/charts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { autoByteScale, fmtNum } from "./lib/chart-helpers"
import {
  bucketGrid,
  computeDailyGrid,
  formatBucketLabel,
  type GridResult,
} from "./lib/chart-transforms"
import { CHART_THEME, chartAxisLabel, chartTooltip, escHtml } from "./lib/theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VolumeSurface3DProps extends FleetChartProps {}

// ---------------------------------------------------------------------------
// ECharts option builder
// ---------------------------------------------------------------------------

function buildSurfaceOption(grid: GridResult): Record<string, unknown> {
  if (grid.bucketLabels.length === 0 || grid.trackerNames.length === 0) return {}

  const displayLabels = grid.bucketLabels.map((k) => formatBucketLabel(k, grid.granularity))
  const bucketCount = grid.bucketLabels.length

  // Determine unit
  let maxVal = 0
  for (const row of grid.uploadGrid) {
    for (const v of row) maxVal = Math.max(maxVal, v)
  }
  const { divisor, unit } = autoByteScale(maxVal)

  // Build bar3D data: [bucketIndex, trackerIndex, value]
  const barData: [number, number, number][] = []
  for (let ti = 0; ti < grid.trackerNames.length; ti++) {
    for (let bi = 0; bi < bucketCount; bi++) {
      const val = grid.uploadGrid[ti][bi] / divisor
      if (val > 0) {
        barData.push([bi, ti, Number(val.toFixed(3))])
      }
    }
  }

  // Adaptive bar size. fewer buckets = fatter bars
  const barSize = bucketCount > 40 ? 4 : bucketCount > 20 ? 6 : bucketCount > 10 ? 8 : 10

  // Adaptive box width
  const boxWidth = Math.min(300, Math.max(150, bucketCount * 6))

  const periodLabel =
    grid.granularity === "month" ? "Month" : grid.granularity === "week" ? "Week" : "Day"

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      show: true,
      formatter: (params: { value: number[] }) => {
        const [bi, ti, val] = params.value
        const bucketLabel = displayLabels[bi] ?? "?"
        const tracker = grid.trackerNames[ti] ?? "?"
        const formatted = fmtNum(Math.abs(val))
        return (
          `<div style="font-family:var(--font-mono),monospace">` +
          `<div style="color:${CHART_THEME.textTertiary};font-size:${CHART_THEME.fontSizeDense}px;margin-bottom:2px">${escHtml(bucketLabel)}</div>` +
          `<div><span style="color:${CHART_THEME.textSecondary}">${escHtml(tracker)}:</span> <b>${formatted} ${unit}</b></div>` +
          `</div>`
        )
      },
    }),
    // NOTE: echarts-gl does register type:"time" for xAxis3D (see createAxis3DModel.js),
    // but it is a degraded stub: it inherits valueAxis numeric behavior and does NOT
    // support ECharts' cascading date formatter or hideOverlap. More importantly,
    // bar3D data points map dimensions as either 'ordinal' (category) or 'float' (everything
    // else), so a time axis would require every data point to carry a Unix timestamp instead
    // of a bucket index, breaking the [bucketIdx, trackerIdx, value] tuple structure.
    // Pre-formatting labels via formatBucketLabel() and using type:"category" is the correct
    // approach here. The hour axis on heatmap variants should also stay as category.
    xAxis3D: {
      type: "category",
      data: displayLabels,
      name: periodLabel,
      nameTextStyle: {
        color: CHART_THEME.textSecondary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeDense,
      },
      axisLabel: chartAxisLabel({
        fontSize: CHART_THEME.fontSizeMicro,
        interval: Math.max(0, Math.floor(displayLabels.length / 8) - 1),
      }),
      axisLine: { lineStyle: { color: CHART_THEME.borderEmphasis } },
    },
    yAxis3D: {
      type: "category",
      data: grid.trackerNames,
      name: "Tracker",
      nameTextStyle: {
        color: CHART_THEME.textSecondary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeDense,
      },
      axisLabel: chartAxisLabel(),
      axisLine: { lineStyle: { color: CHART_THEME.borderEmphasis } },
    },
    zAxis3D: {
      type: "value",
      name: `Upload (${unit})`,
      nameTextStyle: {
        color: CHART_THEME.textSecondary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeDense,
      },
      axisLabel: chartAxisLabel({ fontSize: CHART_THEME.fontSizeMicro }),
      axisLine: { lineStyle: { color: CHART_THEME.borderEmphasis } },
    },
    grid3D: {
      boxWidth,
      boxDepth: 80,
      boxHeight: 80,
      viewControl: {
        projection: "perspective",
        autoRotate: true,
        autoRotateSpeed: 4,
        rotateSensitivity: 2,
        zoomSensitivity: 1.5,
        distance: 250,
        minDistance: 250,
        alpha: 25,
        beta: 40,
      },
      light: {
        main: {
          intensity: 1.2,
          shadow: true,
          alpha: 30,
          beta: 40,
        },
        ambient: { intensity: 0.3 },
      },
      environment: CHART_THEME.surface,
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxVal / divisor,
      inRange: {
        color:
          grid.trackerColors.length > 1
            ? grid.trackerColors
            : [CHART_THEME.accentGlow, CHART_THEME.accentGlow60, CHART_THEME.accent],
      },
      dimension: 2,
    },
    series: [
      {
        type: "bar3D",
        data: barData,
        shading: "lambert",
        barSize,
        bevelSize: 0.3,
        bevelSmoothness: 2,
        emphasis: {
          itemStyle: { color: CHART_THEME.warn, opacity: 1 },
          label: { show: false },
        },
        itemStyle: {
          opacity: 0.9,
        },
        label: { show: false },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function VolumeSurface3D({ trackerData, height = 480 }: VolumeSurface3DProps) {
  const hasData = trackerData.some((t) => t.snapshots.length > 1)

  if (!hasData) {
    return (
      <ChartEmptyState height={height} message="Need at least 2 days of data across trackers." />
    )
  }

  const daily = computeDailyGrid(trackerData)
  const grid = bucketGrid(daily)
  const option = buildSurfaceOption(grid)

  if (!option.series) {
    return <ChartEmptyState height={height} message="No daily volume data to display." />
  }

  return (
    <div className="rounded-nm-md overflow-hidden" style={{ backgroundColor: CHART_THEME.surface }}>
      <ReactECharts
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
      />
    </div>
  )
}

export type { VolumeSurface3DProps }
export { VolumeSurface3D }
