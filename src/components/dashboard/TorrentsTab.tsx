// src/components/dashboard/TorrentsTab.tsx
//
// Functions: TorrentsTab, NoClientState, NoTagState, ActiveTransfersTable,
//   CategoryRadarChart, CategoryDonutChart, CategoryCard, CrossSeedDonut, RatioDistribution, SeedTimeDistribution,
//   SizeBreakdown, ActivityHeatmap, AgeTimeline, CategoryAcquisitionChart,
//   AvgSeedTimeChart, TorrentAgeScatter3D, TopTorrentsTable,
//   UnsatisfiedTorrentsTable, ElderTorrentsTable, parseTorrentTags

"use client"

import clsx from "clsx"
import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import "echarts-gl"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ParallelTorrentsChart } from "@/components/charts/ParallelTorrentsChart"
import { StorageSunburst } from "@/components/charts/StorageSunburst"
import { TagGroupBreakdownChart } from "@/components/charts/TagGroupBreakdownChart"
import { CHART_THEME, escHtml } from "@/components/charts/theme"
import { Card } from "@/components/ui/Card"
import { BoltIcon, BoxIcon, ClockIcon, LeechingIcon, SeedingIcon, ServerIcon, ShareScoreIcon, TagIcon, TriangleWarningIcon } from "@/components/ui/Icons"
import { MarqueeText } from "@/components/ui/MarqueeText"
import { StatCard } from "@/components/ui/StatCard"
import type { Column } from "@/components/ui/Table"
import { Table } from "@/components/ui/Table"
import { H2 } from "@/components/ui/Typography"
import type { TrackerRules } from "@/data/tracker-registry"
import { formatBytesFromNumber, generatePalette, getComplementaryColor, hexToRgba } from "@/lib/formatters"
import type { QbitmanageTagConfig, TagGroup } from "@/types/api"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AggregatedTorrentsResponse {
  torrents: QbtTorrentRaw[]
  crossSeedTags: string[]
  clientErrors: string[]
  clientCount: number
}

interface TorrentInfo {
  hash: string
  name: string
  state: string
  tags: string
  category: string
  uploaded: number
  downloaded: number
  ratio: number
  size: number
  seedingTime: number // seconds
  timeActive: number // seconds
  addedOn: number // unix timestamp
  completionOn: number // unix timestamp (-1 if incomplete)
  lastActivity: number // unix timestamp
  amountLeft: number // bytes remaining
  numSeeds: number // connected seeds
  numLeechs: number // connected leechers
  numComplete: number // total seeders in swarm
  numIncomplete: number // total leechers in swarm
  upspeed: number
  dlspeed: number
  availability: number // 0-1
  progress: number // 0-1
  clientName: string
}

interface TorrentsTabProps {
  trackerId: number
  trackerName?: string
  qbtTag: string | null
  accentColor: string
  rules?: TrackerRules
  tagGroups?: TagGroup[]
  trackerSeedingCount?: number | null
  qbitmanageConfig?: {
    enabled: boolean
    tags: QbitmanageTagConfig
  } | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEEDING_STATES = new Set(["uploading", "stalledUP", "forcedUP", "queuedUP", "pausedUP"])
const LEECHING_STATES = new Set(["downloading", "stalledDL", "forcedDL", "queuedDL", "metaDL"])


const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
)

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const ICONS = {
  seeding: <SeedingIcon width={16} height={16} />,
  leeching: <LeechingIcon width={16} height={16} />,
  warning: <TriangleWarningIcon width={16} height={16} />,
  crossSeed: <ShareScoreIcon width={16} height={16} />,
  speed: <BoltIcon width={16} height={16} />,
  stale: <ClockIcon width={16} height={16} />,
  size: <BoxIcon width={16} height={16} />,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytesFromNumber(bytesPerSec)}/s`
}

function splitValueUnit(formatted: string): { num: string; unit: string } {
  const idx = formatted.indexOf(" ")
  if (idx === -1) return { num: formatted, unit: "" }
  return { num: formatted.slice(0, idx), unit: formatted.slice(idx + 1) }
}

function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86400).toFixed(1)}d`
}


/** Normalize a value to 0-100 scale for radar chart */
function normalize(value: number, max: number): number {
  if (max === 0) return 0
  return Math.min((value / max) * 100, 100)
}

// ---------------------------------------------------------------------------
// Active Transfers Table (downloads or uploads)
// ---------------------------------------------------------------------------

