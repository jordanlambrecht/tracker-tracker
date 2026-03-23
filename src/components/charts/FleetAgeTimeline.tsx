// src/components/charts/FleetAgeTimeline.tsx
//
// Functions: groupByMonth, FleetAgeTimeline

"use client"

import type { TrackerTag } from "@/lib/fleet"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildStackedAreaOption } from "./lib/chart-helpers"
import { CHART_THEME } from "./lib/theme"

interface FleetAgeTimelineProps {
  torrents: { addedOn: number; tags: string }[]
  trackerTags?: TrackerTag[]
  height?: number
}

interface SeriesData {
  name: string
  color: string
  monthMap: Map<string, number>
}

function groupByMonth(
  torrents: { addedOn: number; tags: string }[],
  trackerTags: TrackerTag[]
): { sortedMonths: string[]; series: SeriesData[] } {
  const tagSetLower = trackerTags.map((t) => ({
    tagLower: t.tag.toLowerCase(),
    name: t.name,
    color: t.color,
  }))

  const seriesMap = new Map<string, SeriesData>()

  for (const entry of tagSetLower) {
    seriesMap.set(entry.name, {
      name: entry.name,
      color: entry.color,
      monthMap: new Map(),
    })
  }

  const otherSeries: SeriesData = {
    name: "Other",
    color: CHART_THEME.textTertiary,
    monthMap: new Map(),
  }

  const allMonths = new Set<string>()

  for (const torrent of torrents) {
    if (!torrent.addedOn || torrent.addedOn <= 0) continue
    const d = new Date(torrent.addedOn * 1000)
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    allMonths.add(month)

    const torrentTagList = torrent.tags
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const matchedEntry = tagSetLower.find((e) => torrentTagList.includes(e.tagLower))

    if (matchedEntry) {
      const series = seriesMap.get(matchedEntry.name)
      if (series) {
        series.monthMap.set(month, (series.monthMap.get(month) ?? 0) + 1)
      }
    } else {
      otherSeries.monthMap.set(month, (otherSeries.monthMap.get(month) ?? 0) + 1)
    }
  }

  const sortedMonths = Array.from(allMonths).sort()
  const series = [...seriesMap.values(), otherSeries].filter((s) => s.monthMap.size > 0)

  return { sortedMonths, series }
}

function FleetAgeTimeline({ torrents, trackerTags = [], height = 320 }: FleetAgeTimelineProps) {
  const validTorrents = torrents.filter((t) => t.addedOn && t.addedOn > 0)

  if (validTorrents.length === 0) {
    return <ChartEmptyState height={height} message="No torrent addition data available" />
  }

  const { sortedMonths, series } = groupByMonth(validTorrents, trackerTags)

  if (sortedMonths.length === 0 || series.length === 0) {
    return <ChartEmptyState height={height} message="No torrent addition data available" />
  }

  return (
    <ChartECharts
      option={buildStackedAreaOption(sortedMonths, series, "age")}
      style={{ height, width: "100%" }}
    />
  )
}

export type { FleetAgeTimelineProps }
export { FleetAgeTimeline, groupByMonth }
