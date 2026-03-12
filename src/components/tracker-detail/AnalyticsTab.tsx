// src/components/tracker-detail/AnalyticsTab.tsx
//
// Functions: AnalyticsTab

import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import { AnalyticsCharts } from "@/components/tracker-detail/AnalyticsCharts"
import { CoreStatCards } from "@/components/tracker-detail/CoreStatCards"
import { PollLog } from "@/components/tracker-detail/PollLog"
import { GazelleStatCards } from "@/components/tracker-detail/platform/GazelleStatCards"
import { GgnAchievementProgress } from "@/components/tracker-detail/platform/GgnAchievementProgress"
import { GgnBuffsDisplay } from "@/components/tracker-detail/platform/GgnBuffsDisplay"
import { GgnShareScoreProgress } from "@/components/tracker-detail/platform/GgnShareScoreProgress"
import { GgnStatCards } from "@/components/tracker-detail/platform/GgnStatCards"
import type { GazellePlatformMeta, GGnPlatformMeta, NebulancePlatformMeta, Snapshot, TrackerLatestStats, TrackerSummary } from "@/types/api"

interface AnalyticsTabProps {
  tracker: TrackerSummary
  snapshots: Snapshot[]
  stats: TrackerLatestStats | null
  latestSnapshot: Snapshot | null
  ggMeta: GGnPlatformMeta | null
  gazelleMeta: GazellePlatformMeta | null
  nebulanceMeta: NebulancePlatformMeta | null
  accentColor: string
  days: DayRange
  onDaysChange: (d: DayRange) => void
  delta: { uploaded: string; downloaded: string } | null
  minimumRatio?: number
}

export function AnalyticsTab({
  tracker,
  snapshots,
  stats,
  latestSnapshot,
  ggMeta,
  gazelleMeta,
  nebulanceMeta,
  accentColor: tc,
  days,
  onDaysChange,
  delta,
  minimumRatio,
}: AnalyticsTabProps) {
  return (
    <div className="flex flex-col gap-10">
      <GgnAchievementProgress ggMeta={ggMeta} accentColor={tc} />
      <GgnShareScoreProgress platformType={tracker.platformType} latestSnapshot={latestSnapshot} accentColor={tc} />
      <CoreStatCards
        stats={stats}
        latestSnapshot={latestSnapshot}
        platformType={tracker.platformType}
        ggMeta={ggMeta}
        nebulanceMeta={nebulanceMeta}
        accentColor={tc}
      />
      <GgnStatCards platformType={tracker.platformType} latestSnapshot={latestSnapshot} accentColor={tc} />
      <GazelleStatCards gazelleMeta={gazelleMeta} accentColor={tc} />
      <GgnBuffsDisplay ggMeta={ggMeta} accentColor={tc} />
      <hr className="border-border" />
      <PollLog
        snapshots={snapshots}
        lastPolledAt={tracker.lastPolledAt}
        lastError={tracker.lastError}
      />
      <AnalyticsCharts
        platformType={tracker.platformType}
        snapshots={snapshots}
        accentColor={tc}
        days={days}
        onDaysChange={onDaysChange}
        delta={delta}
        gazelleMeta={gazelleMeta}
        minimumRatio={minimumRatio}
      />
    </div>
  )
}
