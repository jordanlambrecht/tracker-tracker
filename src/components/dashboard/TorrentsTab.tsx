// src/components/dashboard/TorrentsTab.tsx
"use client"

import { H2 } from "@typography"
import clsx from "clsx"
import dynamic from "next/dynamic"
import { useState } from "react"
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
  NoDownloadClientState,
  NoTagState,
  TorrentRankingTable,
  TorrentStatCards,
  UnsatisfiedTorrentsTable,
} from "@/components/dashboard/torrents"
import { Card, LazySection, Notice, TorrentTabSkeleton } from "@/components/ui"
import type { TrackerTorrentsData } from "@/hooks/useTrackerTorrents"
import { formatSpeed, formatTimeAgo } from "@/lib/formatters"

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
    return <TorrentTabSkeleton />
  }

  if (!qbtTag) return <NoTagState trackerName={trackerName ?? "this tracker"} />
  if (data.noClients) return <NoDownloadClientState />

  return (
    <div className="flex flex-col gap-8">
      {/* Error banner */}
      {data.torrentError && <Notice variant="warn" box message={data.torrentError} />}

      {/* Stale data banner that's dismissible, reappears on next mount */}
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
          <H2 className="uppercase tracking-wider flex items-center gap-2">
            {data.activelyDownloading.length > 0 && (
              <span className="inline-block w-2 h-2 rounded-full bg-warn animate-pulse" />
            )}
            Active Downloads ({data.activelyDownloading.length})
            {data.activelyDownloading.length > 0 && (
              <span className="font-mono text-warn ml-auto mr-2 text-2xs normal-case tracking-normal">
                {formatSpeed(data.activelyDownloading.reduce((s, t) => s + t.downloadSpeed, 0))}
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
          <H2 className="uppercase tracking-wider flex items-center gap-2">
            {data.activelySeedingTorrents.length > 0 && (
              <span
                className="inline-block w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: accentColor }}
              />
            )}
            Active Uploads ({data.activelySeedingTorrents.length})
            {data.activelySeedingTorrents.length > 0 && (
              <span className="font-mono text-accent ml-auto mr-2 text-2xs normal-case tracking-normal">
                {formatSpeed(data.activelySeedingTorrents.reduce((s, t) => s + t.uploadSpeed, 0))}
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryCard categories={data.categoryStats} accentColor={accentColor} />
        <Card
          lazy
          trackerColor={accentColor}
          className="flex flex-col gap-4"
          title="Cross-Seed Ratio"
        >
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

      {/* Tag Group Breakdowns */}
      {data.tagGroupBreakdowns.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {data.tagGroupBreakdowns.map(({ group, memberCounts, unmatchedCount }) => {
            const effectiveCount =
              memberCounts.length + (group.countUnmatched && unmatchedCount != null ? 1 : 0)
            const isSingleNumber = group.chartType === "numbers" && effectiveCount === 1
            const wideCard =
              group.chartType === "numbers" &&
              numbersNeedsWideCard(memberCounts.length, group.countUnmatched, unmatchedCount)
            return (
              <Card
                key={group.id}
                trackerColor={accentColor}
                className={clsx(
                  "flex flex-col gap-4",
                  wideCard && "lg:col-span-2",
                  isSingleNumber && "min-h-48"
                )}
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          lazy
          trackerColor={accentColor}
          className="flex flex-col gap-4"
          title="Ratio Distribution"
        >
          <TorrentRatioDistribution torrents={data.torrents} accentColor={accentColor} />
        </Card>
        <Card
          lazy
          trackerColor={accentColor}
          className="flex flex-col gap-4"
          title="Seed Time Distribution"
        >
          <TorrentSeedTimeDistribution
            torrents={data.torrents}
            seedTimeHours={
              data.requiredSeedSeconds != null ? data.requiredSeedSeconds / 3600 : null
            }
            accentColor={accentColor}
            height={280}
          />
        </Card>
      </div>

      {/* Size Breakdown + Activity Heatmap */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          lazy
          trackerColor={accentColor}
          className="flex flex-col gap-4"
          title="Size by Category"
        >
          <TorrentSizeBreakdown categories={data.categoryStats} accentColor={accentColor} />
        </Card>
        <Card
          lazy
          trackerColor={accentColor}
          className="flex flex-col gap-4"
          title="Torrent Add Heatmap"
        >
          <TorrentActivityHeatmap torrents={data.torrents} accentColor={accentColor} height={320} />
        </Card>
      </div>

      {/* Library Growth */}
      <Card lazy trackerColor={accentColor} className="flex flex-col gap-4" title="Library Growth">
        <TorrentAgeTimeline torrents={data.torrents} accentColor={accentColor} />
      </Card>

      {/* Category Acquisition */}
      <Card
        lazy
        title="Torrents Added by Category"
        subtitle="Monthly grabs by category"
        trackerColor={accentColor}
        className="flex flex-col gap-4"
      >
        <TorrentCategoryAcquisition torrents={data.torrents} accentColor={accentColor} />
      </Card>

      {/* Avg Seed Time by Cohort */}
      <Card
        lazy
        title="Average Seed Time by Cohort"
        trackerColor={accentColor}
        className="flex flex-col gap-4"
      >
        <TorrentAvgSeedTime torrents={data.torrents} accentColor={accentColor} />
      </Card>

      {/* 3D Scatter */}
      <LazySection minHeight={400}>
        <Card
          title="Torrent Library — 3D Scatter"
          trackerColor={accentColor}
          className="flex flex-col gap-4"
        >
          <TorrentAgeScatter3D torrents={data.torrents} accentColor={accentColor} />
        </Card>
      </LazySection>

      {/* Unsatisfied Torrents */}
      {data.requiredSeedSeconds && (
        <div className="flex flex-col gap-3">
          <H2 className="uppercase tracking-wider">
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
        <H2 className="uppercase tracking-wider">Top Seeded Torrents</H2>
        <TorrentRankingTable
          variant="top-seeded"
          torrents={data.topBySeeding}
          trackerColor={accentColor}
        />
      </div>

      {/* Parallel Coordinates */}
      <Card lazy trackerColor={accentColor} className="flex flex-col gap-4" title="Torrent Profile">
        <ParallelTorrentsChart torrents={data.torrents} trackerColor={accentColor} height={380} />
      </Card>

      {/* Storage Sunburst */}
      <Card
        lazy
        trackerColor={accentColor}
        className="flex flex-col gap-4"
        title="Storage Breakdown"
      >
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

      {/* Elder Torrents */}
      <div className="flex flex-col gap-3">
        <H2 className="uppercase tracking-wider">Elder Torrents</H2>
        <TorrentRankingTable
          variant="elder"
          torrents={data.elderTorrents}
          trackerColor={accentColor}
        />
      </div>
    </div>
  )
}

export type { TorrentsTabProps }
export { TorrentsTab }
