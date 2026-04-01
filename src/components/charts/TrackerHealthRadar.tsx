// src/components/charts/TrackerHealthRadar.tsx
"use client"

import type { EChartsOption } from "echarts"
import { useMemo } from "react"
import type { TrackerTag } from "@/lib/fleet"
import { formatCount, formatPercent, formatRatio } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import {
  CHART_THEME,
  chartDot,
  chartLegend,
  chartTooltip,
  chartTooltipRow,
  escHtml,
} from "./lib/theme"

interface TrackerHealthRadarProps {
  torrents: TorrentInfo[]
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
  torrents: TorrentInfo[],
  trackerTags: TrackerTag[]
): TrackerMetrics[] {
  const now = Date.now()

  // Pre-parse tags once to avoid O(T×N) string splitting
  const parsedTags = torrents.map((t) => ({
    torrent: t,
    tagSet: new Set(
      t.tags
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    ),
  }))

  return trackerTags
    .map((tracker) => {
      const tagLower = tracker.tag.toLowerCase()
      const group = parsedTags.filter((p) => p.tagSet.has(tagLower)).map((p) => p.torrent)

      if (group.length === 0) return null

      const avgRatio = group.reduce((sum, t) => sum + t.ratio, 0) / group.length

      const uploadSpeedSum = group.reduce((sum, t) => sum + t.upspeed, 0)

      const recentCount = group.filter(
        (t) => t.lastActivity > 0 && now - t.lastActivity * 1000 < FRESHNESS_WINDOW_MS
      ).length
      const freshnessPct = (recentCount / group.length) * 100

      const avgSeedTimeDays =
        group.reduce((sum, t) => sum + t.seedingTime, 0) / group.length / 86400

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
        return [
          `${dot}<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(m.name)}</span>`,
          chartTooltipRow(p.color, "Torrents", formatCount(m.torrentCount)),
          chartTooltipRow(p.color, "Avg Ratio", formatRatio(m.avgRatio)),
          chartTooltipRow(p.color, "Freshness", formatPercent(m.freshnessPct)),
          chartTooltipRow(p.color, "Avg Seed Time", `${m.avgSeedTimeDays.toFixed(1)}d`),
        ].join("<br/>")
      },
    }),
    legend: chartLegend({ top: undefined, bottom: 0, data: metrics.map((m) => m.name) }),
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
        fontSize: CHART_THEME.fontSizeCompact,
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

function TrackerHealthRadar({ torrents, trackerTags, height = 360 }: TrackerHealthRadarProps) {
  const metrics = useMemo(
    () => computeTrackerMetrics(torrents, trackerTags),
    [torrents, trackerTags]
  )

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
    <ChartECharts
      option={buildTrackerHealthRadarOption(metrics, normalized)}
      style={{ height, width: "100%" }}
    />
  )
}

export type { TrackerHealthRadarProps }
export { computeTrackerMetrics, normalizeMetrics, TrackerHealthRadar }
