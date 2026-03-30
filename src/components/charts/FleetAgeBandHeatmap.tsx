// src/components/charts/FleetAgeBandHeatmap.tsx
"use client"

import type { EChartsOption } from "echarts"
import { hexToRgba } from "@/lib/color-utils"
import type { TrackerTag } from "@/lib/fleet"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { CHART_THEME, chartTooltip, chartTooltipRow, escHtml } from "./lib/theme"

const AGE_BUCKETS = [
  { label: "0-30d", maxDays: 30 },
  { label: "1-3mo", maxDays: 90 },
  { label: "3-6mo", maxDays: 180 },
  { label: "6mo-1y", maxDays: 365 },
  { label: "1-2y", maxDays: 730 },
  { label: "2y+", maxDays: Infinity },
] as const

interface TrackerBuckets {
  name: string
  color: string
  counts: number[]
  total: number
  avgDays: number
}

interface FleetAgeBandHeatmapProps {
  torrents: { addedOn: number; tags: string }[]
  trackerTags: TrackerTag[]
  height?: number
}

function bucketTorrents(
  torrents: { addedOn: number; tags: string }[],
  trackerTags: TrackerTag[]
): TrackerBuckets[] {
  const nowSec = Date.now() / 1000
  const tagSetLower = trackerTags.map((t) => ({
    tagLower: t.tag.toLowerCase(),
    name: t.name,
    color: t.color,
  }))

  const map = new Map<
    string,
    { counts: number[]; totalDays: number; total: number; color: string }
  >()
  for (const entry of tagSetLower) {
    map.set(entry.name, {
      counts: new Array(AGE_BUCKETS.length).fill(0),
      totalDays: 0,
      total: 0,
      color: entry.color,
    })
  }

  for (const torrent of torrents) {
    if (!torrent.addedOn || torrent.addedOn <= 0) continue
    const ageDays = (nowSec - torrent.addedOn) / 86400
    if (ageDays < 0) continue

    const torrentTagList = torrent.tags
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const matched = tagSetLower.find((e) => torrentTagList.includes(e.tagLower))
    if (!matched) continue

    const bucket = map.get(matched.name)
    if (!bucket) continue

    bucket.totalDays += ageDays
    bucket.total += 1

    const idx = AGE_BUCKETS.findIndex((b) => ageDays < b.maxDays)
    bucket.counts[idx === -1 ? AGE_BUCKETS.length - 1 : idx] += 1
  }

  const results: TrackerBuckets[] = []
  for (const [name, data] of map) {
    if (data.total === 0) continue
    results.push({
      name,
      color: data.color,
      counts: data.counts,
      total: data.total,
      avgDays: data.totalDays / data.total,
    })
  }

  return results.sort((a, b) => a.avgDays - b.avgDays)
}

function buildHeatmapOption(trackers: TrackerBuckets[]): EChartsOption {
  const bucketLabels = AGE_BUCKETS.map((b) => b.label)
  const trackerNames = trackers.map((t) => t.name)

  let maxCount = 0
  const heatmapData: [number, number, number][] = []
  for (let y = 0; y < trackers.length; y++) {
    for (let x = 0; x < AGE_BUCKETS.length; x++) {
      const val = trackers[y].counts[x]
      heatmapData.push([x, y, val])
      if (val > maxCount) maxCount = val
    }
  }

  const axisLabelStyle = {
    color: CHART_THEME.textTertiary,
    fontFamily: CHART_THEME.fontMono,
    fontSize: CHART_THEME.fontSizeCompact,
  }

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { data: [number, number, number] }
        const [bucketIdx, trackerIdx, count] = p.data
        const tracker = trackers[trackerIdx]
        const bucket = bucketLabels[bucketIdx]
        const pct = tracker.total > 0 ? ((count / tracker.total) * 100).toFixed(1) : "0"
        return (
          `<div style="font-family:var(--font-mono),monospace;font-size:${CHART_THEME.fontSizeDense}px;` +
          `color:${CHART_THEME.textTertiary};margin-bottom:4px;">${escHtml(tracker.name)} · ${escHtml(bucket)}</div>` +
          chartTooltipRow(tracker.color, "Torrents", String(count)) +
          "<br/>" +
          chartTooltipRow(tracker.color, "Share", `${pct}%`)
        )
      },
    }),
    grid: {
      left: 12,
      right: 12,
      top: 12,
      bottom: 12,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: bucketLabels,
      position: "top",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabelStyle,
      splitArea: { show: false },
    },
    yAxis: {
      type: "category",
      data: trackerNames,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabelStyle,
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxCount || 1,
      inRange: {
        color: [
          hexToRgba(CHART_THEME.accent, 0.04),
          hexToRgba(CHART_THEME.accent, 0.15),
          hexToRgba(CHART_THEME.accent, 0.35),
          hexToRgba(CHART_THEME.accent, 0.6),
          hexToRgba(CHART_THEME.accent, 0.9),
        ],
      },
    },
    series: [
      {
        type: "heatmap",
        data: heatmapData,
        emphasis: {
          itemStyle: {
            borderColor: CHART_THEME.accent,
            borderWidth: 1,
          },
        },
        itemStyle: {
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
          borderRadius: 4,
        },
        label: {
          show: true,
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeDense,
          formatter: (params: unknown) => {
            const p = params as { data: [number, number, number] }
            return p.data[2] > 0 ? String(p.data[2]) : ""
          },
        },
      },
    ],
  }
}

function FleetAgeBandHeatmap({ torrents, trackerTags, height = 300 }: FleetAgeBandHeatmapProps) {
  if (trackerTags.length === 0) {
    return <ChartEmptyState height={height} message="No tracker tags configured" />
  }

  const trackerBuckets = bucketTorrents(torrents, trackerTags)

  if (trackerBuckets.length === 0) {
    return <ChartEmptyState height={height} message="No torrent age data available" />
  }

  const dynamicHeight = Math.max(height, 60 + trackerBuckets.length * 36)

  return (
    <ChartECharts
      option={buildHeatmapOption(trackerBuckets)}
      style={{ height: dynamicHeight, width: "100%" }}
    />
  )
}

export type { FleetAgeBandHeatmapProps, TrackerBuckets }
export { bucketTorrents, FleetAgeBandHeatmap }
