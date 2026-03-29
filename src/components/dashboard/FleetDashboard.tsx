// src/components/dashboard/FleetDashboard.tsx
"use client"

import { H2 } from "@typography"
import { useEffect, useRef, useState } from "react"
import { CrossSeedNetwork } from "@/components/charts/CrossSeedNetwork"
import { FleetAgeTimeline } from "@/components/charts/FleetAgeTimeline"
import { FleetCategoryBreakdown } from "@/components/charts/FleetCategoryBreakdown"
import { FleetCategoryTimeline } from "@/components/charts/FleetCategoryTimeline"
import { FleetCrossSeedDonut } from "@/components/charts/FleetCrossSeedDonut"
import { FleetSizeJitter } from "@/components/charts/FleetSizeJitter"
import { FleetSpeedSparklines } from "@/components/charts/FleetSpeedSparklines"
import { FleetStorageTreemap } from "@/components/charts/FleetStorageTreemap"
import { CHART_THEME } from "@/components/charts/lib/theme"
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
import {
  BoxIcon,
  ChevronUpIcon,
  DownloadArrowIcon,
  LeechingIcon,
  SeedingIcon,
  TagIcon,
  UploadArrowIcon,
} from "@/components/ui/Icons"
import { StatCard } from "@/components/ui/StatCard"
import type { FleetSnapshot, TrackerTag } from "@/lib/fleet"
import { computeFleetStats } from "@/lib/fleet"
import {
  formatBytesNum,
  formatCount,
  formatPercent,
  formatSpeed,
  splitValueUnit,
} from "@/lib/formatters"
import type { AggregatedTorrentsResponse, TorrentInfo } from "@/lib/torrent-utils"
import { mapTorrent } from "@/lib/torrent-utils"
import type { TrackerSummary } from "@/types/api"

interface FleetDashboardProps {
  dayRange: number
  trackers?: TrackerSummary[]
}

const allChartIds = FLEET_CHARTS.map((c) => c.id)

