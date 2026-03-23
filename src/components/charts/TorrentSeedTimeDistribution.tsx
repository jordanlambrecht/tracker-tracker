// src/components/charts/TorrentSeedTimeDistribution.tsx
//
// Functions: TorrentSeedTimeDistribution

"use client"

import { getSeedTimeBuckets, SEEDING_STATES } from "@/lib/fleet"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildBucketedBarOption } from "./lib/chart-helpers"
import { CHART_THEME } from "./lib/theme"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TorrentSeedTimeDistributionProps {
  torrents: { state: string; seedingTime: number }[]
  seedTimeHours?: number | null
  accentColor?: string
  height?: number
}

function TorrentSeedTimeDistribution({
  torrents,
  seedTimeHours = null,
  accentColor = CHART_THEME.accent,
  height = 200,
}: TorrentSeedTimeDistributionProps) {
  const seeding = torrents.filter((t) => SEEDING_STATES.has(t.state))

  if (seeding.length === 0) {
    return <ChartEmptyState height={height} message="No seeding torrents found" />
  }

  const buckets = getSeedTimeBuckets(accentColor)

  let markLine: { thresholdIdx: number; label: string; color: string } | undefined
  if (seedTimeHours != null && seedTimeHours > 0) {
    const thresholdSeconds = seedTimeHours * 3600
    const idx = buckets.findIndex((b, i) => {
      const prevMax = i === 0 ? 0 : buckets[i - 1].max
      return thresholdSeconds >= prevMax && thresholdSeconds < b.max
    })
    if (idx !== -1) {
      const label =
        seedTimeHours % 24 === 0 ? `Min: ${seedTimeHours / 24}d` : `Min: ${seedTimeHours}h`
      markLine = { thresholdIdx: idx, label, color: CHART_THEME.warn }
    }
  }

  const option = buildBucketedBarOption({
    buckets,
    torrents: seeding,
    getThreshold: (b) => b.max,
    getValue: (t) => t.seedingTime,
    getLabel: (b) => b.label,
    getColor: (b) => b.color,
    labelPrefix: "Seed Time",
    markLine,
  })

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { TorrentSeedTimeDistributionProps }
export { TorrentSeedTimeDistribution, TorrentSeedTimeDistribution as SeedTimeDistribution }
