// src/components/charts/FleetSeedTimeDistribution.tsx
//
// Functions: FleetSeedTimeDistribution

"use client"

import ReactECharts from "echarts-for-react"
import { SEED_TIME_BUCKETS, SEEDING_STATES } from "@/lib/fleet"
import { ChartEmptyState } from "./ChartEmptyState"
import { buildBucketedBarOption } from "./chart-helpers"

interface FleetSeedTimeDistributionProps {
  torrents: { state: string; seeding_time: number }[]
  height?: number
}

function FleetSeedTimeDistribution({ torrents, height = 280 }: FleetSeedTimeDistributionProps) {
  const seedingTorrents = torrents.filter((t) => SEEDING_STATES.has(t.state))

  if (seedingTorrents.length === 0) {
    return <ChartEmptyState height={height} message="No seeding torrents found" />
  }

  const option = buildBucketedBarOption({
    buckets: SEED_TIME_BUCKETS,
    torrents: seedingTorrents,
    getThreshold: (b) => b.maxSeconds,
    getValue: (t) => t.seeding_time,
    getLabel: (b) => b.label,
    getColor: (b) => b.color,
    labelPrefix: "Seed Time",
    pctSuffix: " of seeding",
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

export type { FleetSeedTimeDistributionProps }
export { FleetSeedTimeDistribution }
