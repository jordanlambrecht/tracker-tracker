// src/app/(auth)/page.tsx
//
// Functions: buildTrackerSeries, DashboardPage

"use client"

import { useMemo, useState } from "react"
import { CHART_THEME } from "@/components/charts/theme"
import { AlertsBanner } from "@/components/dashboard/AlertsBanner"
import { AnalyticsSection } from "@/components/dashboard/AnalyticsSection"
import { DashboardSettingsSheet } from "@/components/dashboard/DashboardSettingsSheet"
import { DayRangeSidebar } from "@/components/dashboard/DayRangeSidebar"
import { EcosystemStatsSection } from "@/components/dashboard/EcosystemStatsSection"
import { FleetDashboard } from "@/components/dashboard/FleetDashboard"
import { LoginTimers } from "@/components/dashboard/LoginTimers"
import { PollAllButton } from "@/components/dashboard/PollAllButton"
import { TrackerLeaderboard } from "@/components/dashboard/TrackerLeaderboard"
import { TrackerOverviewGrid } from "@/components/dashboard/TrackerOverviewGrid"
import { useDashboardSettings } from "@/components/dashboard/useDashboardSettings"
import { Button } from "@/components/ui/Button"
import { GearIcon } from "@/components/ui/Icons"
import { TabBar } from "@/components/ui/TabBar"
import { H1, H2 } from "@typography"
import { useDashboardData } from "@/hooks/useDashboardData"
import { computeAggregateStats } from "@/lib/dashboard"
import type { Snapshot, TrackerSummary } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"

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

export default function DashboardPage() {
  const data = useDashboardData()
  const dashSettings = useDashboardSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dashboardTab, setDashboardTab] = useState<"tracker-stats" | "torrent-fleet">("tracker-stats")

  const aggregateStats = useMemo(() => computeAggregateStats(data.trackers), [data.trackers])
  const trackerSeries = useMemo(
    () => buildTrackerSeries(data.trackers, data.snapshotMap),
    [data.trackers, data.snapshotMap]
  )

  if (data.loading) {
    return (
      <div className="flex h-full min-h-[calc(100vh-6rem)] items-center justify-center">
        <p className="text-secondary text-sm font-mono animate-loading-breathe">Loading dashboard...</p>
      </div>
    )
  }

  if (data.trackers.length === 0) {
    return (
      <div className="flex h-full min-h-[calc(100vh-6rem)] items-center justify-center">
        <p className="text-secondary text-sm font-mono">No trackers added yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10 max-w-6xl mx-auto pb-12">
      {/* ── Page Header ── */}
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

      {/* ── Section 1: Tracker Overview ── */}
      <div className="flex flex-col gap-4">
        <H2>Trackers</H2>
        <TrackerOverviewGrid
          trackers={data.trackers}
          showHealthIndicators={dashSettings.settings.showHealthIndicators}
        />
      </div>

      {/* ── Section 2: Alerts ── */}
      {data.alerts.length > 0 && (
        <AlertsBanner alerts={data.alerts} onDismiss={data.dismissAlert} onDismissAll={data.dismissAllAlerts} />
      )}

      {/* ── Section 3: Login Timers ── */}
      {dashSettings.settings.showLoginTimers && <LoginTimers trackers={data.trackers} />}

      {/* ── Section 4: Leaderboard ── */}
      <div className="flex flex-col gap-4">
        <H2>Leaderboard</H2>
        <TrackerLeaderboard trackers={data.trackers} />
      </div>

      {/* ── Divider ── */}
      <div
        className="h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${CHART_THEME.borderEmphasis}, transparent)` }}
      />

      {/* ── Section 4: Ecosystem (Aggregate Stats) ── */}
      <EcosystemStatsSection trackers={data.trackers} aggregateStats={aggregateStats} />

      {/* ── Divider ── */}
      <div
        className="h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${CHART_THEME.borderEmphasis}, transparent)` }}
      />

      {/* ── Tab Switcher ── */}
      <TabBar
        tabs={[
          { key: "tracker-stats" as const, label: "Tracker Stats" },
          { key: "torrent-fleet" as const, label: "Torrent Fleet" },
        ]}
        activeTab={dashboardTab}
        onChange={setDashboardTab}
      />

      {/* ── Section 5: Analytics / Fleet (conditional) ── */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        <div className="flex-1 min-w-0">
          {dashboardTab === "torrent-fleet" ? (
            <FleetDashboard
              dayRange={data.dayRange}
              trackers={data.trackers}
            />
          ) : (
            <AnalyticsSection trackerSeries={trackerSeries} trackers={data.trackers} />
          )}
        </div>

        {/* Sticky sidebar — shared by both tabs */}
        <DayRangeSidebar days={data.dayRange} onChange={data.setDayRange} accentColor={CHART_THEME.accent} />
      </div>

      {/* ── Settings Sheet ── */}
      <DashboardSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} dashSettings={dashSettings} />
    </div>
  )
}
