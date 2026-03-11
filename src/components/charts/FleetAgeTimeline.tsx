// src/components/charts/FleetAgeTimeline.tsx
//
// Functions: formatDateLabel, groupByDate, buildFleetAgeTimelineOption, FleetAgeTimeline

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import type { TrackerTag } from "@/lib/fleet"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartGrid, chartDot, chartLegend, chartTooltip, chartTooltipHeader, escHtml } from "./theme"

interface FleetAgeTimelineProps {
  torrents: { added_on: number; tags: string }[]
  trackerTags?: TrackerTag[]
  height?: number
}

interface SeriesData {
  name: string
  color: string
  dateMap: Map<string, number>
}

function formatDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function groupByDate(
  torrents: { added_on: number; tags: string }[],
  trackerTags: TrackerTag[]
): { sortedDates: string[]; series: SeriesData[] } {
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
      dateMap: new Map(),
    })
  }

  const otherSeries: SeriesData = {
    name: "Other",
    color: CHART_THEME.textTertiary,
    dateMap: new Map(),
  }

  const allDates = new Set<string>()

  for (const torrent of torrents) {
    if (!torrent.added_on || torrent.added_on <= 0) continue
    const date = new Date(torrent.added_on * 1000).toISOString().slice(0, 10)
    allDates.add(date)

    const torrentTagList = torrent.tags
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const matchedEntry = tagSetLower.find((e) =>
      torrentTagList.includes(e.tagLower)
    )

    if (matchedEntry) {
      const series = seriesMap.get(matchedEntry.name)
      if (series) {
        series.dateMap.set(date, (series.dateMap.get(date) ?? 0) + 1)
      }
    } else {
      otherSeries.dateMap.set(date, (otherSeries.dateMap.get(date) ?? 0) + 1)
    }
  }

  const sortedDates = Array.from(allDates).sort()
  const series = [...seriesMap.values(), otherSeries].filter(
    (s) => s.dateMap.size > 0
  )

  return { sortedDates, series }
}

function buildFleetAgeTimelineOption(
  sortedDates: string[],
  series: SeriesData[]
): EChartsOption {
  const labels = sortedDates.map(formatDateLabel)

  const eChartsSeries: NonNullable<EChartsOption["series"]> = series.map(
    (s) => {
      let running = 0
      const data = sortedDates.map((date) => {
        running += s.dateMap.get(date) ?? 0
        return running
      })

      return {
        name: s.name,
        type: "line",
        stack: "age",
        smooth: true,
        symbol: "none",
        data,
        itemStyle: { color: s.color },
        lineStyle: { color: s.color, width: 1.5 },
        areaStyle: { color: s.color, opacity: 0.3 },
      }
    }
  )

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 32, right: 16, bottom: 48, left: 56 }),
    tooltip: chartTooltip("axis", {
      axisPointer: {
        type: "line",
        lineStyle: { color: CHART_THEME.borderMid, type: "dashed" },
      },
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number
          color: string
          axisValueLabel: string
        }>
        if (!items?.length) return ""
        const dateLabel = items[0].axisValueLabel
        const rows = items
          .filter((item) => item.value > 0)
          .map((item) => {
            const dot = chartDot(item.color)
            return `${dot}<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> <span style="color:${CHART_THEME.textPrimary};font-weight:600;">${item.value.toLocaleString()}</span>`
          })
          .join("<br/>")
        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    legend: chartLegend(),
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: sortedDates.length > 14 ? 30 : 0, interval: "auto" }),
    },
    yAxis: {
      type: "value",
      name: "Torrents",
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    series: eChartsSeries,
  }
}

function FleetAgeTimeline({
  torrents,
  trackerTags = [],
  height = 320,
}: FleetAgeTimelineProps) {
  const validTorrents = torrents.filter(
    (t) => t.added_on && t.added_on > 0
  )

  if (validTorrents.length === 0) {
    return (
      <ChartEmptyState height={height} message="No torrent addition data available" />
    )
  }

  const { sortedDates, series } = groupByDate(validTorrents, trackerTags)

  if (sortedDates.length === 0 || series.length === 0) {
    return (
      <ChartEmptyState height={height} message="No torrent addition data available" />
    )
  }

  return (
    <ReactECharts
      option={buildFleetAgeTimelineOption(sortedDates, series)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { FleetAgeTimeline, groupByDate, formatDateLabel }
export type { FleetAgeTimelineProps, TrackerTag }
