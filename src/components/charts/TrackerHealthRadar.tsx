// src/components/charts/TrackerHealthRadar.tsx
//
// Functions: computeTrackerMetrics, normalizeMetrics, buildTrackerHealthRadarOption, TrackerHealthRadar

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import type { TorrentRaw, TrackerTag } from "@/lib/fleet"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartDot, chartTooltip, escHtml } from "./theme"

interface TrackerHealthRadarProps {
  torrents: TorrentRaw[]
  trackerTags: TrackerTag[]
  height?: number
}

interface TrackerMetrics {
  name: string
  color: string
  torrentCount: number
  avgRatio: number
  uploadSpeedSum: number
  freshnessPct: number
  avgSeedTimeDays: number
}

const FRESHNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function computeTrackerMetrics(
  torrents: TorrentRaw[],
  trackerTags: TrackerTag[]
): TrackerMetrics[] {
  const now = Date.now()

  return trackerTags
    .map((tracker) => {
      const tagLower = tracker.tag.toLowerCase()
      const group = torrents.filter((t) => {
        const tags = t.tags
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
        return tags.includes(tagLower)
      })

      if (group.length === 0) return null

      const avgRatio =
        group.reduce((sum, t) => sum + t.ratio, 0) / group.length

      const uploadSpeedSum = group.reduce((sum, t) => sum + t.upspeed, 0)

      const recentCount = group.filter(
        (t) =>
          t.last_activity > 0 &&
          now - t.last_activity * 1000 < FRESHNESS_WINDOW_MS
      ).length
      const freshnessPct = (recentCount / group.length) * 100

      const avgSeedTimeDays =
        group.reduce((sum, t) => sum + t.seeding_time, 0) /
        group.length /
        86400

      return {
        name: tracker.name,
        color: tracker.color,
        torrentCount: group.length,
        avgRatio,
        uploadSpeedSum,
        freshnessPct,
        avgSeedTimeDays,
      } satisfies TrackerMetrics
    })
    .filter((m): m is TrackerMetrics => m !== null)
}

function normalizeMetrics(metrics: TrackerMetrics[]): number[][] {
  const maxTorrentCount = Math.max(...metrics.map((m) => m.torrentCount), 1)
  const maxAvgRatio = Math.max(...metrics.map((m) => m.avgRatio), 1)
  const maxUploadSpeed = Math.max(...metrics.map((m) => m.uploadSpeedSum), 1)
  const maxFreshness = 100
  const maxSeedTime = Math.max(...metrics.map((m) => m.avgSeedTimeDays), 1)

  return metrics.map((m) => [
    (m.torrentCount / maxTorrentCount) * 100,
    (m.avgRatio / maxAvgRatio) * 100,
    (m.uploadSpeedSum / maxUploadSpeed) * 100,
    (m.freshnessPct / maxFreshness) * 100,
    (m.avgSeedTimeDays / maxSeedTime) * 100,
  ])
}

function buildTrackerHealthRadarOption(
  metrics: TrackerMetrics[],
  normalized: number[][]
): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as {
          name: string
          color: string
          value: number[]
          dataIndex: number
        }
        const m = metrics[p.dataIndex]
        if (!m) return ""
        const dot = chartDot(p.color)
        return (
          `${dot}<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(m.name)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">Torrents:</span> <span style="color:${CHART_THEME.textPrimary};">${m.torrentCount.toLocaleString()}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">Avg Ratio:</span> <span style="color:${CHART_THEME.textPrimary};">${m.avgRatio.toFixed(2)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">Freshness:</span> <span style="color:${CHART_THEME.textPrimary};">${m.freshnessPct.toFixed(1)}%</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">Avg Seed Time:</span> <span style="color:${CHART_THEME.textPrimary};">${m.avgSeedTimeDays.toFixed(1)}d</span>`
        )
      },
    }),
    legend: {
      bottom: 0,
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      data: metrics.map((m) => m.name),
    },
    radar: {
      indicator: [
        { name: "Torrent Count", max: 100 },
        { name: "Avg Ratio", max: 100 },
        { name: "Upload Speed", max: 100 },
        { name: "Freshness", max: 100 },
        { name: "Avg Seed Time", max: 100 },
      ],
      center: ["50%", "48%"],
      radius: "60%",
      axisName: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine },
      },
      splitArea: {
        areaStyle: {
          color: ["rgba(255,255,255,0.01)", "rgba(255,255,255,0.02)"],
        },
      },
      axisLine: {
        lineStyle: { color: CHART_THEME.gridLine },
      },
    },
    series: [
      {
        type: "radar",
        data: metrics.map((m, i) => ({
          name: m.name,
          value: normalized[i],
          lineStyle: { color: m.color, width: 2 },
          itemStyle: { color: m.color },
          areaStyle: { color: m.color, opacity: 0.15 },
        })),
      },
    ],
  }
}

function TrackerHealthRadar({
  torrents,
  trackerTags,
  height = 360,
}: TrackerHealthRadarProps) {
  const metrics = computeTrackerMetrics(torrents, trackerTags)

  if (metrics.length < 2) {
    return (
      <ChartEmptyState
        height={height}
        message="Need at least 2 trackers with torrents for radar comparison"
      />
    )
  }

  const normalized = normalizeMetrics(metrics)

  return (
    <ReactECharts
      option={buildTrackerHealthRadarOption(metrics, normalized)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { TrackerHealthRadar, computeTrackerMetrics, normalizeMetrics }
export type { TrackerHealthRadarProps, TrackerTag }