function ActiveTransfersTable({
  torrents,
  mode,
  accentColor,
  showClientName,
}: {
  torrents: TorrentInfo[]
  mode: "downloading" | "uploading"
  accentColor: string
  showClientName: boolean
}) {
  if (torrents.length === 0) {
    return (
      <div
        className="nm-inset-sm bg-control-bg flex flex-1 items-center justify-center rounded-nm-md min-h-[72px]"
      >
        <p className="text-xs text-muted font-mono">No active {mode === "downloading" ? "downloads" : "uploads"}</p>
      </div>
    )
  }

  const isDownload = mode === "downloading"

  const columns: Column<TorrentInfo>[] = [
    {
      key: "name",
      header: "Name",
      width: "40%",
      render: (t) => (
        <div className="flex flex-col gap-1 min-w-0">
          <MarqueeText className="text-xs font-mono text-secondary">{t.name}</MarqueeText>
          {showClientName && t.clientName && (
            <span className="text-[10px] font-sans text-muted truncate">{t.clientName}</span>
          )}
          {isDownload && (
            <div className="w-full h-1 rounded-full bg-base overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(t.progress * 100).toFixed(1)}%`,
                  backgroundColor: accentColor,
                }}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: 48,
      render: (t) => {
        const formatted = formatBytesFromNumber(t.size)
        const spaceIdx = formatted.indexOf(" ")
        const num = spaceIdx > -1 ? formatted.slice(0, spaceIdx) : formatted
        const unit = spaceIdx > -1 ? formatted.slice(spaceIdx + 1) : ""
        return (
          <span className="text-[11px] font-mono text-muted text-right leading-none">
            {num}<span className="block text-[9px] mt-px">{unit}</span>
          </span>
        )
      },
    },
    {
      key: "progress",
      header: isDownload ? "Prog" : "Ratio",
      align: "right",
      width: 36,
      render: (t) => (
        <span className="text-[11px] font-mono text-muted">
          {isDownload ? `${(t.progress * 100).toFixed(0)}%` : t.ratio.toFixed(2)}
        </span>
      ),
    },
    {
      key: "speed",
      header: "Speed",
      align: "right",
      width: 48,
      render: (t) => {
        const raw = isDownload ? t.dlspeed : t.upspeed
        const formatted = formatBytesFromNumber(raw)
        const spaceIdx = formatted.indexOf(" ")
        const num = spaceIdx > -1 ? formatted.slice(0, spaceIdx) : formatted
        const unit = spaceIdx > -1 ? `${formatted.slice(spaceIdx + 1)}/s` : "/s"
        return (
          <span className="text-[11px] font-mono text-right leading-none" style={{ color: accentColor }}>
            {num}<span className="block text-[9px] text-muted mt-px">{unit}</span>
          </span>
        )
      },
    },
    {
      key: "activity",
      header: "Last",
      align: "right",
      width: 36,
      render: (t) => {
        if (t.lastActivity <= 0) return <span className="text-[11px] font-mono text-muted">—</span>
        const diff = Math.floor(Date.now() / 1000 - t.lastActivity)
        const val = diff < 60 ? `${diff}s` : diff < 3600 ? `${Math.floor(diff / 60)}m` : diff < 86400 ? `${Math.floor(diff / 3600)}h` : `${Math.floor(diff / 86400)}d`
        return <span className="text-[11px] font-mono text-muted">{val}</span>
      },
    },
  ]

  return (
    <Table<TorrentInfo>
      columns={columns}
      data={torrents}
      keyExtractor={(t) => t.hash}
      surface="inset"
      fixedLayout
      compact
      noHorizontalScroll
      maxHeight={400}
      animated
    />
  )
}

// ---------------------------------------------------------------------------
// Category Radar Chart (ECharts)
// ---------------------------------------------------------------------------

interface CategoryStats {
  name: string
  count: number
  totalSize: number
  avgRatio: number
  avgSeedTime: number // seconds
  avgSwarmSeeds: number
}

function CategoryRadarChart({
  categories,
  accentColor,
}: {
  categories: CategoryStats[]
  accentColor: string
}) {
  if (categories.length < 2) {
    return <p className="text-sm text-muted font-mono py-4">Need 2+ categories for radar</p>
  }

  const top = categories.slice(0, 6)
  const maxCount = Math.max(...top.map((c) => c.count))
  const maxSize = Math.max(...top.map((c) => c.totalSize))
  const maxRatio = Math.max(...top.map((c) => c.avgRatio))
  const maxSeedTime = Math.max(...top.map((c) => c.avgSeedTime))
  const maxSwarm = Math.max(...top.map((c) => c.avgSwarmSeeds))

  const indicators = [
    { name: "Count", max: 100 },
    { name: "Size", max: 100 },
    { name: "Avg Ratio", max: 100 },
    { name: "Seed Time", max: 100 },
    { name: "Swarm", max: 100 },
  ]

  const palette = generatePalette(top.length, accentColor)

  const series = top.map((cat, i) => ({
    name: cat.name,
    value: [
      normalize(cat.count, maxCount),
      normalize(cat.totalSize, maxSize),
      normalize(cat.avgRatio, maxRatio),
      normalize(cat.avgSeedTime, maxSeedTime),
      normalize(cat.avgSwarmSeeds, maxSwarm),
    ],
    itemStyle: { color: palette[i % palette.length] },
    areaStyle: { color: hexToRgba(palette[i % palette.length], 0.15) },
    lineStyle: {
      width: 2,
      shadowColor: palette[i % palette.length],
      shadowBlur: 6,
    },
  }))

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number[]; color: string }
        const cat = top.find((c) => c.name === p.name)
        if (!cat) return ""
        return [
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;box-shadow:0 0 6px ${p.color};"></span><span style="color:${p.color};font-weight:600;">${escHtml(p.name)}</span>`,
          `Torrents: ${cat.count}`,
          `Size: ${formatBytesFromNumber(cat.totalSize)}`,
          `Avg Ratio: ${cat.avgRatio.toFixed(2)}`,
          `Avg Seed Time: ${formatDuration(cat.avgSeedTime)}`,
          `Avg Swarm Seeds: ${cat.avgSwarmSeeds.toFixed(0)}`,
        ].join("<br/>")
      },
    },
    legend: {
      bottom: 0,
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 12,
      },
      itemWidth: 14,
      itemHeight: 10,
      itemGap: 16,
    },
    radar: {
      indicator: indicators,
      shape: "polygon",
      center: ["50%", "48%"],
      radius: "70%",
      splitNumber: 4,
      axisName: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    series: [
      {
        type: "radar",
        symbol: "circle",
        symbolSize: 5,
        data: series,
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 380, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

// ---------------------------------------------------------------------------
// Category Distribution Donut (ECharts pie chart)
// ---------------------------------------------------------------------------

function CategoryDonutChart({
  categories,
  accentColor,
}: {
  categories: CategoryStats[]
  accentColor: string
}) {
  if (categories.length === 0) {
    return <p className="text-sm text-muted font-mono py-4">No category data</p>
  }

  const sorted = [...categories].sort((a, b) => b.count - a.count)
  const palette = generatePalette(sorted.length, accentColor)
  const total = sorted.reduce((sum, c) => sum + c.count, 0)

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number; color: string }
        const cat = sorted.find((c) => c.name === p.name)
        if (!cat) return ""
        return [
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;box-shadow:0 0 6px ${p.color};"></span><span style="color:${p.color};font-weight:600;">${escHtml(p.name)}</span>`,
          `Torrents: ${cat.count} (${p.percent.toFixed(1)}%)`,
          `Size: ${formatBytesFromNumber(cat.totalSize)}`,
        ].join("<br/>")
      },
    },
    legend: {
      orient: "vertical",
      right: 0,
      top: "middle",
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 8,
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
        },
        label: {
          show: true,
          position: "center",
          formatter: `{total|${total}}\n{label|torrents}`,
          rich: {
            total: {
              fontSize: 22,
              fontWeight: "bold",
              fontFamily: CHART_THEME.fontMono,
              color: CHART_THEME.textPrimary,
              lineHeight: 30,
            },
            label: {
              fontSize: 11,
              fontFamily: CHART_THEME.fontMono,
              color: CHART_THEME.textTertiary,
              lineHeight: 16,
            },
          },
        },
        emphasis: {
          label: { show: true },
          itemStyle: {
            shadowBlur: 12,
            shadowColor: "rgba(0,0,0,0.3)",
          },
        },
        data: sorted.map((cat, i) => ({
          name: cat.name,
          value: cat.count,
          itemStyle: { color: palette[i % palette.length] },
        })),
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 320, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

// ---------------------------------------------------------------------------
// Category Card — tabbed container for Radar + Donut
// ---------------------------------------------------------------------------

type CategoryView = "profile" | "distribution"

function CategoryCard({
  categories,
  accentColor,
}: {
  categories: CategoryStats[]
  accentColor: string
}) {
  const [view, setView] = useState<CategoryView>("distribution")

  return (
    <Card trackerColor={accentColor} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
          Categories
        </H2>
        <div className="flex gap-1 p-1 bg-control-bg nm-inset-sm rounded-nm-sm">
          {(
            [
              { key: "distribution", label: "Distribution" },
              { key: "profile", label: "Profile" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-nm-sm transition-all duration-150 cursor-pointer ${
                view === tab.key
                  ? "nm-raised-sm text-primary"
                  : "text-tertiary hover:text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {view === "distribution" ? (
        <CategoryDonutChart categories={categories} accentColor={accentColor} />
      ) : (
        <CategoryRadarChart categories={categories} accentColor={accentColor} />
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Ratio Distribution (ECharts bar chart)
// ---------------------------------------------------------------------------

function RatioDistribution({
  torrents,
  accentColor,
}: {
  torrents: TorrentInfo[]
  accentColor: string
}) {
  const buckets = [
    { label: "< 0.5", min: 0, max: 0.5, color: CHART_THEME.scale[0] },
    { label: "0.5-1", min: 0.5, max: 1, color: CHART_THEME.scale[1] },
    { label: "1-2", min: 1, max: 2, color: CHART_THEME.scale[2] },
    { label: "2-5", min: 2, max: 5, color: accentColor },
    { label: "5-10", min: 5, max: 10, color: CHART_THEME.scale[4] },
    { label: "10+", min: 10, max: Infinity, color: CHART_THEME.scale[5] },
  ]

  const counts = buckets.map((b) => ({
    ...b,
    count: torrents.filter((t) => t.ratio >= b.min && t.ratio < b.max).length,
  }))

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
    },
    grid: { left: 40, right: 16, top: 8, bottom: 28 },
    xAxis: {
      type: "category",
      data: counts.map((c) => c.label),
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
    },
    series: [
      {
        type: "bar",
        data: counts.map((c) => ({
          value: c.count,
          itemStyle: { color: c.color, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: c.color } },
        })),
        barWidth: "60%",
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 200, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

// ---------------------------------------------------------------------------
// Seed Time Distribution (ECharts bar chart with threshold marker)
// ---------------------------------------------------------------------------

function SeedTimeDistribution({
  torrents,
  seedTimeHours,
  accentColor,
}: {
  torrents: TorrentInfo[]
  seedTimeHours: number | null
  accentColor: string
}) {
  const seeding = torrents.filter((t) => SEEDING_STATES.has(t.state))
  const buckets = [
    { label: "< 1d", min: 0, max: 86400, color: CHART_THEME.scale[0] },
    { label: "1-7d", min: 86400, max: 604800, color: CHART_THEME.scale[1] },
    { label: "7-30d", min: 604800, max: 2592000, color: CHART_THEME.scale[2] },
    { label: "30-90d", min: 2592000, max: 7776000, color: accentColor },
    { label: "90d+", min: 7776000, max: Infinity, color: CHART_THEME.scale[4] },
  ]

  const counts = buckets.map((b) => ({
    ...b,
    count: seeding.filter((t) => t.seedingTime >= b.min && t.seedingTime < b.max).length,
  }))

  const thresholdSeconds = seedTimeHours != null && seedTimeHours > 0 ? seedTimeHours * 3600 : null

  // Find which bucket index the threshold falls in for the markLine
  let thresholdBucketIdx: number | null = null
  if (thresholdSeconds) {
    thresholdBucketIdx = buckets.findIndex((b) => thresholdSeconds >= b.min && thresholdSeconds < b.max)
    if (thresholdBucketIdx === -1) thresholdBucketIdx = null
  }

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
    },
    grid: { left: 40, right: 16, top: 24, bottom: 28 },
    xAxis: {
      type: "category",
      data: counts.map((c) => c.label),
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
    },
    series: [
      {
        type: "bar",
        data: counts.map((c) => ({
          value: c.count,
          itemStyle: { color: c.color, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: c.color } },
        })),
        barWidth: "60%",
        markLine: thresholdBucketIdx !== null
          ? {
              silent: true,
              symbol: "none",
              label: {
                formatter: seedTimeHours != null && seedTimeHours > 0 ? `Min: ${seedTimeHours % 24 === 0 ? `${seedTimeHours / 24}d` : `${seedTimeHours}h`}` : "Min",
                color: CHART_THEME.warn,
                fontFamily: CHART_THEME.fontMono,
                fontSize: 10,
              },
              lineStyle: { color: CHART_THEME.warn, type: "dashed", width: 2 },
              data: [{ xAxis: thresholdBucketIdx }],
            }
          : undefined,
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 200, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

// ---------------------------------------------------------------------------
// Cross-seed donut (ECharts)
// ---------------------------------------------------------------------------

function CrossSeedDonut({
  crossSeeded,
  unique,
  accentColor,
}: {
  crossSeeded: number
  unique: number
  accentColor: string
}) {
  const secondaryColor = getComplementaryColor(accentColor)
  const total = crossSeeded + unique

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
        },
        label: {
          show: true,
          position: "outside",
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 12,
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number }
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0"
            return `${escHtml(p.name)}: ${p.value} (${pct}%)`
          },
        },
        labelLine: {
          lineStyle: { color: CHART_THEME.borderMid },
          length: 14,
          length2: 10,
        },
        emphasis: {
          label: { show: true, fontWeight: "bold", color: CHART_THEME.textPrimary },
          itemStyle: { shadowBlur: 12, shadowColor: hexToRgba(accentColor, 0.5) },
        },
        data: [
          {
            name: "Cross-seeded",
            value: crossSeeded,
            itemStyle: { color: accentColor },
            emphasis: { itemStyle: { shadowBlur: 12, shadowColor: accentColor } },
          },
          {
            name: "Unique",
            value: unique,
            itemStyle: { color: secondaryColor },
            emphasis: { itemStyle: { shadowBlur: 12, shadowColor: secondaryColor } },
          },
        ],
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 300, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

// ---------------------------------------------------------------------------
// Size Breakdown by Category (horizontal bar)
// ---------------------------------------------------------------------------

function SizeBreakdown({
  categories,
  accentColor,
}: {
  categories: CategoryStats[]
  accentColor: string
}) {
  if (categories.length === 0) {
    return <p className="text-sm text-muted font-mono py-4">No category data</p>
  }

  const top = categories.slice(0, 8)
  const palette = generatePalette(top.length, accentColor)

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number; color: string }[])[0]
        if (!p) return ""
        const cat = top.find((c) => c.name === p.name)
        return [
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;box-shadow:0 0 6px ${p.color};"></span><span style="font-weight:600;color:${p.color}">${escHtml(p.name)}</span>`,
          `Size: ${formatBytesFromNumber(p.value)}`,
          cat ? `Torrents: ${cat.count}` : "",
        ].filter(Boolean).join("<br/>")
      },
    },
    grid: { left: 100, right: 24, top: 8, bottom: 8 },
    xAxis: {
      type: "value",
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
        formatter: (val: number) => formatBytesFromNumber(val),
      },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    yAxis: {
      type: "category",
      data: top.map((c) => c.name).reverse(),
      axisLabel: {
        color: CHART_THEME.textSecondary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
        width: 80,
        overflow: "truncate",
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: top.map((c, i) => ({
          value: c.totalSize,
          itemStyle: { color: palette[i % palette.length], borderRadius: [0, 4, 4, 0] },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: palette[i % palette.length] } },
        })).reverse(),
        barWidth: "60%",
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(160, top.length * 36), width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

// ---------------------------------------------------------------------------
// Activity Heatmap (GitHub-style: day-of-week x hour-of-day)
// ---------------------------------------------------------------------------

function ActivityHeatmap({
  torrents,
  accentColor,
}: {
  torrents: TorrentInfo[]
  accentColor: string
}) {
  // Build 7x24 grid from addedOn timestamps
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])
  for (const t of torrents) {
    if (t.addedOn <= 0) continue
    const d = new Date(t.addedOn * 1000)
    grid[d.getDay()][d.getHours()] += 1
  }

  // Flatten to [hour, day, count] for ECharts
  const data: [number, number, number][] = []
  let maxCount = 0
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = grid[day][hour]
      data.push([hour, day, count])
      if (count > maxCount) maxCount = count
    }
  }

  if (maxCount === 0) {
    return <p className="text-sm text-muted font-mono py-4">No activity data</p>
  }

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      formatter: (params: unknown) => {
        const p = params as { value: [number, number, number] }
        const [hour, day, count] = p.value
        return `${DAY_LABELS[day]} ${HOUR_LABELS[hour]}: ${count} torrent${count !== 1 ? "s" : ""} added`
      },
    },
    grid: { left: 48, right: 24, top: 8, bottom: 32 },
    xAxis: {
      type: "category",
      data: HOUR_LABELS,
      splitArea: { show: false },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 9,
        interval: 2,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: DAY_LABELS,
      splitArea: { show: false },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      min: 0,
      max: maxCount,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemWidth: 12,
      itemHeight: 80,
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 9,
      },
      inRange: {
        color: [
          CHART_THEME.gridLine,
          hexToRgba(accentColor, 0.3),
          hexToRgba(accentColor, 0.6),
          accentColor,
        ],
      },
    },
    series: [
      {
        type: "heatmap",
        data,
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: hexToRgba(accentColor, 0.5),
          },
        },
        itemStyle: {
          borderRadius: 3,
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
        },
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 240, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

