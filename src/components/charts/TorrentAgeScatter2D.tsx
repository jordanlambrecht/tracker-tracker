// src/components/charts/TorrentAgeScatter2D.tsx
//
// 2D substitute for TorrentAgeScatter3D, rendered when the dashboard's
// "Enable 3D charts" setting is off. Keeps both view presets and all four
// data dimensions: the 3D depth axis (size) becomes symbol size, and the
// fourth dimension keeps its visualMap color scale.
//
// The presets are duplicated from TorrentAgeScatter3D rather than imported:
// that module has a top-level `import "echarts-gl"` side effect, and this
// component is statically imported, so importing from it would pull WebGL
// into the main bundle. Exactly what this chart exists to avoid.
//
// Functions: computeDotSize, buildScatter2DOption, TorrentAgeScatter2D

"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { FilterPill } from "@/components/ui/FilterPill"
import type { TorrentRaw } from "@/lib/fleet"
import { formatRatio } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartGrid, chartTooltip } from "./lib/theme"

type Scatter2DView = "age-seed" | "seed-ratio"

interface Scatter2DViewConfig {
  label: string
  description: string
  x: { idx: number; name: string }
  y: { idx: number; name: string }
  /** Dimension mapped to symbol size: the 3D chart's depth axis. */
  size: { idx: number; name: string }
  color: { idx: number; name: string; max: number }
}

const SCATTER2D_VIEWS: Record<Scatter2DView, Scatter2DViewConfig> = {
  "age-seed": {
    label: "Age vs Seed Time",
    description:
      "Age = time since added · Seed Time = cumulative active seeding · Gap reveals downtime · Color = ratio · Dot size = size",
    x: { idx: 0, name: "Age (days)" },
    y: { idx: 1, name: "Seed Time (days)" },
    size: { idx: 2, name: "Size (GiB)" },
    color: { idx: 3, name: "Ratio", max: 5 },
  },
  "seed-ratio": {
    label: "Seed Time vs Ratio",
    description:
      "Are you getting ratio returns for your seeding investment? · Color = age · Dot size = size",
    x: { idx: 1, name: "Seed Time (days)" },
    y: { idx: 3, name: "Ratio" },
    size: { idx: 2, name: "Size (GiB)" },
    color: { idx: 0, name: "Age (days)", max: 365 },
  },
}

const MIN_DOT = 4
const MAX_DOT = 14

interface TorrentAgeScatter2DProps {
  torrents: TorrentRaw[]
  accentColor: string
}

/**
 * Scales a torrent size to a symbol radius in [MIN_DOT, MAX_DOT].
 * Always returns at least MIN_DOT so the smallest torrents stay visible.
 */
function computeDotSize(sizeGiB: number, maxSizeGiB: number): number {
  if (maxSizeGiB <= 0) return MIN_DOT
  return MIN_DOT + (Math.max(0, sizeGiB) / maxSizeGiB) * (MAX_DOT - MIN_DOT)
}

function buildScatter2DOption(
  data: number[][],
  cfg: Scatter2DViewConfig,
  accentColor: string
): EChartsOption {
  const maxSize = Math.max(...data.map((d) => d[cfg.size.idx]), 0)

  const axisNameTextStyle = {
    color: CHART_THEME.textTertiary,
    fontFamily: CHART_THEME.fontMono,
    fontSize: CHART_THEME.fontSizeCompact,
  }

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ left: 64, right: 24, top: 16, bottom: 76 }),
    tooltip: chartTooltip("item", {
      // With a dataset source of plain arrays, params.value is the whole row,
      // so every dimension stays reachable regardless of the active preset.
      formatter: (params: unknown) => {
        const p = params as { value: number[] }
        const d = p.value
        return `Age: ${d[0]}d<br/>Seed: ${d[1]}d<br/>Size: ${d[2]} GiB<br/>Ratio: ${formatRatio(d[3])}`
      },
    }),
    visualMap: {
      show: true,
      min: 0,
      max: cfg.color.max,
      dimension: cfg.color.idx,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemWidth: 10,
      itemHeight: 100,
      inRange: {
        color: [
          CHART_THEME.scale[0],
          CHART_THEME.scale[1],
          CHART_THEME.scale[2],
          accentColor,
          CHART_THEME.scale[4],
        ],
      },
      text: [`${cfg.color.name} ${cfg.color.max}+`, "0"],
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
    },
    xAxis: {
      type: "value",
      name: cfg.x.name,
      nameLocation: "center",
      nameGap: 32,
      nameTextStyle: axisNameTextStyle,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
      splitLine: { lineStyle: { color: CHART_THEME.gridLine, width: 1 } },
    },
    yAxis: {
      type: "value",
      name: cfg.y.name,
      nameTextStyle: axisNameTextStyle,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
      splitLine: { lineStyle: { color: CHART_THEME.gridLine, width: 1 } },
    },
    dataset: { source: data },
    series: [
      {
        type: "scatter",
        // Encode picks the two active dimensions off the shared 4-tuple, so
        // switching presets never rebuilds or drops data.
        encode: { x: cfg.x.idx, y: cfg.y.idx },
        symbolSize: (value: number[]) => computeDotSize(value[cfg.size.idx], maxSize),
        itemStyle: { opacity: 0.8 },
      },
    ],
  }
}

function TorrentAgeScatter2D({ torrents, accentColor }: TorrentAgeScatter2DProps) {
  const [view, setView] = useState<Scatter2DView>("age-seed")
  const cfg = SCATTER2D_VIEWS[view]

  const now = Date.now() / 1000
  const data = torrents
    .filter((t) => t.addedAt > 0)
    .map((t) => [
      Math.floor((now - t.addedAt) / 86400), // 0: age
      Math.floor(t.seedingTime / 86400), // 1: seed time
      +(t.size / 1024 ** 3).toFixed(2), // 2: size
      Math.min(t.ratio, 10), // 3: ratio
    ])

  if (data.length === 0) {
    return <ChartEmptyState height={400} message="No torrent data available" />
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {(Object.keys(SCATTER2D_VIEWS) as Scatter2DView[]).map((key) => (
          <FilterPill
            key={key}
            size="sm"
            active={view === key}
            onClick={() => setView(key)}
            inactive="inset"
            text={SCATTER2D_VIEWS[key].label}
            className="px-3 py-1.5 rounded-nm-pill"
          />
        ))}
      </div>
      <p className="text-xs font-mono text-tertiary">{cfg.description}</p>
      <ChartECharts
        option={buildScatter2DOption(data, cfg, accentColor)}
        style={{ height: 400, width: "100%" }}
      />
    </div>
  )
}

export type { TorrentAgeScatter2DProps }
export { TorrentAgeScatter2D }
