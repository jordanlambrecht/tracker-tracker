// src/app/(auth)/DashboardClient.tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { H1 } from "@typography"
import dynamic from "next/dynamic"
import { useMemo, useState, useTransition } from "react"
import { DashboardSkeleton } from "@/app/(auth)/DashboardSkeleton"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { AlertsBanner } from "@/components/dashboard/AlertsBanner"
import { AnalyticsSection } from "@/components/dashboard/AnalyticsSection"
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState"
import { DayRangeSidebar } from "@/components/dashboard/DayRangeSidebar"
import { EcosystemStatsSection } from "@/components/dashboard/EcosystemStatsSection"
import { FleetDashboard } from "@/components/dashboard/FleetDashboard"
import { LoginTimers } from "@/components/dashboard/LoginTimers"
import { PollAllButton } from "@/components/dashboard/PollAllButton"
import { TagGroupsSection } from "@/components/dashboard/TagGroupsSection"
import { TodayAtAGlance } from "@/components/dashboard/TodayAtAGlance"
import { TodayAtAGlanceSkeleton } from "@/components/dashboard/TodayAtAGlanceSkeleton"
import { TrackerLeaderboard } from "@/components/dashboard/TrackerLeaderboard"
import { TrackerOverviewGrid } from "@/components/dashboard/TrackerOverviewGrid"
import { useChartPreferences } from "@/components/dashboard/useChartPreferences"
import { useDashboardSettings } from "@/components/dashboard/useDashboardSettings"
import { Button, Divider, GearIcon, TabBar } from "@/components/ui"
import { SectionToggle } from "@/components/ui/SectionToggle"
import { ChartGridSkeleton } from "@/components/ui/skeletons"
import { useDashboardData } from "@/hooks/useDashboardData"
import { usePollingIntervals } from "@/hooks/usePollingIntervals"
import { useSectionCollapse } from "@/hooks/useSectionCollapse"
import { computeAggregateStats } from "@/lib/dashboard"
import type { FleetAggregation } from "@/lib/fleet-aggregation"
import { fleetCachedQueryOptions } from "@/lib/query-options"
import type { Snapshot, TrackerSummary } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"

const DashboardSettingsSheet = dynamic(
  () =>
    import("@/components/dashboard/DashboardSettingsSheet").then((m) => m.DashboardSettingsSheet),
  { ssr: false }
)

const DASHBOARD_TABS = [
  { key: "tracker-stats" as const, label: "Tracker Stats" },
  { key: "torrent-fleet" as const, label: "Torrent Fleet" },
]

function buildTrackerSeries(
  trackers: TrackerSummary[],
  snapshotMap: Map<number, Snapshot[]>
): TrackerSnapshotSeries[] {
  return trackers.map((t) => ({
    name: t.name,
    color: t.color,
    snapshots: snapshotMap.get(t.id) ?? [],
  }))
}

// Stable select: the dashboard only needs the tag group counts, so the fleet tab's own
// refetches of this cache do not re-render the rest of the page.
const selectTagGroupBreakdowns = (data: FleetAggregation) => data.tagGroupBreakdowns

interface DashboardClientProps {
  initialTrackers: TrackerSummary[]
  snapshotRetentionDays: number | null
  /** Read server-side from two small queries. False skips the Tag Groups fetch entirely. */
  hasTagGroups: boolean
}