// ---------------------------------------------------------------------------
// Age Timeline (cumulative torrent count over time)
// ---------------------------------------------------------------------------

function AgeTimeline({
  torrents,
  accentColor,
}: {
  torrents: TorrentInfo[]
  accentColor: string
}) {
  const withDates = torrents.filter((t) => t.addedOn > 0).sort((a, b) => a.addedOn - b.addedOn)
  if (withDates.length < 2) {
    return <p className="text-sm text-muted font-mono py-4">Need 2+ torrents with dates</p>
  }

  // Group by day
  const dayMap = new Map<string, number>()
  let cumulative = 0
  for (const t of withDates) {
    const day = new Date(t.addedOn * 1000).toISOString().split("T")[0]
    cumulative++
    dayMap.set(day, cumulative)
  }

  const labels = [...dayMap.keys()]
  const values = [...dayMap.values()]

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      formatter: (params: unknown) => {
        const p = (params as { axisValueLabel: string; value: number }[])[0]
        if (!p) return ""
        return `${escHtml(String(p.axisValueLabel ?? ""))}<br/><span style="font-weight:600;color:${accentColor}">${p.value}</span> torrents`
      },
    },
    grid: { left: 48, right: 16, top: 16, bottom: 40 },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
        rotate: 30,
        interval: "auto",
      },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
    },
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        symbol: "none",
        lineStyle: {
          color: accentColor,
          width: 2,
          shadowColor: accentColor,
          shadowBlur: 8,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(accentColor, 0.25) },
              { offset: 1, color: hexToRgba(accentColor, 0) },
            ],
          },
        },
        emphasis: {
          lineStyle: { shadowBlur: 16, shadowColor: accentColor },
        },
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 220, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

