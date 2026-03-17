// src/components/charts/TorrentRatioDistribution.tsx

"use client"

import ReactECharts from "echarts-for-react"
import type { TorrentInfo } from "@/lib/torrent-utils"
import { buildBucketedBarOption } from "./chart-helpers"
import { CHART_THEME } from "./theme"

// ---------------------------------------------------------------------------
// Bucket definitions
// ---------------------------------------------------------------------------

interface RatioBucket {
  label: string
  max: number
  color: string
}

function getRatioBuckets(accentColor: string): RatioBucket[] {
  return [
    { label: "< 0.5", max: 0.5, color: CHART_THEME.scale[0] },
    { label: "0.5-1", max: 1, color: CHART_THEME.scale[1] },
    { label: "1-2", max: 2, color: CHART_THEME.scale[2] },
    { label: "2-5", max: 5, color: accentColor },
    { label: "5-10", max: 10, color: CHART_THEME.scale[4] },
    { label: "10+", max: Infinity, color: CHART_THEME.scale[5] },
  ]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TorrentRatioDistributionProps {
  torrents: TorrentInfo[]
  accentColor: string
}

export function TorrentRatioDistribution({ torrents, accentColor }: TorrentRatioDistributionProps) {
  const buckets = getRatioBuckets(accentColor)

  const option = buildBucketedBarOption({
    buckets,
    torrents,
    getThreshold: (b) => b.max,
    getValue: (t) => t.ratio,
    getLabel: (b) => b.label,
    getColor: (b) => b.color,
    labelPrefix: "Ratio",
  })

  return (
    <ReactECharts
      option={option}
      style={{ height: 200, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
