// src/components/charts/ParallelTorrentsChart.tsx
"use client"

import type { EChartsOption } from "echarts"
import { hexToRgba } from "@/lib/color-utils"
import type { TorrentRaw } from "@/lib/fleet"
import { formatCount } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { fmtNum } from "./lib/chart-helpers"
import { CHART_THEME, chartAxisLabel, chartTooltip, chartTooltipRow } from "./lib/theme"

interface ParallelTorrentsChartProps {
  torrents: TorrentRaw[]
  trackerColor: string
  height?: number
}

// ---------------------------------------------------------------------------
// Dimension indices (parallel axis order)
// ---------------------------------------------------------------------------

const DIM_SIZE = 0
const DIM_RATIO = 1
const DIM_SEED_TIME = 2
const DIM_SEEDS = 3
const DIM_AGE = 4
const DIM_AVAILABILITY = 5

// ---------------------------------------------------------------------------
// Option builder
// ---------------------------------------------------------------------------

function buildParallelOption(torrents: TorrentRaw[], trackerColor: string): EChartsOption {
  const nowSec = Date.now() / 1000

  // Pre-compute derived values
  const rows = torrents.map((t) => {
    const sizeGiB = t.size / 1024 ** 3
    const seedDays = t.seedingTime / 86400
    const ageDays = (nowSec - t.addedAt) / 86400
    return [sizeGiB, t.ratio, seedDays, t.seedCount, ageDays, Math.max(0, t.availability ?? 0)]
  })

  // Compute per-dimension min/max from data for reasonable axis ranges
  const colCount = 6
  const mins: number[] = Array(colCount).fill(Number.POSITIVE_INFINITY)
  const maxs: number[] = Array(colCount).fill(Number.NEGATIVE_INFINITY)

  for (const row of rows) {
    for (let d = 0; d < colCount; d++) {
      const v = row[d]
      if (v < mins[d]) mins[d] = v
      if (v > maxs[d]) maxs[d] = v
    }
  }

  // Floor mins to 0 for non-negative dimensions and ensures non-zero range
  const safeMins = mins.map((m) => Math.max(0, Number.isFinite(m) ? m : 0))
  const safeMaxs = maxs.map((m, i) => {
    const base = Number.isFinite(m) ? m : 1
    // Add a small buffer above max so top items don't sit on the axis edge
    const buffer = base === safeMins[i] ? 1 : (base - safeMins[i]) * 0.1
    return base + buffer
  })

  const parallelAxes = [
    {
      dim: DIM_SIZE,
      name: "Size (GiB)",
      min: safeMins[DIM_SIZE],
      max: safeMaxs[DIM_SIZE],
      axisLabel: {
        formatter: (v: number) => fmtNum(v, 1),
      },
    },
    {
      dim: DIM_RATIO,
      name: "Ratio",
      min: safeMins[DIM_RATIO],
      max: safeMaxs[DIM_RATIO],
      axisLabel: {
        formatter: (v: number) => fmtNum(v, 2),
      },
    },
    {
      dim: DIM_SEED_TIME,
      name: "Seed Days",
      min: safeMins[DIM_SEED_TIME],
      max: safeMaxs[DIM_SEED_TIME],
      axisLabel: {
        formatter: (v: number) => fmtNum(v, 1),
      },
    },
    {
      dim: DIM_SEEDS,
      name: "Seeds",
      min: safeMins[DIM_SEEDS],
      max: safeMaxs[DIM_SEEDS],
      axisLabel: {
        formatter: (v: number) => formatCount(Math.round(v)),
      },
    },
    {
      dim: DIM_AGE,
      name: "Age (days)",
      min: safeMins[DIM_AGE],
      max: safeMaxs[DIM_AGE],
      axisLabel: {
        formatter: (v: number) => fmtNum(v, 0),
      },
    },
    {
      dim: DIM_AVAILABILITY,
      name: "Availability",
      min: 0,
      max: Math.max(1, safeMaxs[DIM_AVAILABILITY]),
      axisLabel: {
        formatter: (v: number) => fmtNum(v, 2),
      },
    },
  ]

  // Apply shared axis label styling
  const styledAxes = parallelAxes.map((axis) => ({
    ...axis,
    nameTextStyle: {
      color: CHART_THEME.textSecondary,
      fontFamily: CHART_THEME.fontMono,
      fontSize: CHART_THEME.fontSizeDense,
      fontWeight: 500,
    },
    axisLabel: chartAxisLabel(axis.axisLabel),
    axisLine: {
      lineStyle: {
        color: CHART_THEME.tooltipBorder,
        width: 1,
      },
    },
    axisTick: {
      lineStyle: {
        color: CHART_THEME.borderEmphasis,
      },
    },
    splitLine: {
      lineStyle: {
        color: CHART_THEME.gridLine,
        width: 1,
      },
    },
  }))

  const lineColor = hexToRgba(trackerColor, 0.15)
  const lineEmphasisColor = hexToRgba(trackerColor, 0.75)

  return {
    animation: false,
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      borderColor: trackerColor,
      formatter: (params: unknown) => {
        const p = params as { data: number[] }
        const d = p.data
        if (!d) return ""
        return [
          `<span style="color:${CHART_THEME.textTertiary};font-size:${CHART_THEME.fontSizeDense}px;font-family:${CHART_THEME.fontMono};">Torrent</span>`,
          chartTooltipRow(trackerColor, "Size", `${fmtNum(d[DIM_SIZE], 2)} GiB`),
          chartTooltipRow(trackerColor, "Ratio", fmtNum(d[DIM_RATIO], 2)),
          chartTooltipRow(trackerColor, "Seed Time", `${fmtNum(d[DIM_SEED_TIME], 1)} days`),
          chartTooltipRow(trackerColor, "Seeds", formatCount(Math.round(d[DIM_SEEDS]))),
          chartTooltipRow(trackerColor, "Age", `${fmtNum(d[DIM_AGE], 0)} days`),
          chartTooltipRow(trackerColor, "Availability", fmtNum(d[DIM_AVAILABILITY], 2)),
        ].join("<br/>")
      },
    }),
    parallel: {
      top: 48,
      right: 32,
      bottom: 32,
      left: 32,
      parallelAxisDefault: {
        type: "value",
        nameLocation: "end",
      },
    },
    parallelAxis: styledAxes,
    series: [
      {
        type: "parallel",
        smooth: true,
        progressive: 500,
        lineStyle: {
          color: lineColor,
          width: 1,
          opacity: 1,
        },
        emphasis: {
          lineStyle: {
            color: lineEmphasisColor,
            width: 2,
            opacity: 1,
            shadowColor: trackerColor,
            shadowBlur: 8,
          },
        },
        data: rows,
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ParallelTorrentsChart({
  torrents,
  trackerColor,
  height = 420,
}: ParallelTorrentsChartProps) {
  const filtered = torrents.filter((t) => t.addedAt !== 0 && t.size !== 0)

  if (filtered.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available for parallel view" />
  }

  return (
    <ChartECharts
      option={buildParallelOption(filtered, trackerColor)}
      style={{ height, width: "100%" }}
    />
  )
}

export type { ParallelTorrentsChartProps }
export { ParallelTorrentsChart }
