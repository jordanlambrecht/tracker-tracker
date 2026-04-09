// src/components/dashboard/FleetDashboard.tsx
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { H2 } from "@typography"
import { useCallback } from "react"
import { CrossSeedNetwork } from "@/components/charts/CrossSeedNetwork"
import { FleetAgeBandHeatmap } from "@/components/charts/FleetAgeBandHeatmap"
import { FleetAgeTimeline } from "@/components/charts/FleetAgeTimeline"
import { FleetCategoryBreakdown } from "@/components/charts/FleetCategoryBreakdown"
import { FleetCategoryTimeline } from "@/components/charts/FleetCategoryTimeline"
import { FleetCrossSeedDonut } from "@/components/charts/FleetCrossSeedDonut"
import { FleetSizeJitter } from "@/components/charts/FleetSizeJitter"
import { FleetSpeedSparklines } from "@/components/charts/FleetSpeedSparklines"
import { FleetStorageTreemap } from "@/components/charts/FleetStorageTreemap"
import { SpeedHistoryChart } from "@/components/charts/SpeedHistoryChart"
import { SpeedThemeRiver } from "@/components/charts/SpeedThemeRiver"
import { TagCountTrends } from "@/components/charts/TagCountTrends"
import { TorrentActivityHeatmap } from "@/components/charts/TorrentActivityHeatmap"
import { TorrentRatioDistribution } from "@/components/charts/TorrentRatioDistribution"
import { TorrentSeedTimeDistribution } from "@/components/charts/TorrentSeedTimeDistribution"
import { TrackerHealthRadar } from "@/components/charts/TrackerHealthRadar"
import { ChartCard } from "@/components/dashboard/ChartCard"
import {
  FLEET_CHARTS,
  useFleetChartPreferences,
} from "@/components/dashboard/useFleetChartPreferences"
import { Button } from "@/components/ui"
import {
  BoxIcon,
  ChevronUpIcon,
  DownloadArrowIcon,
  LeechingIcon,
  RefreshIcon,
  SeedingIcon,
  TagIcon,
  UploadArrowIcon,
} from "@/components/ui/Icons"
import { StatCard } from "@/components/ui/StatCard"
import { ChartGridSkeleton } from "@/components/ui/skeletons"
import { usePollingIntervals } from "@/hooks/usePollingIntervals"
import type { FleetSnapshot } from "@/lib/fleet"
import type { FleetAggregation } from "@/lib/fleet-aggregation"
import {
  formatBytesNum,
  formatCount,
  formatPercent,
  formatSpeed,
  splitValueUnit,
} from "@/lib/formatters"

interface FleetDashboardProps {
  dayRange: number
  isActive?: boolean
}

const allChartIds = FLEET_CHARTS.map((c) => c.id)

// Stable select: narrows ["clients"] cache to {id, name} so lastPolledAt
// changes from the sidebar's 10s poll don't trigger re-renders here.
const selectClientIdName = (data: { id: number; name: string }[]) =>
  data.map(({ id, name }) => ({ id, name }))

