"use client"

// src/app/(auth)/page.tsx
//
// Functions: buildTrackerSeries, SortableChartItem, renderChart, handleDismiss, DashboardPage

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useCallback, useEffect, useState } from "react"
import { BufferCandlestickChart } from "@/components/charts/BufferCandlestickChart"
import { BufferVelocityChart } from "@/components/charts/BufferVelocityChart"
import type { TrackerSeries } from "@/components/charts/ComparisonChart"
import { ComparisonChart } from "@/components/charts/ComparisonChart"
import { DailyVolumeChart } from "@/components/charts/DailyVolumeChart"
import { DistributionChart } from "@/components/charts/DistributionChart"
import { FleetCompositionChart } from "@/components/charts/FleetCompositionChart"
import { RankTenureChart } from "@/components/charts/RankTenureChart"
import { RatioStabilityChart } from "@/components/charts/RatioStabilityChart"
import { SeedbonusRiverChart } from "@/components/charts/SeedbonusRiverChart"
import { TrackerBubbleChart } from "@/components/charts/TrackerBubbleChart"
import { VolumeSurface3D } from "@/components/charts/VolumeSurface3D"
import { AlertsBanner } from "@/components/dashboard/AlertsBanner"
import { ChartCard } from "@/components/dashboard/ChartCard"
import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import { DayRangeSidebar } from "@/components/dashboard/DayRangeSidebar"
import { FleetDashboard } from "@/components/dashboard/FleetDashboard"
import { PollAllButton } from "@/components/dashboard/PollAllButton"
import { TrackerLeaderboard } from "@/components/dashboard/TrackerLeaderboard"
import { TrackerOverviewGrid } from "@/components/dashboard/TrackerOverviewGrid"
import type { ChartDef } from "@/components/dashboard/useChartPreferences"
import { DASHBOARD_CHARTS, useChartPreferences } from "@/components/dashboard/useChartPreferences"
import { useDashboardSettings } from "@/components/dashboard/useDashboardSettings"
import { Button } from "@/components/ui/Button"
import {
  ChevronUpIcon,
  DownloadArrowIcon,
  GearIcon,
  GridIcon,
  LeechingIcon,
  RatioIcon,
  SeedingIcon,
  ShieldIcon,
  UploadArrowIcon,
} from "@/components/ui/Icons"
import { Sheet } from "@/components/ui/Sheet"
import { StatCard } from "@/components/ui/StatCard"
import { TabBar } from "@/components/ui/TabBar"
import { Toggle } from "@/components/ui/Toggle"
import { H1, H2 } from "@/components/ui/Typography"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import type { DashboardAlert } from "@/lib/dashboard"
import {
  computeAggregateStats,
  computeAlerts,
  detectRankChanges,
  dismissAlert,
  getDismissedAlerts,
} from "@/lib/dashboard"
import { formatBytesFromString, formatRatio } from "@/lib/formatters"
import type { Snapshot, TrackerSummary } from "@/types/api"


const AGGREGATE_ICONS: Record<string, React.ReactNode> = {
  trackers: <GridIcon width="16" height="16" />,
  uploaded: <UploadArrowIcon width="16" height="16" />,
  downloaded: <DownloadArrowIcon width="16" height="16" />,
  buffer: <ShieldIcon width="16" height="16" />,
  ratio: <RatioIcon width="16" height="16" />,
  seeding: <SeedingIcon width="16" height="16" />,
  leeching: <LeechingIcon width="16" height="16" />,
}

function buildTrackerSeries(
  trackers: TrackerSummary[],
  snapshotMap: Map<number, Snapshot[]>
): TrackerSeries[] {
  return trackers.map((t) => ({
    name: t.name,
    color: t.color,
    snapshots: snapshotMap.get(t.id) ?? [],
  }))
}

interface SortableChartItemProps {
  def: ChartDef
  isHidden: boolean
  onToggle: (visible: boolean) => void
}

function SortableChartItem({ def, isHidden, onToggle }: SortableChartItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: def.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-2 px-3 nm-raised-sm rounded-nm-md bg-elevated"
    >
      <button
        type="button"
        className="text-muted hover:text-secondary cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <Toggle
        label={def.label}
        checked={!isHidden}
        onChange={onToggle}
      />
    </div>
  )
}