// ---------------------------------------------------------------------------
// Category Acquisition Over Time (stacked bar — torrents added per month by category)
// ---------------------------------------------------------------------------

function CategoryAcquisitionChart({
  torrents,
  accentColor,
}: {
  torrents: TorrentInfo[]
  accentColor: string
}) {
  const withDates = torrents.filter((t) => t.addedOn > 0)
  if (withDates.length < 2) {
    return <p className="text-sm text-muted font-mono py-4">Need 2+ torrents with dates</p>
  }

  // Group by month + category
  const monthCatMap = new Map<string, Map<string, number>>()
  const allCategories = new Set<string>()

  for (const t of withDates) {
    const month = new Date(t.addedOn * 1000).toISOString().slice(0, 7) // YYYY-MM
    const cat = t.category || "Uncategorized"
    allCategories.add(cat)
    if (!monthCatMap.has(month)) monthCatMap.set(month, new Map())
    const catMap = monthCatMap.get(month) ?? new Map<string, number>()
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1)
  }

  const months = [...monthCatMap.keys()].sort()
  const categories = [...allCategories]
  const palette = generatePalette(categories.length, accentColor)

  const series = categories.map((cat, i) => ({
    name: cat,
    type: "bar" as const,
    stack: "total",
    emphasis: { focus: "series" as const },
    barWidth: "60%",
    itemStyle: {
      color: palette[i],
      borderRadius: i === categories.length - 1 ? [2, 2, 0, 0] : undefined,
    },
    data: months.map((m) => monthCatMap.get(m)?.get(cat) ?? 0),
  }))

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
    },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: CHART_THEME.textTertiary, fontFamily: CHART_THEME.fontMono, fontSize: 10 },
      pageTextStyle: { color: CHART_THEME.textTertiary },
      pageIconColor: CHART_THEME.textSecondary,
      pageIconInactiveColor: CHART_THEME.textTertiary,
    },
    grid: { left: 48, right: 16, top: 16, bottom: 48 },
    xAxis: {
      type: "category",
      data: months,
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
        rotate: months.length > 12 ? 30 : 0,
        interval: "auto",
      },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
    },
    series,
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 280, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

// ---------------------------------------------------------------------------
// Avg Seed Time Over Time (line chart grouped by month of addedOn)
// ---------------------------------------------------------------------------

function AvgSeedTimeChart({
  torrents,
  accentColor,
}: {
  torrents: TorrentInfo[]
  accentColor: string
}) {
  const withDates = torrents.filter((t) => t.addedOn > 0 && t.seedingTime > 0)
  if (withDates.length === 0) return null

  const byMonth = new Map<string, { total: number; count: number }>()
  for (const t of withDates) {
    const d = new Date(t.addedOn * 1000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const entry = byMonth.get(key) ?? { total: 0, count: 0 }
    entry.total += t.seedingTime
    entry.count += 1
    byMonth.set(key, entry)
  }

  const sorted = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
  const labels = sorted.map(([k]) => k)
  const values = sorted.map(([, v]) => Math.floor(v.total / v.count / 86400))

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0]
        if (!p) return ""
        return `${escHtml(p.name)}<br/>Avg: <b>${p.value}d</b>`
      },
    },
    grid: { top: 16, right: 16, bottom: 32, left: 48 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      name: "Days",
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: accentColor, width: 2 },
        itemStyle: { color: accentColor },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(accentColor, 0.3) },
              { offset: 1, color: hexToRgba(accentColor, 0.02) },
            ],
          },
        },
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 280, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

// ---------------------------------------------------------------------------
// Torrent Age Scatter 3D (echarts-gl scatter3D)
// ---------------------------------------------------------------------------

type Scatter3DView = "age-seed" | "seed-ratio"

const SCATTER3D_VIEWS: Record<Scatter3DView, {
  label: string
  description: string
  x: { idx: number; name: string }
  y: { idx: number; name: string }
  z: { idx: number; name: string }
  color: { idx: number; name: string; max: number }
}> = {
  "age-seed": {
    label: "Age vs Seed Time",
    description: "Age = time since added · Seed Time = cumulative active seeding · Gap reveals downtime · Color = ratio",
    x: { idx: 0, name: "Age (days)" },
    y: { idx: 1, name: "Seed Time (days)" },
    z: { idx: 2, name: "Size (GiB)" },
    color: { idx: 3, name: "Ratio", max: 5 },
  },
  "seed-ratio": {
    label: "Seed Time vs Ratio",
    description: "Are you getting ratio returns for your seeding investment? · Color = age",
    x: { idx: 1, name: "Seed Time (days)" },
    y: { idx: 3, name: "Ratio" },
    z: { idx: 2, name: "Size (GiB)" },
    color: { idx: 0, name: "Age (days)", max: 365 },
  },
}

