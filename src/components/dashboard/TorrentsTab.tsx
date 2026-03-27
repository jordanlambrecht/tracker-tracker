// src/components/dashboard/TorrentsTab.tsx

"use client"

import { H2 } from "@typography"
import { type ReactNode, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { ParallelTorrentsChart } from "@/components/charts/ParallelTorrentsChart"
import { StorageSunburst } from "@/components/charts/StorageSunburst"
import {
  numbersNeedsWideCard,
  TagGroupBreakdownChart,
} from "@/components/charts/TagGroupBreakdownChart"
import { TorrentActivityHeatmap } from "@/components/charts/TorrentActivityHeatmap"
import { TorrentAgeTimeline } from "@/components/charts/TorrentAgeTimeline"
import { TorrentAvgSeedTime } from "@/components/charts/TorrentAvgSeedTime"
import { TorrentCategoryAcquisition } from "@/components/charts/TorrentCategoryAcquisition"
import { TorrentCrossSeedDonut } from "@/components/charts/TorrentCrossSeedDonut"
import { TorrentRatioDistribution } from "@/components/charts/TorrentRatioDistribution"
import { TorrentSeedTimeDistribution } from "@/components/charts/TorrentSeedTimeDistribution"
import { TorrentSizeBreakdown } from "@/components/charts/TorrentSizeBreakdown"
import {
  ActiveTransfersTable,
  CategoryCard,
  NoClientState,
  NoTagState,
  TorrentRankingTable,
  TorrentStatCards,
  UnsatisfiedTorrentsTable,
} from "@/components/dashboard/torrents"
import { Card } from "@/components/ui/Card"
import type { TrackerTorrentsData } from "@/hooks/useTrackerTorrents"
import { formatBytesNum, formatTimeAgo } from "@/lib/formatters"

const TorrentAgeScatter3D = dynamic(
  () => import("@/components/charts/TorrentAgeScatter3D").then((m) => m.TorrentAgeScatter3D),
  { ssr: false }
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TorrentsTabProps {
  trackerName?: string
  qbtTag: string | null
  accentColor: string
  data: TrackerTorrentsData
  trackerSeedingCount?: number | null
}

// ---------------------------------------------------------------------------
// Lazy section — mounts children only when scrolled into view
// ---------------------------------------------------------------------------

function LazySection({ children, minHeight = 200 }: { children: ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? children : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TorrentsTab({
  trackerName,
  qbtTag,
  accentColor,
  data,
  trackerSeedingCount,
}: TorrentsTabProps) {
  const [staleDismissed, setStaleDismissed] = useState(false)

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted font-mono">Loading...</p>
      </div>
    )
  }

  if (data.noClients) return <NoClientState />
  if (!qbtTag) return <NoTagState trackerName={trackerName ?? "this tracker"} />

  return (
    <div className="flex flex-col gap-8">
      {/* Error banner */}
      {data.torrentError && (
        <div className="px-4 py-3 text-xs font-mono text-warn nm-inset-sm bg-warn-dim rounded-nm-md">
          {data.torrentError}
        </div>
      )}

      {/* Stale data banner — dismissible, reappears on next mount */}
      {data.stale && data.cachedAt && !staleDismissed && (
        <div className="px-4 py-3 text-xs font-mono text-secondary nm-inset-sm rounded-nm-md flex items-center gap-2">
          <span className="text-warn">●</span>
          <span className="flex-1">
            Showing cached data from {formatTimeAgo(data.cachedAt)} — client offline
          </span>
          <button
            type="button"
            onClick={() => setStaleDismissed(true)}
            className="text-muted hover:text-secondary transition-colors text-sm leading-none"
            aria-label="Dismiss stale data banner"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Transfers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3 min-w-0 [&>*:last-child]:flex-1">
          <H2 className="text-xs font-sans font-medium text-secondary uppercase tracking-wider flex items-center gap-2">
            {data.activelyDownloading.length > 0 && (
              <span className="inline-block w-2 h-2 rounded-full bg-warn animate-pulse" />
            )}
            Active Downloads ({data.activelyDownloading.length})
            {data.activelyDownloading.length > 0 && (
              <span className="font-mono text-warn ml-auto mr-2 text-2xs normal-case tracking-normal">
                {formatBytesNum(data.activelyDownloading.reduce((s, t) => s + t.dlspeed, 0))}/s
              </span>
            )}
          </H2>
          <ActiveTransfersTable
            torrents={data.activelyDownloading}
            mode="downloading"
            accentColor={accentColor}
            showClientName={data.clientCount > 1}
          />
        </div>
        <div className="flex flex-col gap-3 min-w-0 [&>*:last-child]:flex-1">
          <H2 className="text-xs font-sans font-medium text-secondary uppercase tracking-wider flex items-center gap-2">
            {data.activelySeedingTorrents.length > 0 && (
              <span
                className="inline-block w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: accentColor }}
              />
            )}
            Active Uploads ({data.activelySeedingTorrents.length})
            {data.activelySeedingTorrents.length > 0 && (
              <span className="font-mono text-accent ml-auto mr-2 text-2xs normal-case tracking-normal">
                {formatBytesNum(data.activelySeedingTorrents.reduce((s, t) => s + t.upspeed, 0))}/s
              </span>
            )}
          </H2>
          <ActiveTransfersTable
            torrents={data.activelySeedingTorrents}
            mode="uploading"
            accentColor={accentColor}
            showClientName={data.clientCount > 1}
          />
        </div>
      </div>

      {/* Stat Cards */}
      <TorrentStatCards
        torrents={data.torrents}
        seedingTorrents={data.seedingTorrents}
        totalSize={data.totalSize}
        crossSeededCount={data.crossSeeded.length}
        deadCount={data.deadCount}
        trackerSeedingCount={trackerSeedingCount ?? null}
        unsatisfiedCount={data.unsatisfiedCount}
        hnrRiskCount={data.hnrRiskCount}
        accentColor={accentColor}
        clientCount={data.clientCount}
      />

      {/* Category + Cross-Seed */}
      <LazySection minHeight={350}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CategoryCard categories={data.categoryStats} accentColor={accentColor} />
          <Card trackerColor={accentColor} className="flex flex-col gap-4" title="Cross-Seed Ratio">
            {data.crossSeedTags.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <p className="text-xs font-mono text-tertiary text-center">
                  No cross-seed tags configured.
                  <br />
                  Set them in Settings → Download Clients.
                </p>
              </div>
            ) : (
              <TorrentCrossSeedDonut
                crossSeeded={data.crossSeeded.length}
                unique={data.torrents.length - data.crossSeeded.length}
                accentColor={accentColor}
              />
            )}
          </Card>
        </div>
      </LazySection>

      {/* Tag Group Breakdowns */}
      {data.tagGroupBreakdowns.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {data.tagGroupBreakdowns.map(({ group, memberCounts, unmatchedCount }) => {
            const wideCard =
              group.chartType === "numbers" &&
              numbersNeedsWideCard(memberCounts.length, group.countUnmatched, unmatchedCount)
            return (
              <Card
                key={group.id}
                trackerColor={accentColor}
                className={`flex flex-col gap-4${wideCard ? " lg:col-span-2" : ""}`}
              >
                <H2 className="card-heading">
                  {group.emoji ? `${group.emoji} ` : ""}
                  {group.name}
                </H2>
                <TagGroupBreakdownChart
                  groupName={group.name}
                  members={memberCounts}
                  accentColor={accentColor}
                  chartType={group.chartType}
                  countUnmatched={group.countUnmatched}
                  unmatchedCount={unmatchedCount}
                />
              </Card>
            )
          })}
        </div>
      )}

      {/* qbitmanage Breakdown */}
      {data.qbitmanageBreakdown.length > 0 && (
        <Card trackerColor={accentColor} className="flex flex-col gap-4" title="qbitmanage Status">
          <TagGroupBreakdownChart
            groupName="qbitmanage Status"
            members={data.qbitmanageBreakdown}
            accentColor={accentColor}
          />
        </Card>
      )}

      {/* Ratio + Seed Time Distribution */}
      <LazySection minHeight={300}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card trackerColor={accentColor} className="flex flex-col gap-4" title="Ratio Distribution">
            <TorrentRatioDistribution torrents={data.torrents} accentColor={accentColor} />
          </Card>
          <Card trackerColor={accentColor} className="flex flex-col gap-4" title="Seed Time Distribution">
            <TorrentSeedTimeDistribution
              torrents={data.torrents}
              seedTimeHours={
                data.requiredSeedSeconds != null ? data.requiredSeedSeconds / 3600 : null
              }
              accentColor={accentColor}
            />
          </Card>
        </div>
      </LazySection>

      {/* Size Breakdown + Activity Heatmap */}
      <LazySection minHeight={300}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card trackerColor={accentColor} className="flex flex-col gap-4" title="Size by Category">
            <TorrentSizeBreakdown categories={data.categoryStats} accentColor={accentColor} />
          </Card>
          <Card trackerColor={accentColor} className="flex flex-col gap-4" title="Torrent Add Heatmap">
            <TorrentActivityHeatmap torrents={data.torrents} accentColor={accentColor} />
          </Card>
        </div>
      </LazySection>

      {/* Library Growth */}
      <LazySection>
        <Card trackerColor={accentColor} className="flex flex-col gap-4" title="Library Growth">
          <TorrentAgeTimeline torrents={data.torrents} accentColor={accentColor} />
        </Card>
      </LazySection>

      {/* Category Acquisition */}
      <LazySection>
        <Card trackerColor={accentColor} className="flex flex-col gap-4">
          <H2>Torrents Added by Category</H2>
          <p className="text-xs font-mono text-tertiary">
            Monthly acquisition by category — shows what you've been grabbing
          </p>
          <TorrentCategoryAcquisition torrents={data.torrents} accentColor={accentColor} />
        </Card>
      </LazySection>

      {/* Avg Seed Time by Cohort */}
      <LazySection>
        <Card trackerColor={accentColor} className="flex flex-col gap-4">
          <H2>Average Seed Time by Cohort</H2>
          <TorrentAvgSeedTime torrents={data.torrents} accentColor={accentColor} />
        </Card>
      </LazySection>

      {/* 3D Scatter */}
      <LazySection minHeight={400}>
        <Card trackerColor={accentColor} className="flex flex-col gap-4">
          <H2>Torrent Library — 3D Scatter</H2>
          <TorrentAgeScatter3D torrents={data.torrents} accentColor={accentColor} />
        </Card>
      </LazySection>

      {/* Unsatisfied Torrents */}
      {data.requiredSeedSeconds && (
        <div className="flex flex-col gap-3">
          <H2 className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
            Unsatisfied Torrents ({data.unsatisfiedSorted.length})
          </H2>
          <UnsatisfiedTorrentsTable
            torrents={data.unsatisfiedSorted}
            requiredSeconds={data.requiredSeedSeconds}
            accentColor={accentColor}
          />
        </div>
      )}

      {/* Top Seeded */}
      <div className="flex flex-col gap-3">
        <H2 className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
          Top Seeded Torrents
        </H2>
        <TorrentRankingTable variant="top-seeded" torrents={data.topBySeeding} />
      </div>

      {/* Parallel Coordinates */}
      <LazySection minHeight={380}>
        <Card trackerColor={accentColor} className="flex flex-col gap-4" title="Torrent Profile">
          <p className="text-xs font-mono text-tertiary -mt-2">
            Each line is a torrent — hover to inspect, brush axes to filter
          </p>
          <ParallelTorrentsChart torrents={data.torrents} trackerColor={accentColor} height={380} />
        </Card>
      </LazySection>

      {/* Storage Sunburst */}
      <LazySection minHeight={360}>
        <Card trackerColor={accentColor} className="flex flex-col gap-4" title="Storage Breakdown">
          <StorageSunburst
            torrents={data.torrents.map((t) => ({
              name: t.name,
              size: t.size,
              category: t.category,
            }))}
            accentColor={accentColor}
            height={480}
          />
        </Card>
      </LazySection>

      {/* Elder Torrents */}
      <LazySection>
        <div className="flex flex-col gap-3">
          <H2 className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
            Elder Torrents
          </H2>
          <TorrentRankingTable variant="elder" torrents={data.elderTorrents} />
        </div>
      </LazySection>
    </div>
  )
}

export type { TorrentsTabProps }
export { TorrentsTab }