export default function DashboardPage() {
  const [trackers, setTrackers] = useState<TrackerSummary[]>([])
  const [snapshotMap, setSnapshotMap] = useState<Map<number, Snapshot[]>>(new Map())
  const [dayRange, setDayRange] = useState<DayRange>(30)
  const [loading, setLoading] = useState(true)
  const [visibleAlerts, setVisibleAlerts] = useState<DashboardAlert[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chartSettingsTab, setChartSettingsTab] = useState<"analytics" | "torrents">("analytics")
  const [dashboardTab, setDashboardTab] = useState<"tracker-stats" | "torrent-fleet">("tracker-stats")

  const chartPrefs = useChartPreferences()
  const dashSettings = useDashboardSettings()
  const allChartIds = DASHBOARD_CHARTS.filter((c) => c.category === "analytics").map((c) => c.id)

  const loadData = useCallback(async () => {
    try {
      const trackersRes = await fetch("/api/trackers")
      if (!trackersRes.ok) return

      const fetchedTrackers: TrackerSummary[] = await trackersRes.json()

      const snapshotEntries = await Promise.all(
        fetchedTrackers.map(async (t) => {
          try {
            const url =
              dayRange === 0
                ? `/api/trackers/${t.id}/snapshots`
                : `/api/trackers/${t.id}/snapshots?days=${dayRange}`
            const res = await fetch(url)
            if (!res.ok) return [t.id, []] as [number, Snapshot[]]
            const snaps: Snapshot[] = await res.json()
            return [t.id, snaps] as [number, Snapshot[]]
          } catch {
            return [t.id, []] as [number, Snapshot[]]
          }
        })
      )

      const newMap = new Map<number, Snapshot[]>(snapshotEntries)

      setTrackers(fetchedTrackers)
      setSnapshotMap(newMap)

      const allAlerts = computeAlerts(fetchedTrackers, TRACKER_REGISTRY)
      const rankAlerts = detectRankChanges(fetchedTrackers, newMap, 7)
      const combined = [...allAlerts, ...rankAlerts]
      const dismissed = getDismissedAlerts()
      setVisibleAlerts(combined.filter((a) => !dismissed.has(a.key)))
    } catch {
      // silently ignore fetch errors; stale state stays visible
    } finally {
      setLoading(false)
    }
  }, [dayRange])

  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      loadData()
    }, 60_000)
    return () => clearInterval(interval)
  }, [loadData])

  function handleDismiss(key: string) {
    dismissAlert(key)
    setVisibleAlerts((prev) => prev.filter((a) => a.key !== key))
  }

  function handleChartDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const currentOrder = chartPrefs.orderedCharts(chartSettingsTab).map((c) => c.id)
    const oldIndex = currentOrder.indexOf(active.id as string)
    const newIndex = currentOrder.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const otherCategory = chartSettingsTab === "analytics" ? "torrents" : "analytics"
    const otherOrder = chartPrefs.orderedCharts(otherCategory).map((c) => c.id)
    const reordered = arrayMove(currentOrder, oldIndex, newIndex)
    chartPrefs.reorder([...reordered, ...otherOrder])
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-secondary text-sm font-mono">Loading dashboard...</p>
      </div>
    )
  }

  if (trackers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-secondary text-sm font-mono">No trackers added yet</p>
      </div>
    )
  }

  const aggregateStats = computeAggregateStats(trackers)
  const trackerSeries = buildTrackerSeries(trackers, snapshotMap)

  function renderChart(id: string) {
    switch (id) {
      case "daily-volume":
        return <DailyVolumeChart trackerData={trackerSeries} height={360} />
      case "upload-landscape":
        return <VolumeSurface3D trackerData={trackerSeries} height={420} />
      case "distribution":
        return (
          <DistributionChart
            trackers={trackers.map((t) => ({
              name: t.name,
              color: t.color,
              uploadedBytes: t.latestStats?.uploadedBytes ?? null,
              seedingCount: t.latestStats?.seedingCount ?? null,
            }))}
          />
        )
      case "comparison-uploaded":
        return <ComparisonChart metric="uploaded" trackerData={trackerSeries} height={320} />
      case "comparison-ratio":
        return <ComparisonChart metric="ratio" trackerData={trackerSeries} height={320} enableLogScale enableAverage />
      case "comparison-buffer":
        return <ComparisonChart metric="buffer" trackerData={trackerSeries} height={320} />
      case "comparison-seedbonus":
        return <ComparisonChart metric="seedbonus" trackerData={trackerSeries} height={320} />
      case "comparison-active":
        return <ComparisonChart metric="active" trackerData={trackerSeries} height={320} />
      case "ratio-stability":
        return <RatioStabilityChart trackerData={trackerSeries} height={360} />
      case "fleet-composition":
        return <FleetCompositionChart trackerData={trackerSeries} height={360} />
      case "rank-tenure":
        return <RankTenureChart trackerData={trackerSeries} height={300} />
      case "buffer-velocity":
        return <BufferVelocityChart trackerData={trackerSeries} height={320} />
      case "buffer-candlestick":
        return <BufferCandlestickChart trackerData={trackerSeries} height={360} />
      case "tracker-landscape":
        return (
          <TrackerBubbleChart
            trackers={trackers.map((t) => ({
              name: t.name,
              color: t.color,
              uploadedBytes: t.latestStats?.uploadedBytes ?? null,
              downloadedBytes: t.latestStats?.downloadedBytes ?? null,
              seedingCount: t.latestStats?.seedingCount ?? null,
            }))}
            height={360}
          />
        )
      case "seedbonus-flow":
        return <SeedbonusRiverChart trackerData={trackerSeries} height={320} />
      default:
        return null
    }
  }

  const analyticsCharts = chartPrefs.orderedCharts("analytics")
  const visibleChartCount = analyticsCharts.filter((c) => !chartPrefs.isHidden(c.id)).length
  const hiddenChartCount = analyticsCharts.length - visibleChartCount

  return (
    <div className="flex flex-col gap-10 max-w-6xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <H1>Dashboard</H1>
        <div className="flex items-center gap-2">
          <PollAllButton onPollComplete={loadData} />
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
        <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">
          Trackers
        </p>
        <TrackerOverviewGrid trackers={trackers} showHealthIndicators={dashSettings.settings.showHealthIndicators} />
      </div>

      {/* ── Section 2: Alerts ── */}
      {visibleAlerts.length > 0 && (
        <AlertsBanner alerts={visibleAlerts} onDismiss={handleDismiss} />
      )}

      {/* ── Section 3: Leaderboard ── */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">
          Leaderboard
        </p>
        <TrackerLeaderboard trackers={trackers} />
      </div>

      {/* ── Divider ── */}
      <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.12), transparent)" }} />

      {/* ── Section 4: Ecosystem (Aggregate Stats) ── */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">
          Ecosystem
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
          <StatCard
            label="Trackers"
            value={trackers.length.toString()}
            icon={AGGREGATE_ICONS.trackers}
          />
          <StatCard
            label="Total Uploaded"
            value={formatBytesFromString(aggregateStats.totalUploaded)}
            icon={AGGREGATE_ICONS.uploaded}
          />
          <StatCard
            label="Total Downloaded"
            value={formatBytesFromString(aggregateStats.totalDownloaded)}
            icon={AGGREGATE_ICONS.downloaded}
          />
          <StatCard
            label="Total Buffer"
            value={formatBytesFromString(aggregateStats.totalBuffer)}
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

      {/* ── Divider ── */}
      <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.12), transparent)" }} />

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
            <FleetDashboard dayRange={dayRange} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-sans font-medium text-tertiary uppercase tracking-wider">
                    Analytics
                  </p>
                  {hiddenChartCount > 0 && (
                    <span className="text-[10px] font-mono text-muted">
                      {hiddenChartCount} hidden
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => chartPrefs.collapseAll(allChartIds)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono text-muted hover:text-secondary transition-colors cursor-pointer rounded-nm-sm"
                >
                  <ChevronUpIcon
                    width="12"
                    height="12"
                    className="transition-transform duration-200"
                    style={{
                      transform: chartPrefs.allVisibleCollapsed(allChartIds) ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                  {chartPrefs.allVisibleCollapsed(allChartIds) ? "Expand All" : "Collapse All"}
                </button>
              </div>

              <div className="flex flex-col gap-6">
                {analyticsCharts.map((def) => {
                  if (chartPrefs.isHidden(def.id)) return null
                  return (
                    <ChartCard
                      key={def.id}
                      title={def.label}
                      description={def.description}
                      collapsed={chartPrefs.isCollapsed(def.id)}
                      onToggleCollapse={() => chartPrefs.toggleCollapsed(def.id)}
                      onHide={() => chartPrefs.toggleHidden(def.id)}
                    >
                      {renderChart(def.id)}
                    </ChartCard>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky sidebar — shared by both tabs */}
        <DayRangeSidebar days={dayRange} onChange={setDayRange} accentColor="#00d4ff" />
      </div>

      {/* ── Settings Sheet ── */}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Dashboard Settings">
        <div className="p-6 flex flex-col gap-8">
          {/* Trackers */}
          <div className="flex flex-col gap-4">
            <H2>Trackers</H2>
            <Toggle
              label="Show health indicators"
              description="Display the breathing pulse dot on each tracker card showing connection status."
              checked={dashSettings.settings.showHealthIndicators}
              onChange={(checked) => dashSettings.update("showHealthIndicators", checked)}
            />
          </div>

          <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.12), transparent)" }} />

          {/* Chart Visibility & Order */}
          <div className="flex flex-col gap-4">
            <H2>Charts</H2>
            <TabBar
              tabs={[
                { key: "analytics" as const, label: "Analytics" },
                { key: "torrents" as const, label: "Torrents" },
              ]}
              activeTab={chartSettingsTab}
              onChange={setChartSettingsTab}
            />
            <p className="text-xs font-sans text-tertiary">
              {chartSettingsTab === "analytics"
                ? "Toggle visibility and drag to reorder analytics charts."
                : "Toggle visibility and drag to reorder torrent charts."}
            </p>
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleChartDragEnd}
            >
              <SortableContext
                items={chartPrefs.orderedCharts(chartSettingsTab).map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {chartPrefs.orderedCharts(chartSettingsTab).map((def) => (
                    <SortableChartItem
                      key={def.id}
                      def={def}
                      isHidden={chartPrefs.isHidden(def.id)}
                      onToggle={(visible) => chartPrefs.setVisible(def.id, visible)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
