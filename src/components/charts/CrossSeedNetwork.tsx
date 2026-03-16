// src/components/charts/CrossSeedNetwork.tsx
//
// Functions: buildNetworkData, buildCrossSeedNetworkOption, CrossSeedNetwork

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import type { TorrentRaw, TrackerTag } from "@/lib/fleet"
import { hexToRgba } from "@/lib/formatters"
import { ChartEmptyState } from "./ChartEmptyState"
import { fmtNum } from "./chart-helpers"
import { CHART_THEME, chartTooltip, escHtml } from "./theme"

interface CrossSeedNetworkProps {
  torrents: TorrentRaw[]
  trackerTags: TrackerTag[]
  crossSeedTags: string[]
  height?: number
}

interface NetworkNode {
  id: string
  name: string
  symbolSize: number
  itemStyle: { color: string; shadowBlur: number; shadowColor: string }
  label: { show: boolean; color: string; fontSize: number; fontFamily: string }
  torrentCount: number
  crossSeeded: number
}

interface NetworkEdge {
  source: string
  target: string
  sharedCount: number
  lineStyle: { width: number; color: string; curveness: number; opacity: number }
}

function buildNetworkData(
  torrents: TorrentRaw[],
  trackerTags: TrackerTag[],
  crossSeedTags: string[]
): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const crossSeedSet = new Set(crossSeedTags.map((t) => t.toLowerCase()))
  const trackerTagMap = new Map<string, TrackerTag>()
  for (const tt of trackerTags) trackerTagMap.set(tt.tag.toLowerCase(), tt)

  const nameToTrackers = new Map<string, Set<string>>()
  const trackerTorrentCount = new Map<string, number>()

  for (const torrent of torrents) {
    const tags = torrent.tags.split(",").map((t) => t.trim().toLowerCase()).filter((t) => t && !crossSeedSet.has(t))
    const matched = tags.filter((t) => trackerTagMap.has(t))
    if (matched.length === 0) continue
    for (const tag of matched) trackerTorrentCount.set(tag, (trackerTorrentCount.get(tag) ?? 0) + 1)
    const existing = nameToTrackers.get(torrent.name) ?? new Set()
    for (const tag of matched) existing.add(tag)
    nameToTrackers.set(torrent.name, existing)
  }

  const crossSeededPerTracker = new Map<string, number>()
  const pairCounts = new Map<string, number>()

  for (const [, trackerSet] of nameToTrackers) {
    if (trackerSet.size < 2) continue
    const arr = Array.from(trackerSet).sort()
    for (const t of arr) crossSeededPerTracker.set(t, (crossSeededPerTracker.get(t) ?? 0) + 1)
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = `${arr[i]}|${arr[j]}`
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }

  const maxCount = Math.max(...Array.from(trackerTorrentCount.values()), 1)
  const nodes: NetworkNode[] = []

  for (const [tagKey, tt] of trackerTagMap) {
    const count = trackerTorrentCount.get(tagKey) ?? 0
    if (count === 0) continue
    const crossCount = crossSeededPerTracker.get(tagKey) ?? 0
    const sizeFactor = Math.sqrt(count / maxCount)
    const nodeSize = Math.max(20, sizeFactor * 60)

    nodes.push({
      id: tagKey,
      name: tt.name,
      symbolSize: nodeSize,
      torrentCount: count,
      crossSeeded: crossCount,
      itemStyle: { color: tt.color, shadowBlur: 20, shadowColor: hexToRgba(tt.color, 0.5) },
      label: {
        show: true,
        color: CHART_THEME.textSecondary,
        fontSize: 11,
        fontFamily: CHART_THEME.fontMono,
      },
    })
  }

  const maxShared = Math.max(...Array.from(pairCounts.values()), 1)
  const edges: NetworkEdge[] = []

  for (const [key, count] of pairCounts) {
    const [source, target] = key.split("|")
    const widthFactor = Math.sqrt(count / maxShared)
    edges.push({
      source,
      target,
      sharedCount: count,
      lineStyle: {
        width: Math.max(1, widthFactor * 8),
        color: CHART_THEME.textTertiary,
        curveness: 0.2,
        opacity: 0.3 + widthFactor * 0.5,
      },
    })
  }

  return { nodes, edges }
}

function buildCrossSeedNetworkOption(nodes: NetworkNode[], edges: NetworkEdge[]): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { dataType: "node" | "edge"; data: NetworkNode | NetworkEdge; name: string }

        if (p.dataType === "edge") {
          const edge = p.data as NetworkEdge
          const srcName = nodes.find((n) => n.id === edge.source)?.name ?? edge.source
          const tgtName = nodes.find((n) => n.id === edge.target)?.name ?? edge.target
          return (
            `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(srcName)} ↔ ${escHtml(tgtName)}</span><br/>` +
            `<span style="color:${CHART_THEME.accent};">${edge.sharedCount.toLocaleString()} shared torrent${edge.sharedCount !== 1 ? "s" : ""}</span>`
          )
        }

        const node = p.data as NetworkNode
        const pct = node.torrentCount > 0 ? fmtNum((node.crossSeeded / node.torrentCount) * 100, 1) : "0.0"
        return (
          `<span style="color:${node.itemStyle.color};font-weight:600;">${escHtml(node.name)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${node.torrentCount.toLocaleString()} torrents</span><br/>` +
          `<span style="color:${CHART_THEME.accent};">${node.crossSeeded.toLocaleString()} cross-seeded</span>` +
          `<span style="color:${CHART_THEME.textTertiary};"> · ${pct}%</span>`
        )
      },
    }),
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        animation: true,
        animationDuration: 1500,
        animationEasingUpdate: "quinticInOut",
        scaleLimit: { min: 0.5, max: 3 },
        data: nodes,
        edges,
        force: {
          initLayout: "circular",
          repulsion: [80, 300],
          edgeLength: [60, 200],
          gravity: 0.15,
          friction: 0.6,
          layoutAnimation: true,
        },
        label: { position: "bottom", distance: 8 },
        emphasis: {
          focus: "adjacency",
          lineStyle: { width: 4, opacity: 0.9 },
          itemStyle: { shadowBlur: 30 },
        },
        blur: {
          itemStyle: { opacity: 0.15 },
          lineStyle: { opacity: 0.05 },
        },
      },
    ],
  }
}

function CrossSeedNetwork({ torrents, trackerTags, crossSeedTags, height = 450 }: CrossSeedNetworkProps) {
  if (trackerTags.length === 0) return <ChartEmptyState height={height} message="No tracker tags configured" />

  const { nodes, edges } = buildNetworkData(torrents, trackerTags, crossSeedTags)

  if (nodes.length === 0) return <ChartEmptyState height={height} message="No torrent data available" />
  if (edges.length === 0) return <ChartEmptyState height={height} message="No cross-seeded content detected" />

  return (
    <ReactECharts
      option={buildCrossSeedNetworkOption(nodes, edges)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export type { CrossSeedNetworkProps }
export { CrossSeedNetwork }