export function FleetDashboard({ dayRange, trackers: trackersProp }: FleetDashboardProps) {
  const [torrents, setTorrents] = useState<TorrentInfo[]>([])
  const [crossSeedTags, setCrossSeedTags] = useState<string[]>([])
  const [snapshots, setSnapshots] = useState<FleetSnapshot[]>([])
  const [trackerTags, setTrackerTags] = useState<TrackerTag[]>([])
  const [clientList, setClientList] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const chartPrefs = useFleetChartPreferences()
  const { hydrated: chartPrefsHydrated } = chartPrefs

  const prevDayRange = useRef<number | null>(null)
  const initialLoaded = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    const isFirstRun = !initialLoaded.current

    async function loadSnapshots() {
      const res = await fetch(`/api/fleet/snapshots?days=${dayRange === 0 ? 30 : dayRange}`, {
        signal,
      })
      if (res.ok) setSnapshots(await res.json())
    }

    async function loadInitial() {
      const [cachedRes, clientsRes, trackersRes] = await Promise.all([
        fetch("/api/fleet/torrents/cached", { signal }),
        fetch("/api/clients", { signal }),
        trackersProp ? Promise.resolve(null) : fetch("/api/trackers", { signal }),
      ])

      if (cachedRes.ok) {
        const data: AggregatedTorrentsResponse = await cachedRes.json()
        if (data.torrents.length > 0) {
          setTorrents(data.torrents.map(mapTorrent))
          setCrossSeedTags(data.crossSeedTags)
        }
      }

      if (clientsRes.ok) {
        const data: { id: number; name: string }[] = await clientsRes.json()
        setClientList(data)
      }

      if (trackersProp) {
        setTrackerTags(
          trackersProp
            .filter((t): t is typeof t & { qbtTag: string } => !!t.qbtTag?.trim())
            .map((t) => ({
              tag: t.qbtTag.trim(),
              name: t.name,
              color: t.color ?? CHART_THEME.accent,
            }))
        )
      } else if (trackersRes?.ok) {
        const data: { id: number; name: string; color: string; qbtTag: string | null }[] =
          await trackersRes.json()
        setTrackerTags(
          data
            .filter((t): t is typeof t & { qbtTag: string } => !!t.qbtTag?.trim())
            .map((t) => ({
              tag: t.qbtTag.trim(),
              name: t.name,
              color: t.color ?? CHART_THEME.accent,
            }))
        )
      }

      // Background: refresh torrents live (slow — hits qBT clients)
      try {
        const liveRes = await fetch("/api/fleet/torrents", { signal })
        if (liveRes.ok) {
          const data: AggregatedTorrentsResponse = await liveRes.json()
          setTorrents(data.torrents.map(mapTorrent))
          setCrossSeedTags(data.crossSeedTags)
        }
      } catch {
        // Live fetch failed. cached data stays visible
      }
    }

    const tasks = isFirstRun ? [loadInitial(), loadSnapshots()] : [loadSnapshots()]

    Promise.all(tasks)
      .catch(() => {})
      .finally(() => {
        if (isFirstRun) {
          initialLoaded.current = true
          setLoading(false)
        }
      })

    prevDayRange.current = dayRange
    return () => controller.abort()
  }, [dayRange, trackersProp])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-secondary text-sm font-mono animate-loading-breathe">
          Loading fleet data...
        </p>
      </div>
    )
  }

  if (torrents.length === 0 && snapshots.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center flex-col gap-2">
        <p className="text-secondary text-sm font-mono">No torrent data available.</p>
        <p className="text-tertiary text-xs font-mono">
          Make sure download clients are configured and trackers have qBT tags set.
        </p>
      </div>
    )
  }

  const stats = computeFleetStats(torrents, crossSeedTags)
  const uploadSpeedParts = splitValueUnit(formatSpeed(stats.fleetUploadSpeed))
  const downloadSpeedParts = splitValueUnit(formatSpeed(stats.fleetDownloadSpeed))
  const librarySizeParts = splitValueUnit(formatBytesNum(stats.totalLibrarySize))
  const hiddenCount =
    FLEET_CHARTS.length - FLEET_CHARTS.filter((c) => !chartPrefs.isHidden(c.id)).length

  function renderChart(id: string) {
    switch (id) {
      case "fleet-speed-sparklines":
        return clientList.length > 0 ? <FleetSpeedSparklines clients={clientList} /> : null
      case "speed-theme-river":
        return <SpeedThemeRiver snapshots={snapshots} />
      case "seeding-count-trends":
        return <TagCountTrends snapshots={snapshots} mode="seeding" />
      case "leeching-trends":
        return <TagCountTrends snapshots={snapshots} mode="leeching" />
      case "speed-history":
        return <SpeedHistoryChart snapshots={snapshots} />
      case "fleet-ratio-distribution":
        return <TorrentRatioDistribution torrents={torrents} />
      case "fleet-cross-seed-donut":
        return <FleetCrossSeedDonut torrents={torrents} crossSeedTags={crossSeedTags} />
      case "cross-seed-network":
        return (
          <CrossSeedNetwork
            torrents={torrents}
            trackerTags={trackerTags}
            crossSeedTags={crossSeedTags}
            height={400}
          />
        )
      case "tracker-health-radar":
        return <TrackerHealthRadar torrents={torrents} trackerTags={trackerTags} />
      case "fleet-activity-heatmap":
        return <TorrentActivityHeatmap torrents={torrents} />
      case "fleet-storage-treemap":
        return (
          <FleetStorageTreemap torrents={torrents} trackerTags={trackerTags.map((t) => t.tag)} />
        )
      case "fleet-seed-time-distribution":
        return <TorrentSeedTimeDistribution torrents={torrents} />
      case "fleet-age-timeline":
        return <FleetAgeTimeline torrents={torrents} trackerTags={trackerTags} />
      case "fleet-category-timeline":
        return <FleetCategoryTimeline torrents={torrents} />
      case "fleet-size-jitter":
        return <FleetSizeJitter torrents={torrents} trackerTags={trackerTags} height={360} />
      case "fleet-category-breakdown":
        return <FleetCategoryBreakdown torrents={torrents} trackerTags={trackerTags} height={360} />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Fleet Stat Cards */}
      {!chartPrefs.isHidden("fleet-stat-cards") && (
        <div className="flex flex-col gap-4">
          <H2>Fleet Overview</H2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
            <StatCard
              label="Seeding"
              value={formatCount(stats.totalSeeding)}
              icon={<SeedingIcon width="16" height="16" />}
            />
            <StatCard
              label="Leeching"
              value={formatCount(stats.totalLeeching)}
              icon={<LeechingIcon width="16" height="16" />}
            />
            <StatCard
              label="Upload"
              value={uploadSpeedParts.num}
              unit={uploadSpeedParts.unit}
              icon={<UploadArrowIcon width="16" height="16" />}
            />
            <StatCard
              label="Download"
              value={downloadSpeedParts.num}
              unit={downloadSpeedParts.unit}
              icon={<DownloadArrowIcon width="16" height="16" />}
            />
            <StatCard
              label="Library"
              value={librarySizeParts.num}
              unit={librarySizeParts.unit}
              icon={<BoxIcon width="16" height="16" />}
            />
            <StatCard
              label="Cross-Seed"
              value={formatPercent(stats.crossSeedPercent)}
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
