// src/components/charts/FleetRatioDistribution.tsx
//
// Functions: FleetRatioDistribution

"use client"

import ReactECharts from "echarts-for-react"
import { RATIO_BUCKETS } from "@/lib/fleet"
import { ChartEmptyState } from "./ChartEmptyState"
import { buildBucketedBarOption } from "./chart-helpers"

interface FleetRatioDistributionProps {
  torrents: { ratio: number }[]
  height?: number
}

function FleetRatioDistribution({ torrents, height = 280 }: FleetRatioDistributionProps) {
  if (torrents.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  const option = buildBucketedBarOption({
    buckets: RATIO_BUCKETS,
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
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export type { FleetRatioDistributionProps }
export { FleetRatioDistribution }
