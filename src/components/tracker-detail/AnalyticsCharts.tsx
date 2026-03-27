// src/components/tracker-detail/AnalyticsCharts.tsx

import { BufferCandlestickChart } from "@/components/charts/BufferCandlestickChart"
import { MetricChart } from "@/components/charts/MetricChart"
import { PercentileRadarChart } from "@/components/charts/PercentileRadarChart"
import { UploadDownloadChart } from "@/components/charts/UploadDownloadChart"
import { UploadPolarChart } from "@/components/charts/UploadPolarChart"
import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import { DayRangeSidebar } from "@/components/dashboard/DayRangeSidebar"
import { Card } from "@/components/ui/Card"
import { formatBytesFromString } from "@/lib/formatters"
import type { GazellePlatformMeta, Snapshot } from "@/types/api"

interface AnalyticsChartsProps {
  trackerName: string
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
  trackerName,
  platformType,
  snapshots,
  accentColor: tc,
  days,
  onDaysChange,
  delta,
  gazelleMeta,
  minimumRatio,
}: AnalyticsChartsProps) {
  const candlestickData = [{ name: trackerName, color: tc, snapshots }]
  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1 flex flex-col gap-8 min-w-0">
        {/* Upload/Download chart */}
        <Card title="Upload / Download History" trackerColor={tc} className="flex flex-col gap-4">
          {delta && (
            <p className="text-xs font-mono text-tertiary">
              24h: <span className="text-primary">{formatBytesFromString(delta.uploaded)}</span> ↑{" "}
              <span className="text-primary">{formatBytesFromString(delta.downloaded)}</span> ↓
            </p>
          )}
          <UploadDownloadChart
            snapshots={snapshots}
            accentColor={tc}
            showDataZoom={days >= 30 || days === 0}
          />
        </Card>

        {/* Ratio */}
        <Card lazy title="Ratio" trackerColor={tc} className="flex flex-col gap-4">
          <MetricChart
            metric="ratio"
            snapshots={snapshots}
            accentColor={tc}
            baselineValue={minimumRatio}
          />
        </Card>

        {/* Buffer */}
        <Card lazy title="Buffer" trackerColor={tc} className="flex flex-col gap-4">
          <MetricChart metric="buffer" snapshots={snapshots} accentColor={tc} />
        </Card>

        {/* Buffer Candlestick */}
        <Card lazy title="Daily Buffer" trackerColor={tc} className="flex flex-col gap-4">
          <BufferCandlestickChart trackerData={candlestickData} height={320} />
        </Card>

        {/* Seedbonus / Gold */}
        <Card
          lazy
          title={platformType === "ggn" ? "Gold" : "Seedbonus"}
          trackerColor={tc}
          className="flex flex-col gap-4"
        >
          <MetricChart metric="seedbonus" snapshots={snapshots} accentColor={tc} />
        </Card>

        {/* GGn Share Score chart */}
        {platformType === "ggn" && (
          <Card lazy title="Share Score" trackerColor={tc} className="flex flex-col gap-4">
            <MetricChart metric="shareScore" snapshots={snapshots} accentColor={tc} />
          </Card>
        )}

        {/* FL Wedges (MAM only) */}
        {platformType === "mam" && (
          <Card lazy title="FL Wedges" trackerColor={tc} className="flex flex-col gap-4">
            <MetricChart metric="freeleechTokens" snapshots={snapshots} accentColor={tc} />
          </Card>
        )}

        {/* Gazelle Percentile Radar */}
        {gazelleMeta?.ranks && (
          <Card lazy title="Percentile Ranks" trackerColor={tc} className="flex flex-col gap-4">
            <p className="text-xs font-mono text-tertiary">
              Your standing relative to all users — {gazelleMeta.ranks.overall}th percentile overall
            </p>
            <PercentileRadarChart ranks={gazelleMeta.ranks} accentColor={tc} />
          </Card>
        )}

        {/* Seeding Count */}
        <Card lazy title="Seeding Count" trackerColor={tc} className="flex flex-col gap-4">
          <MetricChart metric="seedingCount" snapshots={snapshots} accentColor={tc} />
        </Card>

        {/* Daily Activity */}
        <Card lazy title="Daily Activity" trackerColor={tc} className="flex flex-col gap-4">
          <MetricChart metric="dailyDelta" snapshots={snapshots} accentColor={tc} />
        </Card>

        {/* Activity by Time of Day */}
        <Card
          lazy
          title="Activity by Time of Day"
          trackerColor={tc}
          className="flex flex-col gap-4"
        >
          <UploadPolarChart snapshots={snapshots} accentColor={tc} />
        </Card>
      </div>

      {/* Sticky sidebar */}
      <DayRangeSidebar days={days} onChange={onDaysChange} accentColor={tc} />
    </div>
  )
}
