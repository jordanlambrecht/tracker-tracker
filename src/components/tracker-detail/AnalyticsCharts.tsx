// src/components/tracker-detail/AnalyticsCharts.tsx
//
// Functions: AnalyticsCharts

import { MetricChart } from "@/components/charts/MetricChart"
import { PercentileRadarChart } from "@/components/charts/PercentileRadarChart"
import { UploadDownloadChart } from "@/components/charts/UploadDownloadChart"
import { UploadPolarChart } from "@/components/charts/UploadPolarChart"
import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import { DayRangeSidebar } from "@/components/dashboard/DayRangeSidebar"
import { Card } from "@/components/ui/Card"
import { H2 } from "@/components/ui/Typography"
import { formatBytesFromString } from "@/lib/formatters"
import type { GazellePlatformMeta, Snapshot } from "@/types/api"

interface AnalyticsChartsProps {
  platformType: string
  snapshots: Snapshot[]
  accentColor: string
  days: DayRange
  onDaysChange: (d: DayRange) => void
  delta: { uploaded: string; downloaded: string } | null
  gazelleMeta: GazellePlatformMeta | null
  minimumRatio?: number
}

export function AnalyticsCharts({
  platformType,
  snapshots,
  accentColor: tc,
  days,
  onDaysChange,
  delta,
  gazelleMeta,
  minimumRatio,
}: AnalyticsChartsProps) {
  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1 flex flex-col gap-8 min-w-0">
        {/* Upload/Download chart */}
        <Card trackerColor={tc} className="flex flex-col gap-4">
          <H2>Upload / Download History</H2>
          {delta && (
            <p className="text-xs font-mono text-tertiary">
              24h: <span className="text-primary">{formatBytesFromString(delta.uploaded)}</span> ↑{" "}
              <span className="text-primary">{formatBytesFromString(delta.downloaded)}</span> ↓
            </p>
          )}
          <UploadDownloadChart snapshots={snapshots} accentColor={tc} showDataZoom={days >= 30 || days === 0} />
        </Card>

        {/* Ratio */}
        <Card trackerColor={tc} className="flex flex-col gap-4">
          <H2>Ratio</H2>
          <MetricChart metric="ratio" snapshots={snapshots} accentColor={tc} baselineValue={minimumRatio} />
        </Card>

        {/* Buffer */}
        <Card trackerColor={tc} className="flex flex-col gap-4">
          <H2>Buffer</H2>
          <MetricChart metric="buffer" snapshots={snapshots} accentColor={tc} />
        </Card>

        {/* Seedbonus / Gold */}
        <Card trackerColor={tc} className="flex flex-col gap-4">
          <H2>{platformType === "ggn" ? "Gold" : "Seedbonus"}</H2>
          <MetricChart metric="seedbonus" snapshots={snapshots} accentColor={tc} />
        </Card>

        {/* GGn Share Score chart */}
        {platformType === "ggn" && (
          <Card trackerColor={tc} className="flex flex-col gap-4">
            <H2>Share Score</H2>
            <MetricChart metric="shareScore" snapshots={snapshots} accentColor={tc} />
          </Card>
        )}

        {/* Gazelle Percentile Radar */}
        {gazelleMeta?.ranks && (
          <Card trackerColor={tc} className="flex flex-col gap-4">
            <H2>Percentile Ranks</H2>
            <p className="text-xs font-mono text-tertiary">
              Your standing relative to all users — {gazelleMeta.ranks.overall}th percentile overall
            </p>
            <PercentileRadarChart ranks={gazelleMeta.ranks} accentColor={tc} />
          </Card>
        )}

        {/* Seeding Count */}
        <Card trackerColor={tc} className="flex flex-col gap-4">
          <H2>Seeding Count</H2>
          <MetricChart metric="seedingCount" snapshots={snapshots} accentColor={tc} />
        </Card>

        {/* Daily Activity */}
        <Card trackerColor={tc} className="flex flex-col gap-4">
          <H2>Daily Activity</H2>
          <MetricChart metric="dailyDelta" snapshots={snapshots} accentColor={tc} />
        </Card>

        {/* Upload by Time of Day */}
        <Card trackerColor={tc} className="flex flex-col gap-4">
          <H2>Upload by Time of Day</H2>
          <UploadPolarChart snapshots={snapshots} accentColor={tc} />
        </Card>
      </div>

      {/* Sticky sidebar */}
      <DayRangeSidebar days={days} onChange={onDaysChange} accentColor={tc} />
    </div>
  )
}
