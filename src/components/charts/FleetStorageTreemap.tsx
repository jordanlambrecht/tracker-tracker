// src/components/charts/FleetStorageTreemap.tsx
//
// Functions: goldenAngleColor, groupTorrentsForTreemap, buildFleetStorageTreemapOption, FleetStorageTreemap

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import type { TorrentRaw } from "@/lib/fleet"
import { formatBytesNum } from "@/lib/formatters"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartTooltip, escHtml } from "./theme"

interface FleetStorageTreemapProps {
  torrents: TorrentRaw[]
  trackerTags: string[]
  height?: number
}

const GOLDEN_ANGLE = 137.508

function goldenAngleColor(index: number): string {
  const hue = (index * GOLDEN_ANGLE) % 360
  return `hsl(${hue.toFixed(1)}, 65%, 55%)`
}

interface TreemapNode {
  name: string
  value?: number
  children?: TreemapNode[]
  itemStyle?: { color: string }
  upperLabel?: { show: boolean; color: string }
}

function groupTorrentsForTreemap(
  torrents: TorrentRaw[],
  trackerTags: string[]
): TreemapNode[] {
  const tagSetLower = trackerTags.map((t) => t.toLowerCase())

  const trackerMap = new Map<string, Map<string, number>>()

  for (const torrent of torrents) {
    const torrentTagList = torrent.tags
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

    const matchedTag = tagSetLower.find((tag) => torrentTagList.includes(tag))
    const trackerKey = matchedTag ?? "__other__"
    const categoryKey = torrent.category || "(uncategorized)"

    if (!trackerMap.has(trackerKey)) {
      trackerMap.set(trackerKey, new Map())
    }
    const catMap = trackerMap.get(trackerKey)
    if (catMap) {
      catMap.set(categoryKey, (catMap.get(categoryKey) ?? 0) + torrent.size)
    }
  }

  const nodes: TreemapNode[] = []
  let colorIndex = 0

  for (const [trackerKey, catMap] of trackerMap.entries()) {
    const displayName =
      trackerKey === "__other__"
        ? "Other"
        : trackerTags.find((t) => t.toLowerCase() === trackerKey) ?? trackerKey

    const trackerColor = goldenAngleColor(colorIndex++)
    const totalSize = Array.from(catMap.values()).reduce((a, b) => a + b, 0)

    const children: TreemapNode[] = Array.from(catMap.entries()).map(
      ([category, size]) => ({
        name: category,
        value: size,
        itemStyle: { color: trackerColor },
      })
    )

    nodes.push({
      name: displayName,
      value: totalSize,
      children,
      itemStyle: { color: trackerColor },
      upperLabel: { show: true, color: CHART_THEME.textPrimary },
    })
  }

  return nodes
}

function buildFleetStorageTreemapOption(nodes: TreemapNode[]): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as {
          name: string
          value: number
          treePathInfo: { name: string }[]
          color: string
        }
        const path = p.treePathInfo.map((n) => escHtml(n.name)).join(" › ")
        return (
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${path}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${formatBytesNum(p.value)}</span>`
        )
      },
    }),
    series: [
      {
        type: "treemap",
        data: nodes,
        nodeClick: "zoomToNode",
        roam: false,
        breadcrumb: {
          show: true,
          bottom: 4,
          height: 22,
          itemStyle: {
            color: CHART_THEME.elevated,
            borderColor: CHART_THEME.borderEmphasis,
            borderWidth: 1,
            shadowBlur: 0,
            textStyle: {
              color: CHART_THEME.textSecondary,
              fontFamily: CHART_THEME.fontMono,
              fontSize: 11,
            },
          },
          emphasis: {
            itemStyle: {
              textStyle: { color: CHART_THEME.textPrimary },
            },
          },
        },
        upperLabel: {
          show: true,
          height: 24,
          color: CHART_THEME.textPrimary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 11,
          fontWeight: "bold",
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number }
            return `${p.name}  ${formatBytesNum(p.value)}`
          },
        },
        label: {
          show: true,
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 10,
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number }
            return `${p.name}\n${formatBytesNum(p.value)}`
          },
        },
        levels: [
          {
            itemStyle: {
              borderWidth: 3,
              borderColor: CHART_THEME.controlBg,
              gapWidth: 3,
            },
          },
          {
            itemStyle: {
              borderWidth: 1,
              borderColor: CHART_THEME.gridLine,
              gapWidth: 2,
            },
          },
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0,0,0,0.4)",
          },
        },
      },
    ],
  }
}

function FleetStorageTreemap({
  torrents,
  trackerTags,
  height = 400,
}: FleetStorageTreemapProps) {
  if (torrents.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  const nodes = groupTorrentsForTreemap(torrents, trackerTags)

  if (nodes.length === 0) {
    return <ChartEmptyState height={height} message="No storage data to display" />
  }

  return (
    <ReactECharts
      option={buildFleetStorageTreemapOption(nodes)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export type { FleetStorageTreemapProps }
export { FleetStorageTreemap, goldenAngleColor, groupTorrentsForTreemap }
