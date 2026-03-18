// src/components/charts/TorrentSeedTimeDistribution.tsx

"use client"

import ReactECharts from "echarts-for-react"
import { buildBucketedBarOption } from "@/components/charts/chart-helpers"
import { CHART_THEME } from "@/components/charts/theme"
import type { TorrentInfo } from "@/lib/torrent-utils"
import { SEEDING_STATES } from "@/lib/torrent-utils"

// ---------------------------------------------------------------------------
// Bucket definitions
// ---------------------------------------------------------------------------

interface SeedTimeBucket {
  label: string
  max: number
  color: string
}

function getSeedTimeBuckets(accentColor: string): SeedTimeBucket[] {
  return [
    { label: "< 1d", max: 86400, color: CHART_THEME.scale[0] },
    { label: "1-7d", max: 604800, color: CHART_THEME.scale[1] },
    { label: "7-30d", max: 2592000, color: CHART_THEME.scale[2] },
    { label: "30-90d", max: 7776000, color: accentColor },
    { label: "90d+", max: Infinity, color: CHART_THEME.scale[4] },
  ]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TorrentSeedTimeDistributionProps {
  torrents: TorrentInfo[]
  seedTimeHours: number | null
  accentColor: string
}

export function TorrentSeedTimeDistribution({
  torrents,
  seedTimeHours,
  accentColor,
}: TorrentSeedTimeDistributionProps) {
  const seeding = torrents.filter((t) => SEEDING_STATES.has(t.state))
  const buckets = getSeedTimeBuckets(accentColor)

  const thresholdSeconds = seedTimeHours != null && seedTimeHours > 0 ? seedTimeHours * 3600 : null

  let markLine: { thresholdIdx: number; label: string; color: string } | undefined
  if (thresholdSeconds !== null) {
    const idx = buckets.findIndex((b, i) => {
      const prevMax = i === 0 ? 0 : buckets[i - 1].max
      return thresholdSeconds >= prevMax && thresholdSeconds < b.max
    })
    if (idx !== -1) {
      const labelStr =
        seedTimeHours != null && seedTimeHours > 0
          ? `Min: ${seedTimeHours % 24 === 0 ? `${seedTimeHours / 24}d` : `${seedTimeHours}h`}`
          : "Min"
      markLine = { thresholdIdx: idx, label: labelStr, color: CHART_THEME.warn }
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
