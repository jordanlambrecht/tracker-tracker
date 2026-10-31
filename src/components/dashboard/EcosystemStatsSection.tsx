// src/components/dashboard/EcosystemStatsSection.tsx
"use client"

import type { ReactNode } from "react"
import {
  DownloadArrowIcon,
  GridIcon,
  LeechingIcon,
  RatioIcon,
  SeedingIcon,
  ShieldIcon,
  TriangleWarningIcon,
  UploadArrowIcon,
} from "@/components/ui/Icons"
import { StatCard } from "@/components/ui/StatCard"
import type { AggregateStats } from "@/lib/dashboard"
import { formatBytesFromString, formatCount, formatRatio, splitValueUnit } from "@/lib/formatters"
import type { TrackerSummary } from "@/types/api"

const AGGREGATE_ICONS: Record<string, ReactNode> = {
  trackers: <GridIcon width="16" height="16" />,
  uploaded: <UploadArrowIcon width="16" height="16" />,
  downloaded: <DownloadArrowIcon width="16" height="16" />,
  buffer: <ShieldIcon width="16" height="16" />,
  ratio: <RatioIcon width="16" height="16" />,
  seeding: <SeedingIcon width="16" height="16" />,
  leeching: <LeechingIcon width="16" height="16" />,
  hitAndRuns: <TriangleWarningIcon width="16" height="16" />,
}

// Doubles as the alert button's accessible name, so it has to say what the
// numbers are: "Alert: Aither: 2" reads as nothing to a screen reader.
function describeHitAndRuns(list: AggregateStats["trackersWithHitAndRuns"]): string {
  return `Hit & runs: ${list.map((t) => `${formatCount(t.count)} on ${t.name}`).join(", ")}`
}

interface EcosystemStatsSectionProps {
  trackers: TrackerSummary[]
  aggregateStats: AggregateStats
}

function EcosystemStatsSection({ trackers, aggregateStats }: EcosystemStatsSectionProps) {
  const uploadedParts = splitValueUnit(formatBytesFromString(aggregateStats.totalUploaded))
  const downloadedParts = splitValueUnit(formatBytesFromString(aggregateStats.totalDownloaded))
  const bufferParts = splitValueUnit(formatBytesFromString(aggregateStats.totalBuffer))

  // "0" is only honest once at least one tracker reports the field; an all-unknown
  // fleet gets a dash so it never reads as clean.
  const { hitAndRunReportingTrackers: hnrReporters, totalHitAndRuns } = aggregateStats
  const hnrKnown = hnrReporters > 0
  const hnrTooltip = !hnrKnown
    ? "None of your trackers report hit & runs"
    : hnrReporters < trackers.length
      ? `${hnrReporters} of ${trackers.length} trackers report hit & runs`
      : undefined
  const hnrReason =
    totalHitAndRuns > 0 ? describeHitAndRuns(aggregateStats.trackersWithHitAndRuns) : undefined

  return (
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
      />
      <StatCard
        label="Seeding"
        value={formatCount(aggregateStats.totalSeeding)}
        icon={AGGREGATE_ICONS.seeding}
      />
      <StatCard
        label="Leeching"
        value={formatCount(aggregateStats.totalLeeching)}
        icon={AGGREGATE_ICONS.leeching}
      />
      <StatCard
        label="Hit & Runs"
        value={hnrKnown ? formatCount(totalHitAndRuns) : "—"}
        icon={AGGREGATE_ICONS.hitAndRuns}
        tooltip={hnrTooltip}
        alert={hnrReason ? "danger" : undefined}
        alertReason={hnrReason}
      />
    </div>
  )
}

export { EcosystemStatsSection }
