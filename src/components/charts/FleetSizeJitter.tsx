// src/components/charts/FleetSizeJitter.tsx
//
// Functions: buildFleetSizeJitterOption, FleetSizeJitter

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { useMemo } from "react"
import type { TorrentRaw, TrackerTag } from "@/lib/fleet"
import { parseTorrentTags } from "@/lib/fleet"
import { hexToRgba } from "@/lib/formatters"
import { ChartEmptyState } from "./ChartEmptyState"
import { autoByteScale, fmtNum } from "./chart-helpers"
import { CHART_THEME, chartAxisLabel, chartTooltip, escHtml } from "./theme"

interface FleetSizeJitterProps {
  torrents: TorrentRaw[]
  trackerTags: TrackerTag[]
  height?: number
}

function buildFleetSizeJitterOption(
  trackerTags: TrackerTag[],
  trackerData: Map<string, { sizes: number[]; color: string }>
): EChartsOption {
  const trackerNames = trackerTags
    .filter((t) => trackerData.has(t.tag.toLowerCase()))
    .map((t) => t.name)

  // Find max size for scaling
  let maxBytes = 0
  for (const [, data] of trackerData) {
    for (const s of data.sizes) {
      if (s > maxBytes) maxBytes = s
    }
  }
  const { divisor, unit } = autoByteScale(maxBytes / 1024 ** 3)
  const scaleDivisor = 1024 ** 3 * divisor

  // Build series — one scatter series per tracker for coloring
  const series: NonNullable<EChartsOption["series"]> = trackerTags
    .filter((t) => trackerData.has(t.tag.toLowerCase()))
    .map((tt, trackerIndex) => {
      const data = trackerData.get(tt.tag.toLowerCase())
      if (!data) return null

      // Gaussian jitter for beeswarm cloud — wide spread, clamped to avoid overlap with neighbors
      const points = data.sizes.map((sizeBytes) => {
        const u1 = Math.random()
        const u2 = Math.random()
        const gaussian = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2)
        const jitter = Math.max(-0.42, Math.min(0.42, gaussian * 0.25))
        return [trackerIndex + jitter, sizeBytes / scaleDivisor]
      })

      return {
        type: "scatter" as const,
        name: tt.name,
        data: points,
        symbolSize: 4,
        itemStyle: {
          color: tt.color,
          opacity: 0.45,
        },
        emphasis: {
          itemStyle: {
            opacity: 1,
            shadowBlur: 8,
            shadowColor: tt.color,
          },
        },
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { seriesName: string; value: [number, number]; color: string }
        return (
          `<span style="color:${p.color};font-weight:600;">${escHtml(p.seriesName)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${fmtNum(p.value[1])} ${unit}</span>`
        )
      },
    }),
    grid: {
      left: 64,
      right: 24,
      top: 16,
      bottom: 48,
    },
    xAxis: {
      type: "category",
      data: trackerNames,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        rotate: trackerNames.length > 8 ? 30 : 0,
        interval: 0,
      }),
    },
    yAxis: {
      type: "log",
      name: unit,
      min: 0.001,
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) =>
          val >= 1 ? fmtNum(val, 0) : val >= 0.01 ? fmtNum(val, 2) : fmtNum(val, 3),
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    legend: { show: false },
    dataZoom:
      trackerNames.length > 10
        ? [
            {
              type: "slider",
              xAxisIndex: 0,
              startValue: 0,
              endValue: 9,
              height: 20,
              bottom: 4,
              borderColor: CHART_THEME.gridLine,
              fillerColor: hexToRgba(CHART_THEME.accent, 0.09),
              handleStyle: { color: CHART_THEME.accent },
              textStyle: {
                color: CHART_THEME.textTertiary,
                fontFamily: CHART_THEME.fontMono,
                fontSize: 9,
              },
            },
            { type: "inside", xAxisIndex: 0 },
          ]
        : undefined,
    series,
  }
}

function FleetSizeJitter({ torrents, trackerTags, height = 360 }: FleetSizeJitterProps) {
  // Build trackerData map; memoized so Math.random() jitter only runs when data changes
  const trackerData = useMemo(() => {
    const map = new Map<string, { sizes: number[]; color: string }>()
    for (const tt of trackerTags) {
      map.set(tt.tag.toLowerCase(), { sizes: [], color: tt.color })
    }
    for (const torrent of torrents) {
      const tags = parseTorrentTags(torrent.tags)
      for (const tag of tags) {
        const entry = map.get(tag)
        if (entry) entry.sizes.push(torrent.size)
      }
    }
    for (const [key, data] of map) {
      if (data.sizes.length === 0) map.delete(key)
    }
    return map
  }, [torrents, trackerTags])

  // Memoize the full option so the jitter scatter points are stable across unrelated re-renders
  const option = useMemo(
    () => buildFleetSizeJitterOption(trackerTags, trackerData),
    [trackerData, trackerTags]
  )

  if (torrents.length === 0 || trackerTags.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  if (trackerData.size === 0) {
    return <ChartEmptyState height={height} message="No tagged torrents found" />
  }

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export type { FleetSizeJitterProps }
export { FleetSizeJitter }