function TorrentAgeScatter3D({
  torrents,
  accentColor,
}: {
  torrents: TorrentInfo[]
  accentColor: string
}) {
  const [view, setView] = useState<Scatter3DView>("age-seed")
  const cfg = SCATTER3D_VIEWS[view]

  const now = Date.now() / 1000
  const data = torrents
    .filter((t) => t.addedOn > 0)
    .map((t) => [
      Math.floor((now - t.addedOn) / 86400),   // 0: age
      Math.floor(t.seedingTime / 86400),         // 1: seed time
      +(t.size / 1024 ** 3).toFixed(2),          // 2: size
      Math.min(t.ratio, 10),                     // 3: ratio
    ])

  if (data.length === 0) return null

  const axisStyle = {
    nameTextStyle: { color: CHART_THEME.textTertiary, fontFamily: CHART_THEME.fontMono, fontSize: 10 },
    axisLabel: { color: CHART_THEME.textTertiary, fontFamily: CHART_THEME.fontMono, fontSize: 9 },
    axisLine: { lineStyle: { color: CHART_THEME.borderEmphasis } },
  }

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      formatter: (p: { data: number[] }) => {
        const d = p.data
        return `Age: ${d[0]}d<br/>Seed: ${d[1]}d<br/>Size: ${d[2]} GiB<br/>Ratio: ${d[3].toFixed(2)}`
      },
    },
    visualMap: {
      show: true,
      min: 0,
      max: cfg.color.max,
      dimension: cfg.color.idx,
      inRange: {
        color: [
          CHART_THEME.scale[0],
          CHART_THEME.scale[1],
          CHART_THEME.scale[2],
          accentColor,
          CHART_THEME.scale[4],
        ],
      },
      text: [`${cfg.color.name} ${cfg.color.max}+`, "0"],
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
    },
    xAxis3D: { type: "value", name: cfg.x.name, ...axisStyle },
    yAxis3D: { type: "value", name: cfg.y.name, ...axisStyle },
    zAxis3D: { type: "value", name: cfg.z.name, ...axisStyle },
    grid3D: {
      boxWidth: 100,
      boxDepth: 80,
      boxHeight: 60,
      viewControl: { autoRotate: true, autoRotateSpeed: 4 },
      light: {
        main: { intensity: 1.2 },
        ambient: { intensity: 0.3 },
      },
      environment: CHART_THEME.surface,
    },
    series: [
      {
        type: "scatter3D",
        data,
        symbolSize: 4,
        itemStyle: { opacity: 0.8 },
      },
    ],
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {(Object.keys(SCATTER3D_VIEWS) as Scatter3DView[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={clsx(
              "px-3 py-1.5 text-[11px] font-mono rounded-nm-pill transition-colors cursor-pointer",
              view === key ? "nm-raised-sm text-primary" : "nm-inset-sm text-tertiary hover:text-secondary",
            )}
          >
            {SCATTER3D_VIEWS[key].label}
          </button>
        ))}
      </div>
      <p className="text-xs font-mono text-tertiary">{cfg.description}</p>
      <div className="rounded-nm-md overflow-hidden" style={{ backgroundColor: CHART_THEME.surface }}>
        <ReactECharts
          option={option}
          style={{ height: 400, width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
          lazyUpdate
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top torrents table
// ---------------------------------------------------------------------------

function TopTorrentsTable({
  torrents,
  accentColor: _accentColor,
}: {
  torrents: TorrentInfo[]
  accentColor: string
}) {
  const columns: Column<TorrentInfo>[] = [
    {
      key: "rank",
      header: "#",
      width: 28,
      render: (_t, i) => <span className="text-[11px] font-mono text-muted">{i != null ? i + 1 : ""}</span>,
    },
    {
      key: "name",
      header: "Name",
      width: "40%",
      render: (t) => (
        <MarqueeText className="text-[11px] font-mono text-secondary" speed={30}>{t.name}</MarqueeText>
      ),
    },
    {
      key: "category",
      header: "Cat",
      width: 56,
      render: (t) => (
        <span className="text-[11px] font-mono text-muted truncate block" title={t.category}>{t.category || "\u2014"}</span>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: 48,
      render: (t) => {
        const formatted = formatBytesFromNumber(t.size)
        const spaceIdx = formatted.indexOf(" ")
        const num = spaceIdx > -1 ? formatted.slice(0, spaceIdx) : formatted
        const unit = spaceIdx > -1 ? formatted.slice(spaceIdx + 1) : ""
        return (
          <span className="text-[11px] font-mono text-muted text-right leading-none">
            {num}<span className="block text-[9px] mt-px">{unit}</span>
          </span>
        )
      },
    },
    {
      key: "ratio",
      header: "Ratio",
      align: "right",
      width: 40,
      render: (t) => <span className="text-[11px] font-mono text-muted">{t.ratio.toFixed(2)}</span>,
    },
    {
      key: "seedTime",
      header: "Seed",
      align: "right",
      width: 48,
      render: (t) => <span className="text-[11px] font-mono text-muted">{formatDuration(t.seedingTime)}</span>,
    },
    {
      key: "swarm",
      header: "S/L",
      align: "right",
      width: 40,
      render: (t) => <span className="text-[11px] font-mono text-muted">{t.numComplete}/{t.numIncomplete}</span>,
    },
  ]

  return (
    <Table<TorrentInfo>
      columns={columns}
      data={torrents}
      keyExtractor={(t) => t.hash}
      emptyMessage="No torrents found"
      surface="inset"
      fixedLayout
      compact
      noHorizontalScroll
    />
  )
}

// ---------------------------------------------------------------------------
// Unsatisfied Torrents Table (below min seed time)
// ---------------------------------------------------------------------------

function UnsatisfiedTorrentsTable({
  torrents,
  requiredSeconds,
  accentColor: _accentColor,
}: {
  torrents: TorrentInfo[]
  requiredSeconds: number
  accentColor: string
}) {
  const pctColor = (p: number) => p < 50 ? CHART_THEME.danger : p < 80 ? CHART_THEME.warn : CHART_THEME.positive

  const columns: Column<TorrentInfo>[] = [
    {
      key: "name",
      header: "Name",
      render: (t) => {
        const pct = Math.min((t.seedingTime / requiredSeconds) * 100, 100)
        return (
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs font-mono text-secondary truncate" title={t.name}>{t.name}</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-base overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct.toFixed(1)}%`,
                    backgroundColor: pctColor(pct),
                  }}
                />
              </div>
              <span className="text-[10px] font-mono shrink-0" style={{ color: pctColor(pct) }}>{pct.toFixed(0)}%</span>
            </div>
          </div>
        )
      },
    },
    {
      key: "category",
      header: "Category",
      width: 80,
      render: (t) => (
        <span className="text-xs font-mono text-muted truncate block" title={t.category}>{t.category || "\u2014"}</span>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: 72,
      render: (t) => <span className="text-xs font-mono text-muted">{formatBytesFromNumber(t.size)}</span>,
    },
    {
      key: "seedTime",
      header: "Seed Time",
      align: "right",
      width: 72,
      render: (t) => {
        const pct = Math.min((t.seedingTime / requiredSeconds) * 100, 100)
        return (
          <span className="text-xs font-mono" style={{ color: pctColor(pct) }}>
            {formatDuration(t.seedingTime)}
          </span>
        )
      },
    },
    {
      key: "required",
      header: "Required",
      align: "right",
      width: 72,
      render: () => <span className="text-xs font-mono text-muted">{formatDuration(requiredSeconds)}</span>,
    },
    {
      key: "progress",
      header: "Progress",
      align: "right",
      width: 72,
      render: (t) => {
        const pct = Math.min((t.seedingTime / requiredSeconds) * 100, 100)
        return (
          <span className="text-xs font-mono" style={{ color: pctColor(pct) }}>
            {pct.toFixed(0)}%
          </span>
        )
      },
    },
  ]

  return (
    <Table<TorrentInfo>
      columns={columns}
      data={torrents.slice(0, 15)}
      keyExtractor={(t) => t.hash}
      emptyMessage="All torrents meet seed time requirements"
      surface="inset"
    />
  )
}

// ---------------------------------------------------------------------------
// Elder Torrents Table (oldest torrents by add date)
// ---------------------------------------------------------------------------

function ElderTorrentsTable({
  torrents,
  accentColor: _accentColor,
}: {
  torrents: TorrentInfo[]
  accentColor: string
}) {
  const columns: Column<TorrentInfo>[] = [
    {
      key: "rank",
      header: "#",
      width: 28,
      render: (_t, i) => <span className="text-[11px] font-mono text-muted">{i != null ? i + 1 : ""}</span>,
    },
    {
      key: "name",
      header: "Name",
      width: "40%",
      render: (t) => (
        <MarqueeText className="text-[11px] font-mono text-secondary" speed={30}>{t.name}</MarqueeText>
      ),
    },
    {
      key: "category",
      header: "Cat",
      width: 56,
      render: (t) => (
        <span className="text-[11px] font-mono text-muted truncate block" title={t.category}>{t.category || "\u2014"}</span>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: 48,
      render: (t) => {
        const formatted = formatBytesFromNumber(t.size)
        const spaceIdx = formatted.indexOf(" ")
        const num = spaceIdx > -1 ? formatted.slice(0, spaceIdx) : formatted
        const unit = spaceIdx > -1 ? formatted.slice(spaceIdx + 1) : ""
        return (
          <span className="text-[11px] font-mono text-muted text-right leading-none">
            {num}<span className="block text-[9px] mt-px">{unit}</span>
          </span>
        )
      },
    },
    {
      key: "ratio",
      header: "Ratio",
      align: "right",
      width: 40,
      render: (t) => <span className="text-[11px] font-mono text-muted">{t.ratio.toFixed(2)}</span>,
    },
    {
      key: "added",
      header: "Added",
      align: "right",
      width: 56,
      render: (t) => {
        const d = new Date(t.addedOn * 1000)
        return <span className="text-[11px] font-mono text-muted">{d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</span>
      },
    },
    {
      key: "seedTime",
      header: "Seed",
      align: "right",
      width: 48,
      render: (t) => <span className="text-[11px] font-mono text-muted">{formatDuration(t.seedingTime)}</span>,
    },
  ]

  return (
    <Table<TorrentInfo>
      columns={columns}
      data={torrents}
      keyExtractor={(t) => t.hash}
      emptyMessage="No torrents found"
      surface="inset"
      fixedLayout
      compact
      noHorizontalScroll
    />
  )
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function NoClientState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 nm-inset-sm bg-control-bg rounded-nm-lg"
    >
      <ServerIcon width={40} height={40} className="text-muted" />
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-sm font-sans text-secondary">No download client connected</p>
        <p className="text-xs font-sans text-muted max-w-sm">
          Connect a qBittorrent client to see torrent data.{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Go to Settings
          </Link>
        </p>
      </div>
    </div>
  )
}

function NoTagState({ trackerName }: { trackerName: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 nm-inset-sm bg-control-bg rounded-nm-lg"
    >
      <TagIcon width={40} height={40} className="text-muted" />
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-sm font-sans text-secondary">No qBittorrent tag set for {trackerName}</p>
        <p className="text-xs font-sans text-muted max-w-sm">
          Set a tag in tracker settings to filter torrents from your client.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QbtTorrent → TorrentInfo mapper
// ---------------------------------------------------------------------------

interface QbtTorrentRaw {
  hash: string
  name: string
  state: string
  tags: string
  category: string
  uploaded: number
  downloaded: number
  ratio: number
  size: number
  seeding_time: number
  time_active: number
  added_on: number
  completion_on: number
  last_activity: number
  amount_left: number
  num_seeds: number
  num_leechs: number
  num_complete: number
  num_incomplete: number
  upspeed: number
  dlspeed: number
  availability: number
  progress: number
  client_name: string
}

function mapTorrent(raw: QbtTorrentRaw): TorrentInfo {
  return {
    hash: raw.hash,
    name: raw.name,
    state: raw.state,
    tags: raw.tags,
    category: raw.category,
    uploaded: raw.uploaded,
    downloaded: raw.downloaded,
    ratio: raw.ratio,
    size: raw.size,
    seedingTime: raw.seeding_time,
    timeActive: raw.time_active,
    addedOn: raw.added_on,
    completionOn: raw.completion_on,
    lastActivity: raw.last_activity,
    amountLeft: raw.amount_left,
    numSeeds: raw.num_seeds,
    numLeechs: raw.num_leechs,
    numComplete: raw.num_complete,
    numIncomplete: raw.num_incomplete,
    upspeed: raw.upspeed,
    dlspeed: raw.dlspeed,
    availability: raw.availability,
    progress: raw.progress,
    clientName: raw.client_name,
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function parseTorrentTags(rawTags: string): string[] {
  return rawTags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

function TorrentsTab({ trackerId, trackerName, qbtTag, accentColor, rules, tagGroups, trackerSeedingCount, qbitmanageConfig }: TorrentsTabProps) {
  const [torrents, setTorrents] = useState<TorrentInfo[]>([])
  const [crossSeedTags, setCrossSeedTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [torrentError, setTorrentError] = useState<string | null>(null)
  const [noClients, setNoClients] = useState(false)
  const [clientCount, setClientCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!qbtTag) {
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/trackers/${trackerId}/torrents`)
        if (!res.ok) {
          if (res.status === 400) {
            // No qbtTag configured — handled by NoTagState below
          } else {
            if (!cancelled) setTorrentError(`Failed to fetch torrents (${res.status})`)
          }
          if (!cancelled) setLoading(false)
          return
        }
        const data: AggregatedTorrentsResponse = await res.json()
        if (!cancelled) setTorrents(data.torrents.map(mapTorrent))
        if (!cancelled) setCrossSeedTags(data.crossSeedTags)
        if (!cancelled) setClientCount(data.clientCount)
        if (data.clientErrors.length > 0) {
          if (!cancelled) setTorrentError(`Partial data — some clients failed: ${data.clientErrors.join("; ")}`)
        } else {
          if (!cancelled) setTorrentError(null)
        }
        if (data.clientCount === 0 && !cancelled) setNoClients(true)
      } catch {
        if (!cancelled) setTorrentError("Could not reach server")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [trackerId, qbtTag])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted font-mono">Loading...</p>
      </div>
    )
  }

  if (noClients) return <NoClientState />
  if (!qbtTag) return <NoTagState trackerName={trackerName ?? "this tracker"} />

  // --- Compute stats ---
  const seedingTorrents = torrents.filter((t) => SEEDING_STATES.has(t.state))
  const leechingTorrents = torrents.filter((t) => LEECHING_STATES.has(t.state))
  const activelySeedingTorrents = torrents.filter((t) => t.state === "uploading")
  const activelyDownloading = torrents.filter((t) => LEECHING_STATES.has(t.state) && t.dlspeed > 0)
  const totalUpSpeed = torrents.reduce((sum, t) => sum + t.upspeed, 0)
  const totalSize = torrents.reduce((sum, t) => sum + t.size, 0)

  // Cross-seed: torrents that have at least one cross-seed tag (aggregated from all clients)
  const csTagSet = new Set(crossSeedTags.map((t) => t.toLowerCase()))
  const crossSeeded = torrents.filter((t) => {
    const tags = t.tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    return tags.some((tag) => csTagSet.has(tag))
  })

  // H&R risk — unsatisfied torrents (below min seed time)
  const requiredSeedSeconds = rules?.seedTimeHours != null && rules.seedTimeHours > 0 ? rules.seedTimeHours * 3600 : null
  const unsatisfiedTorrents = requiredSeedSeconds
    ? seedingTorrents.filter((t) => t.seedingTime < requiredSeedSeconds)
    : []
  const unsatisfiedCount = requiredSeedSeconds ? unsatisfiedTorrents.length : null

  // Dead torrents: client has more torrents than tracker reports seeding
  const deadCount = trackerSeedingCount != null ? Math.max(0, seedingTorrents.length - trackerSeedingCount) : null

  // --- Category stats ---
  const categoryMap = new Map<string, TorrentInfo[]>()
  for (const t of torrents) {
    const cat = t.category || "Uncategorized"
    const arr = categoryMap.get(cat) ?? []
    arr.push(t)
    categoryMap.set(cat, arr)
  }

  const categoryStats: CategoryStats[] = [...categoryMap.entries()]
    .map(([name, items]) => ({
      name,
      count: items.length,
      totalSize: items.reduce((s, t) => s + t.size, 0),
      avgRatio: items.reduce((s, t) => s + t.ratio, 0) / items.length,
      avgSeedTime: items.reduce((s, t) => s + t.seedingTime, 0) / items.length,
      avgSwarmSeeds: items.reduce((s, t) => s + t.numComplete, 0) / items.length,
    }))
    .sort((a, b) => b.count - a.count)

  // Top 10 by seed time
  const topBySeeding = [...seedingTorrents]
    .sort((a, b) => b.seedingTime - a.seedingTime)
    .slice(0, 10)

  // Elder torrents — oldest by addedOn
  const elderTorrents = [...torrents]
    .filter((t) => t.addedOn > 0)
    .sort((a, b) => a.addedOn - b.addedOn)
    .slice(0, 10)

  // Unsatisfied torrents — sorted by closest to meeting requirement
  const unsatisfiedSorted = requiredSeedSeconds
    ? [...unsatisfiedTorrents].sort((a, b) => b.seedingTime - a.seedingTime)
    : []

  // --- Tag group breakdowns ---
  const tagGroupBreakdowns = (tagGroups ?? []).map((group) => {
    const allGroupTags = group.members.map((m) => m.tag)
    const memberCounts = group.members
      .map((member) => {
        const count = torrents.filter((t) => parseTorrentTags(t.tags).includes(member.tag)).length
        return { label: member.label, count, color: member.color }
      })
      .filter((m) => m.count > 0)
    const unmatchedCount = torrents.filter((t) => {
      const tags = parseTorrentTags(t.tags)
      return !tags.some((tag) => allGroupTags.includes(tag))
    }).length
    return { group, memberCounts, unmatchedCount }
  }).filter((g) => g.memberCounts.length > 0 || (g.group.countUnmatched && g.unmatchedCount > 0))

  const qbitmanageBreakdown = qbitmanageConfig?.enabled
    ? Object.entries(qbitmanageConfig.tags)
        .filter(([, entry]) => entry.enabled)
        .map(([key, entry]) => {
          const count = torrents.filter((t) => parseTorrentTags(t.tags).includes(entry.tag)).length
          const labelMap: Record<string, string> = {
            issue: "Issue",
            minTimeNotReached: "Min Time Not Reached",
            noHardlinks: "No Hardlinks",
            minSeedsNotMet: "Min Seeds Not Met",
            lastActiveLimitNotReached: "Last Active Limit",
            lastActiveNotReached: "Last Active Not Reached",
          }
          return { label: labelMap[key] ?? key, count, color: null }
        })
        .filter((m) => m.count > 0)
    : []

  return (
    <div className="flex flex-col gap-8">
      {/* Torrent error banner */}
      {torrentError && (
        <div
          className="px-4 py-3 text-xs font-mono text-warn nm-inset-sm bg-warn-dim rounded-nm-md"
        >
          {torrentError}
        </div>
      )}

      {/* Active Transfers — always show both columns for stable layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3 min-w-0">
          <H2 className="text-xs font-sans font-medium text-secondary uppercase tracking-wider flex items-center gap-2">
            {activelyDownloading.length > 0 && (
              <span className="inline-block w-2 h-2 rounded-full bg-warn animate-pulse" />
            )}
            Active Downloads ({activelyDownloading.length})
          </H2>
          <ActiveTransfersTable torrents={activelyDownloading} mode="downloading" accentColor={accentColor} showClientName={clientCount > 1} />
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <H2 className="text-xs font-sans font-medium text-secondary uppercase tracking-wider flex items-center gap-2">
            {activelySeedingTorrents.length > 0 && (
              <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
            )}
            Active Uploads ({activelySeedingTorrents.length})
          </H2>
          <ActiveTransfersTable torrents={activelySeedingTorrents} mode="uploading" accentColor={accentColor} showClientName={clientCount > 1} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Seeding" value={seedingTorrents.length.toLocaleString()} accentColor={accentColor} icon={ICONS.seeding} />
        <StatCard label="Leeching" value={leechingTorrents.length.toLocaleString()} accentColor={accentColor} icon={ICONS.leeching} />
        <StatCard label="Upload Speed" value={splitValueUnit(formatSpeed(totalUpSpeed)).num} unit={splitValueUnit(formatSpeed(totalUpSpeed)).unit} accentColor={accentColor} icon={ICONS.speed} />
        <StatCard label="Total Size" value={splitValueUnit(formatBytesFromNumber(totalSize)).num} unit={splitValueUnit(formatBytesFromNumber(totalSize)).unit} accentColor={accentColor} icon={ICONS.size} />
        <StatCard label="Cross-Seeded" value={crossSeeded.length.toLocaleString()} unit={`/ ${torrents.length.toLocaleString()}`} accentColor={accentColor} icon={ICONS.crossSeed} />
        {deadCount !== null && (
          <StatCard
            label="Dead"
            value={deadCount.toLocaleString()}
            accentColor={deadCount > 0 ? CHART_THEME.warn : accentColor}
            icon={ICONS.warning}
            tooltip={`Client has ${seedingTorrents.length} seeding torrents, tracker reports ${trackerSeedingCount?.toLocaleString() ?? "?"}. Difference may include torrents removed from the tracker but still in your client. This is an estimate and may not be accurate if the tracker's seeding count is affected by paranoia settings or API delays.`}
          />
        )}
        <StatCard
          label="Avg Seed Time"
          value={torrents.length > 0
            ? formatDuration(Math.floor(torrents.reduce((s, t) => s + t.seedingTime, 0) / torrents.length))
            : "—"}
          accentColor={accentColor}
          icon={ICONS.seeding}
        />
        {(() => {
          const avg = torrents.length > 0 ? splitValueUnit(formatBytesFromNumber(Math.floor(totalSize / torrents.length))) : null
          return <StatCard label="Avg Size" value={avg?.num ?? "—"} unit={avg?.unit} accentColor={accentColor} icon={ICONS.size} />
        })()}
        {(() => {
          const largest = torrents.length > 0 ? splitValueUnit(formatBytesFromNumber(Math.max(...torrents.map((t) => t.size)))) : null
          return <StatCard label="Largest" value={largest?.num ?? "—"} unit={largest?.unit} accentColor={accentColor} icon={ICONS.size} />
        })()}
        {unsatisfiedCount !== null && (
          <StatCard label="H&R Risk" value={unsatisfiedCount.toLocaleString()} accentColor={unsatisfiedCount > 0 ? CHART_THEME.danger : accentColor} icon={ICONS.warning} />
        )}
      </div>

      {/* Row 1: Category card (tabbed) + Cross-seed donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryCard categories={categoryStats} accentColor={accentColor} />

        <Card trackerColor={accentColor} className="flex flex-col gap-4">
          <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
            Cross-Seed Ratio
          </H2>
          {csTagSet.size === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs font-mono text-tertiary text-center">
                No cross-seed tags configured.<br />
                Set them in Settings → Download Clients.
              </p>
            </div>
          ) : (
            <CrossSeedDonut
              crossSeeded={crossSeeded.length}
              unique={torrents.length - crossSeeded.length}
              accentColor={accentColor}
            />
          )}
        </Card>
      </div>

      {/* Tag Group Breakdowns */}
      {tagGroupBreakdowns.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {tagGroupBreakdowns.map(({ group, memberCounts, unmatchedCount }) => (
            <Card key={group.id} trackerColor={accentColor} className="flex flex-col gap-4">
              <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
                {group.emoji ? `${group.emoji} ` : ""}{group.name}
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
          ))}
        </div>
      )}

      {/* qbitmanage Breakdown */}
      {qbitmanageBreakdown.length > 0 && (
        <Card trackerColor={accentColor} className="flex flex-col gap-4">
          <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
            qbitmanage Status
          </H2>
          <TagGroupBreakdownChart
            groupName="qbitmanage Status"
            members={qbitmanageBreakdown}
            accentColor={accentColor}
          />
        </Card>
      )}

      {/* Row 2: Ratio distribution + Seed time distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card trackerColor={accentColor} className="flex flex-col gap-4">
          <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
            Ratio Distribution
          </H2>
          <RatioDistribution torrents={torrents} accentColor={accentColor} />
        </Card>

        <Card trackerColor={accentColor} className="flex flex-col gap-4">
          <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
            Seed Time Distribution
          </H2>
          <SeedTimeDistribution
            torrents={torrents}
            seedTimeHours={rules?.seedTimeHours ?? null}
            accentColor={accentColor}
          />
        </Card>
      </div>

      {/* Row 3: Size breakdown + Activity heatmap */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card trackerColor={accentColor} className="flex flex-col gap-4">
          <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
            Size by Category
          </H2>
          <SizeBreakdown categories={categoryStats} accentColor={accentColor} />
        </Card>

        <Card trackerColor={accentColor} className="flex flex-col gap-4">
          <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
            Torrent Add Heatmap
          </H2>
          <ActivityHeatmap torrents={torrents} accentColor={accentColor} />
        </Card>
      </div>

      {/* Age Timeline */}
      <Card trackerColor={accentColor} className="flex flex-col gap-4">
        <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
          Library Growth
        </H2>
        <AgeTimeline torrents={torrents} accentColor={accentColor} />
      </Card>

      {/* Torrents Added Over Time by Category */}
      <Card trackerColor={accentColor} className="flex flex-col gap-4">
        <H2>Torrents Added by Category</H2>
        <p className="text-xs font-mono text-tertiary">Monthly acquisition by category — shows what you've been grabbing</p>
        <CategoryAcquisitionChart torrents={torrents} accentColor={accentColor} />
      </Card>

      {/* Avg Seed Time Over Time */}
      <Card trackerColor={accentColor} className="flex flex-col gap-4">
        <H2>Average Seed Time by Cohort</H2>
        <AvgSeedTimeChart torrents={torrents} accentColor={accentColor} />
      </Card>

      {/* 3D Torrent Age Scatter */}
      <Card trackerColor={accentColor} className="flex flex-col gap-4">
        <H2>Torrent Library — 3D Scatter</H2>
        <TorrentAgeScatter3D torrents={torrents} accentColor={accentColor} />
      </Card>

      {/* Unsatisfied Torrents — only shown when seed time rule exists */}
      {requiredSeedSeconds && (
        <div className="flex flex-col gap-3">
          <H2 className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
            Unsatisfied Torrents ({unsatisfiedSorted.length})
          </H2>
          <UnsatisfiedTorrentsTable
            torrents={unsatisfiedSorted}
            requiredSeconds={requiredSeedSeconds}
            accentColor={accentColor}
          />
        </div>
      )}

      {/* Top Seeded Table */}
      <div className="flex flex-col gap-3">
        <H2 className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
          Top Seeded Torrents
        </H2>
        <TopTorrentsTable torrents={topBySeeding} accentColor={accentColor} />
      </div>

      {/* Parallel Coordinates — multi-dimensional torrent analysis */}
      <Card trackerColor={accentColor} className="flex flex-col gap-4">
        <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
          Torrent Profile
        </H2>
        <p className="text-xs font-mono text-tertiary -mt-2">
          Each line is a torrent — hover to inspect, brush axes to filter
        </p>
        <ParallelTorrentsChart
          torrents={torrents}
          trackerColor={accentColor}
          height={380}
        />
      </Card>

      {/* Storage Sunburst — category breakdown */}
      <Card trackerColor={accentColor} className="flex flex-col gap-4">
        <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
          Storage Breakdown
        </H2>
        <StorageSunburst
          torrents={torrents.map((t) => ({ name: t.name, size: t.size, category: t.category }))}
          accentColor={accentColor}
          height={480}
        />
      </Card>

      {/* Elder Torrents — oldest in library */}
      <div className="flex flex-col gap-3">
        <H2 className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
          Elder Torrents
        </H2>
        <ElderTorrentsTable torrents={elderTorrents} accentColor={accentColor} />
      </div>
    </div>
  )
}

export { TorrentsTab }
export type { TorrentsTabProps, TorrentInfo }
