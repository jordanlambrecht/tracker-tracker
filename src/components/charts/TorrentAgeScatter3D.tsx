// src/components/charts/TorrentAgeScatter3D.tsx

"use client"

import clsx from "clsx"
import ReactECharts from "echarts-for-react"
import "echarts-gl"
import { useState } from "react"
import { CHART_THEME } from "@/components/charts/theme"
import type { TorrentInfo } from "@/lib/torrent-utils"

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type Scatter3DView = "age-seed" | "seed-ratio"

const SCATTER3D_VIEWS: Record<Scatter3DView, {
  label: string
  description: string
  x: { idx: number; name: string }
  y: { idx: number; name: string }
  z: { idx: number; name: string }
  color: { idx: number; name: string; max: number }
}> = {
  "age-seed": {
    label: "Age vs Seed Time",
    description: "Age = time since added · Seed Time = cumulative active seeding · Gap reveals downtime · Color = ratio",
    x: { idx: 0, name: "Age (days)" },
    y: { idx: 1, name: "Seed Time (days)" },
    z: { idx: 2, name: "Size (GiB)" },
    color: { idx: 3, name: "Ratio", max: 5 },
  },
  "seed-ratio": {
    label: "Seed Time vs Ratio",
    description: "Are you getting ratio returns for your seeding investment? · Color = age",
    x: { idx: 1, name: "Seed Time (days)" },
    y: { idx: 3, name: "Ratio" },
    z: { idx: 2, name: "Size (GiB)" },
    color: { idx: 0, name: "Age (days)", max: 365 },
  },
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TorrentAgeScatter3DProps {
  torrents: TorrentInfo[]
  accentColor: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TorrentAgeScatter3D({ torrents, accentColor }: TorrentAgeScatter3DProps) {
  const [view, setView] = useState<Scatter3DView>("age-seed")
  const cfg = SCATTER3D_VIEWS[view]

  const now = Date.now() / 1000
  const data = torrents
    .filter((t) => t.addedOn > 0)
    .map((t) => [
      Math.floor((now - t.addedOn) / 86400),   // 0: age
      Math.floor(t.seedingTime / 86400),         // 1: seed time
      +(t.size / 1024 ** 3).toFixed(2),          // 2: size
      Math.min(t.ratio, 10),                     // 3: ratio
    ])

  if (data.length === 0) return null

  const axisStyle = {
    nameTextStyle: { color: CHART_THEME.textTertiary, fontFamily: CHART_THEME.fontMono, fontSize: 10 },
    axisLabel: { color: CHART_THEME.textTertiary, fontFamily: CHART_THEME.fontMono, fontSize: 9 },
    axisLine: { lineStyle: { color: CHART_THEME.borderEmphasis } },
  }

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      formatter: (p: { data: number[] }) => {
        const d = p.data
        return `Age: ${d[0]}d<br/>Seed: ${d[1]}d<br/>Size: ${d[2]} GiB<br/>Ratio: ${d[3].toFixed(2)}`
      },
    },
    visualMap: {
      show: true,
      min: 0,
      max: cfg.color.max,
      dimension: cfg.color.idx,
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
        fontSize: 10,
      },
    },
    xAxis3D: { type: "value", name: cfg.x.name, ...axisStyle },
    yAxis3D: { type: "value", name: cfg.y.name, ...axisStyle },
    zAxis3D: { type: "value", name: cfg.z.name, ...axisStyle },
    grid3D: {
      boxWidth: 100,
      boxDepth: 80,
      boxHeight: 60,
      viewControl: { autoRotate: true, autoRotateSpeed: 4 },
      light: {
        main: { intensity: 1.2 },
        ambient: { intensity: 0.3 },
      },
      environment: CHART_THEME.surface,
    },
    series: [
      {
        type: "scatter3D",
        data,
        symbolSize: 4,
        itemStyle: { opacity: 0.8 },
      },
    ],
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {(Object.keys(SCATTER3D_VIEWS) as Scatter3DView[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={clsx(
              "px-3 py-1.5 text-[11px] font-mono rounded-nm-pill transition-colors cursor-pointer",
              view === key ? "nm-raised-sm text-primary" : "nm-inset-sm text-tertiary hover:text-secondary",
            )}
          >
            {SCATTER3D_VIEWS[key].label}
          </button>
        ))}
      </div>
      <p className="text-xs font-mono text-tertiary">{cfg.description}</p>
      <div className="rounded-nm-md overflow-hidden" style={{ backgroundColor: CHART_THEME.surface }}>
        <ReactECharts
          option={option}
          style={{ height: 400, width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
          lazyUpdate
        />
      </div>
    </div>
  )
}
