// src/components/charts/TorrentRatioDistribution.tsx
//
// Functions: TorrentRatioDistribution

"use client"

import { getRatioBuckets } from "@/lib/fleet"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildBucketedBarOption } from "./lib/chart-helpers"
import { CHART_THEME } from "./lib/theme"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TorrentRatioDistributionProps {
  torrents: { ratio: number }[]
  accentColor?: string
  height?: number
}

function TorrentRatioDistribution({
  torrents,
  accentColor = CHART_THEME.accent,
  height = 280,
}: TorrentRatioDistributionProps) {
  if (torrents.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

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

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { TorrentRatioDistributionProps }
export { TorrentRatioDistribution }