export function DashboardClient({
  initialTrackers,
  snapshotRetentionDays,
  hasTagGroups,
}: DashboardClientProps) {
  const data = useDashboardData({ initialTrackers, snapshotRetentionDays })
  const dashSettings = useDashboardSettings()
  const sectionCollapse = useSectionCollapse()
  // One instance for the whole page, like sectionCollapse above. The analytics grid and the
  // settings sheet are mounted together and each write stores the whole preferences object,
  // so a second instance would revert the other surface's last change.
  const chartPrefs = useChartPreferences()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Two-state tab pattern: dashboardTab updates immediately (drives TabBar pill animation),
  // deferredTab updates via startTransition (drives content switch + query gating).
  // This prevents the 350ms React reconciliation from blocking the pill's CSS transition.
  const [dashboardTab, setDashboardTab] = useState<"tracker-stats" | "torrent-fleet">(
    "tracker-stats"
  )
  const [deferredTab, setDeferredTab] = useState<"tracker-stats" | "torrent-fleet">("tracker-stats")
  const [, startTransition] = useTransition()
  const intervals = usePollingIntervals()

  // Tag group counts share the Torrent Fleet tab's cached aggregation rather than being
  // computed during SSR, so they cost this page nothing before first paint. Sharing the cache
  // also means they go stale and refresh on the fleet's own schedule — including the fleet
  // tab's refresh button — instead of being frozen until a full page reload.
  const { data: tagGroupBreakdowns = [], isPending: tagGroupsPending } = useQuery({
    ...fleetCachedQueryOptions,
    staleTime: intervals.clientRefetchMs,
    enabled: hasTagGroups,
    select: selectTagGroupBreakdowns,
  })

  const aggregateStats = useMemo(() => computeAggregateStats(data.trackers), [data.trackers])
  const trackerSeries = useMemo(
    () => buildTrackerSeries(data.trackers, data.snapshotMap),
    [data.trackers, data.snapshotMap]
  )

  // Sections render expanded until localStorage has been read. Charts gate the other way
  // (collapsed until hydrated) because mounting echarts is expensive; section content is
  // already in the server-rendered HTML, so hiding it until hydration would blank the page
  // and pop it back open for the common case of nothing being collapsed at all.
  const isExpanded = (id: string) => !sectionCollapse.hydrated || !sectionCollapse.isCollapsed(id)

  const todayAtAGlanceExpanded = isExpanded("today-at-a-glance")
  const trackersExpanded = isExpanded("trackers")
  const leaderboardExpanded = isExpanded("leaderboard")
  const ecosystemStatsExpanded = isExpanded("ecosystem-stats")
  const loginTimersExpanded = isExpanded("login-timers")
  const tagGroupsExpanded = isExpanded("tag-groups")

  if (data.loading) {
    return <DashboardSkeleton />
  }

  if (data.trackers.length === 0) {
    return <DashboardEmptyState onAdded={data.refresh} />
  }

  return (
    <div className="flex flex-col gap-10 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <H1>Dashboard</H1>
        <div className="flex items-center gap-2">
          <PollAllButton onPollComplete={data.refresh} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            aria-label="Dashboard settings"
            className="group"
          >
            <GearIcon
              width="16"
              height="16"
              className="transition-transform duration-300 group-active:rotate-90"
            />
          </Button>
        </div>
      </div>

      {/* Today At A Glance */}
      {dashSettings.settings.showTodayAtAGlance && (
        <div className="flex flex-col gap-4">
          <SectionToggle
            label="Today At A Glance"
            expanded={todayAtAGlanceExpanded}
            onToggle={() => sectionCollapse.toggle("today-at-a-glance")}
          />
          {todayAtAGlanceExpanded &&
            (data.todayData ? (
              <TodayAtAGlance data={data.todayData} />
            ) : data.todayLoading ? (
              <TodayAtAGlanceSkeleton />
            ) : null)}
        </div>
      )}

      {/* Tracker Overview */}
      <div className="flex flex-col gap-4">
        <SectionToggle
          label="Trackers"
          expanded={trackersExpanded}
          onToggle={() => sectionCollapse.toggle("trackers")}
        />
        {trackersExpanded && (
          <TrackerOverviewGrid
            trackers={data.trackers}
            showHealthIndicators={dashSettings.settings.showHealthIndicators}
          />
        )}
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <AlertsBanner
          alerts={data.alerts}
          onDismiss={data.dismissAlert}
          onDismissAll={data.dismissAllAlerts}
        />
      )}

      {/* Login Timers */}
      {dashSettings.settings.showLoginTimers && (
        <LoginTimers
          trackers={data.trackers}
          expanded={loginTimersExpanded}
          onToggleExpanded={() => sectionCollapse.toggle("login-timers")}
        />
      )}

      {/* Leaderboard */}
      <div className="flex flex-col gap-4">
        <SectionToggle
          label="Leaderboard"
          expanded={leaderboardExpanded}
          onToggle={() => sectionCollapse.toggle("leaderboard")}
        />
        {leaderboardExpanded && <TrackerLeaderboard trackers={data.trackers} />}
      </div>

      {/* Divider */}
      <Divider />

      {/* Aggregate Stats */}
      <div className="flex flex-col gap-4">
        <SectionToggle
          label="Ecosystem"
          expanded={ecosystemStatsExpanded}
          onToggle={() => sectionCollapse.toggle("ecosystem-stats")}
        />
        {ecosystemStatsExpanded && (
          <EcosystemStatsSection trackers={data.trackers} aggregateStats={aggregateStats} />
        )}
      </div>

      {/* Tag Groups — omitted entirely when none are configured or none of them match */}
      {hasTagGroups && (tagGroupsPending || tagGroupBreakdowns.length > 0) && (
        <div className="flex flex-col gap-4">
          <SectionToggle
            label="Tag Groups"
            expanded={tagGroupsExpanded}
            onToggle={() => sectionCollapse.toggle("tag-groups")}
          />
          {tagGroupsExpanded &&
            (tagGroupBreakdowns.length > 0 ? (
              <TagGroupsSection breakdowns={tagGroupBreakdowns} accentColor={CHART_THEME.accent} />
            ) : (
              <ChartGridSkeleton count={2} />
            ))}
        </div>
      )}

      {/* Divider */}
      <Divider />

      {/* Tab Switcher */}
      <TabBar
        tabs={DASHBOARD_TABS}
        activeTab={dashboardTab}
        onChange={(tab) => {
          setDashboardTab(tab)
          startTransition(() => setDeferredTab(tab))
        }}
      />

      {/*  Analytics / Fleet  */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        <div className="flex-1 min-w-0">
          <div className={deferredTab !== "torrent-fleet" ? "hidden" : undefined}>
            <FleetDashboard dayRange={data.dayRange} isActive={deferredTab === "torrent-fleet"} />
          </div>
          <div className={deferredTab !== "tracker-stats" ? "hidden" : undefined}>
            <AnalyticsSection
              trackerSeries={trackerSeries}
              trackers={data.trackers}
              chartPrefs={chartPrefs}
              dashSettings={dashSettings}
            />
          </div>
        </div>

        {/* Sticky sidebar*/}
        <DayRangeSidebar
          days={data.dayRange}
          onChange={data.setDayRange}
          accentColor={CHART_THEME.accent}
        />
      </div>

      {/* Settings Sheet */}
      <DashboardSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        chartPrefs={chartPrefs}
        dashSettings={dashSettings}
      />
    </div>
  )
}