export function FleetDashboard({ dayRange, isActive = true }: FleetDashboardProps) {
  const chartPrefs = useFleetChartPreferences()
  const { hydrated: chartPrefsHydrated } = chartPrefs
  const intervals = usePollingIntervals()

  const effectiveDays = dayRange === 0 ? 30 : dayRange

  const { data: snapshots = [] } = useQuery({
    queryKey: ["download-client-snapshots", effectiveDays],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/fleet/snapshots?days=${effectiveDays}`, { signal })
      if (!res.ok) throw new Error(`Fleet snapshots failed: ${res.status}`)
      return res.json() as Promise<FleetSnapshot[]>
    },
    enabled: isActive,
  })

  // Fast: DB-cached torrent aggregation
  const { data: aggregation, isFetching: fleetFetching } = useQuery({
    queryKey: ["fleet-torrents-cached"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/fleet/torrents/cached", { signal })
      if (!res.ok) throw new Error(`Fleet data failed: ${res.status}`)
      return res.json() as Promise<FleetAggregation>
    },
    staleTime: intervals.clientRefetchMs,
    enabled: isActive,
  })

  const queryClient = useQueryClient()

  const handleRefreshFleet = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["fleet-torrents-cached"] })
  }, [queryClient])

  const { data: clientList = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/clients", { signal })
      if (!res.ok) throw new Error(`Client list failed: ${res.status}`)
      return res.json() as Promise<{ id: number; name: string }[]>
    },
    // Sidebar's 10s poll keeps this cache fresh. select narrows to {id, name}
    // so lastPolledAt/updatedAt changes don't trigger re-renders.
    staleTime: intervals.clientRefetchMs,
    select: selectClientIdName,
  })

  const loading = !aggregation && !snapshots.length

  if (loading) {
    return <ChartGridSkeleton count={4} columns={1} chartHeight="h-[360px]" />
  }

  if (aggregation && aggregation.stats.torrentCount === 0 && snapshots.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center flex-col gap-2">
        <p className="text-secondary text-sm font-mono">No torrent data available.</p>
        <p className="text-tertiary text-xs font-mono">
          Make sure download clients are configured and trackers have qBT tags set.
        </p>
      </div>
    )
  }

  // aggregation may still be null here if only snapshots are available.
  // Stat cards and aggregation-based charts guard on aggregation below
  const uploadSpeedParts = aggregation
    ? splitValueUnit(formatSpeed(aggregation.stats.fleetUploadSpeed))
    : null
  const downloadSpeedParts = aggregation
    ? splitValueUnit(formatSpeed(aggregation.stats.fleetDownloadSpeed))
    : null
  const librarySizeParts = aggregation
    ? splitValueUnit(formatBytesNum(aggregation.stats.totalLibrarySize))
    : null

  const hiddenCount =
    FLEET_CHARTS.length - FLEET_CHARTS.filter((c) => !chartPrefs.isHidden(c.id)).length

  function renderChart(id: string) {
    switch (id) {
      case "fleet-speed-sparklines":
        return clientList.length > 0 ? (
          <FleetSpeedSparklines clients={clientList} isActive={isActive} />
        ) : null
      case "speed-theme-river":
        return <SpeedThemeRiver snapshots={snapshots} />
      case "seeding-count-trends":
        return <TagCountTrends snapshots={snapshots} mode="seeding" />
      case "leeching-trends":
        return <TagCountTrends snapshots={snapshots} mode="leeching" />
      case "speed-history":
        return <SpeedHistoryChart snapshots={snapshots} />
      case "fleet-ratio-distribution":
        return aggregation ? (
          <TorrentRatioDistribution buckets={aggregation.ratioDistribution} />
        ) : null
      case "fleet-cross-seed-donut":
        return aggregation ? (
          <FleetCrossSeedDonut
            crossSeeded={aggregation.crossSeed.crossSeeded}
            unique={aggregation.crossSeed.unique}
            total={aggregation.crossSeed.total}
          />
        ) : null
      case "cross-seed-network":
        return aggregation ? (
          <CrossSeedNetwork network={aggregation.crossSeedNetwork} height={400} />
        ) : null
      case "tracker-health-radar":
        return aggregation ? <TrackerHealthRadar metrics={aggregation.trackerHealth} /> : null
      case "fleet-activity-heatmap":
        return aggregation ? <TorrentActivityHeatmap grid={aggregation.activityGrid} /> : null
      case "fleet-storage-treemap":
        return aggregation ? (
          <FleetStorageTreemap data={aggregation.storageByTrackerCategory} />
        ) : null
      case "fleet-seed-time-distribution":
        return aggregation ? (
          <TorrentSeedTimeDistribution buckets={aggregation.seedTimeDistribution} />
        ) : null
      case "fleet-age-bands":
        return aggregation ? <FleetAgeBandHeatmap data={aggregation.ageBands} /> : null
      case "fleet-age-timeline":
        return aggregation ? <FleetAgeTimeline data={aggregation.ageTimeline} /> : null
      case "fleet-category-timeline":
        return aggregation ? <FleetCategoryTimeline data={aggregation.categoryTimeline} /> : null
      case "fleet-size-jitter":
        return aggregation ? (
          <FleetSizeJitter data={aggregation.sizesByTracker} height={360} />
        ) : null
      case "fleet-category-breakdown":
        return aggregation ? (
          <FleetCategoryBreakdown data={aggregation.categoryBreakdown} height={360} />
        ) : null
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Fleet Stat Cards */}
      {!chartPrefs.isHidden("fleet-stat-cards") && aggregation && (
        <div className="flex flex-col gap-4">
          <H2>Fleet Overview</H2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
            <StatCard
              label="Seeding"
              value={formatCount(aggregation.stats.totalSeeding)}
              icon={<SeedingIcon width="16" height="16" />}
            />
            <StatCard
              label="Leeching"
              value={formatCount(aggregation.stats.totalLeeching)}
              icon={<LeechingIcon width="16" height="16" />}
            />
            <StatCard
              label="Upload"
              value={uploadSpeedParts?.num ?? "—"}
              unit={uploadSpeedParts?.unit}
              icon={<UploadArrowIcon width="16" height="16" />}
            />
            <StatCard
              label="Download"
              value={downloadSpeedParts?.num ?? "—"}
              unit={downloadSpeedParts?.unit}
              icon={<DownloadArrowIcon width="16" height="16" />}
            />
            <StatCard
              label="Library"
              value={librarySizeParts?.num ?? "—"}
              unit={librarySizeParts?.unit}
              icon={<BoxIcon width="16" height="16" />}
            />
            <StatCard
              label="Cross-Seed"
              value={formatPercent(aggregation.stats.crossSeedPercent)}
              icon={<TagIcon width="16" height="16" />}
            />
          </div>
        </div>
      )}

      {/* Chart Cards */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <H2>Fleet Analytics</H2>
            {hiddenCount > 0 && <span className="timestamp">{hiddenCount} hidden</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefreshFleet}
              disabled={fleetFetching}
              aria-label="Refresh fleet data"
            >
              <RefreshIcon
                width="14"
                height="14"
                className={fleetFetching ? "animate-spin" : undefined}
              />
              {fleetFetching ? "Refreshing…" : "Refresh"}
            </Button>
            <button
              type="button"
              onClick={() => chartPrefs.collapseAll(allChartIds)}
              className="timestamp flex items-center gap-2 px-2.5 py-1 hover:text-secondary nm-interactive-inset cursor-pointer rounded-nm-sm"
            >
              <ChevronUpIcon
                width="12"
                height="12"
                className="transition-transform duration-200"
                style={{
                  transform: chartPrefs.allVisibleCollapsed(allChartIds)
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                }}
              />
              {chartPrefs.allVisibleCollapsed(allChartIds) ? "Expand All" : "Collapse All"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {FLEET_CHARTS.filter((def) => def.id !== "fleet-stat-cards").map((def) => {
            if (chartPrefs.isHidden(def.id)) return null
            return (
              <ChartCard
                key={def.id}
                title={def.label}
                description={def.description}
                collapsed={!chartPrefsHydrated || chartPrefs.isCollapsed(def.id)}
                onToggleCollapse={() => chartPrefs.toggleCollapsed(def.id)}
                onHide={() => chartPrefs.toggleHidden(def.id)}
              >
                {renderChart(def.id)}
              </ChartCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}
