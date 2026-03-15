// src/components/dashboard/EcosystemStatsSection.tsx
//
// Functions: EcosystemStatsSection

"use client"

import type { ReactNode } from "react"
import {
  DownloadArrowIcon,
  GridIcon,
  LeechingIcon,
  RatioIcon,
  SeedingIcon,
  ShieldIcon,
  UploadArrowIcon,
} from "@/components/ui/Icons"
import { StatCard } from "@/components/ui/StatCard"
import { H2 } from "@/components/ui/Typography"
import type { AggregateStats } from "@/lib/dashboard"
import { formatBytesFromString, formatRatio, splitValueUnit } from "@/lib/formatters"
import type { TrackerSummary } from "@/types/api"

const AGGREGATE_ICONS: Record<string, ReactNode> = {
  trackers: <GridIcon width="16" height="16" />,
  uploaded: <UploadArrowIcon width="16" height="16" />,
  downloaded: <DownloadArrowIcon width="16" height="16" />,
  buffer: <ShieldIcon width="16" height="16" />,
  ratio: <RatioIcon width="16" height="16" />,
  seeding: <SeedingIcon width="16" height="16" />,
  leeching: <LeechingIcon width="16" height="16" />,
}

interface EcosystemStatsSectionProps {
  trackers: TrackerSummary[]
  aggregateStats: AggregateStats
}

function EcosystemStatsSection({ trackers, aggregateStats }: EcosystemStatsSectionProps) {
  const uploadedParts = splitValueUnit(formatBytesFromString(aggregateStats.totalUploaded))
  const downloadedParts = splitValueUnit(formatBytesFromString(aggregateStats.totalDownloaded))
  const bufferParts = splitValueUnit(formatBytesFromString(aggregateStats.totalBuffer))

  return (
    <div className="flex flex-col gap-4">
      <H2>Ecosystem</H2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        <StatCard
          label="Trackers"
          value={trackers.length.toString()}
          icon={AGGREGATE_ICONS.trackers}
        />
        <StatCard
          label="Total Uploaded"
          value={uploadedParts.num}
          unit={uploadedParts.unit}
          icon={AGGREGATE_ICONS.uploaded}
        />
        <StatCard
          label="Total Downloaded"
          value={downloadedParts.num}
          unit={downloadedParts.unit}
          icon={AGGREGATE_ICONS.downloaded}
        />
        <StatCard
          label="Total Buffer"
          value={bufferParts.num}
          unit={bufferParts.unit}
          icon={AGGREGATE_ICONS.buffer}
        />
        <StatCard
          label="Avg Ratio"
          value={formatRatio(aggregateStats.avgRatio)}
          icon={AGGREGATE_ICONS.ratio}
          trend={
            aggregateStats.avgRatio === null
              ? undefined
              : aggregateStats.avgRatio >= 2
                ? "up"
                : aggregateStats.avgRatio >= 1
                  ? "flat"
                  : "down"
          }
        />
        <StatCard
          label="Seeding"
          value={aggregateStats.totalSeeding.toLocaleString()}
          icon={AGGREGATE_ICONS.seeding}
        />
        <StatCard
          label="Leeching"
          value={aggregateStats.totalLeeching.toLocaleString()}
          icon={AGGREGATE_ICONS.leeching}
        />
      </div>
    </div>
  )
}

export { EcosystemStatsSection }
