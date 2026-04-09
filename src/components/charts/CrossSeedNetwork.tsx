// src/components/charts/CrossSeedNetwork.tsx

"use client"

import type { EChartsOption } from "echarts"
import { useMemo } from "react"
import { hexToRgba } from "@/lib/color-utils"
import type { CrossSeedEdge, CrossSeedNode } from "@/lib/fleet-aggregation"
import { formatCount } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { fmtNum } from "./lib/chart-helpers"
import { CHART_THEME, chartTooltip, escHtml } from "./lib/theme"

interface CrossSeedNetworkProps {
  network: { nodes: CrossSeedNode[]; edges: CrossSeedEdge[] }
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

function buildStyledNodes(aggregatedNodes: CrossSeedNode[]): NetworkNode[] {
  const maxCount = Math.max(...aggregatedNodes.map((n) => n.torrentCount), 1)
  return aggregatedNodes.map((n) => {
    const sizeFactor = Math.sqrt(n.torrentCount / maxCount)
    const nodeSize = Math.max(20, sizeFactor * 60)
    return {
      id: n.id,
      name: n.name,
      symbolSize: nodeSize,
      torrentCount: n.torrentCount,
      crossSeeded: n.crossSeeded,
      itemStyle: { color: n.color, shadowBlur: 20, shadowColor: hexToRgba(n.color, 0.5) },
      label: {
        show: true,
        color: CHART_THEME.textSecondary,
        fontSize: CHART_THEME.fontSizeDense,
        fontFamily: CHART_THEME.fontMono,
      },
    }
  })
}

function buildStyledEdges(aggregatedEdges: CrossSeedEdge[]): NetworkEdge[] {
  const maxShared = Math.max(...aggregatedEdges.map((e) => e.weight), 1)
  return aggregatedEdges.map((e) => {
    const widthFactor = Math.sqrt(e.weight / maxShared)
    return {
      source: e.source,
      target: e.target,
      sharedCount: e.weight,
      lineStyle: {
        width: Math.max(1, widthFactor * 8),
        color: CHART_THEME.textTertiary,
        curveness: 0.2,
        opacity: 0.3 + widthFactor * 0.5,
      },
    }
  })
}

function buildCrossSeedNetworkOption(nodes: NetworkNode[], edges: NetworkEdge[]): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as {
          dataType: "node" | "edge"
          data: NetworkNode | NetworkEdge
          name: string
        }

        if (p.dataType === "edge") {
          const edge = p.data as NetworkEdge
          const srcName = nodes.find((n) => n.id === edge.source)?.name ?? edge.source
          const tgtName = nodes.find((n) => n.id === edge.target)?.name ?? edge.target
          return (
            `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(srcName)} ↔ ${escHtml(tgtName)}</span><br/>` +
            `<span style="color:${CHART_THEME.accent};">${formatCount(edge.sharedCount)} shared torrent${edge.sharedCount !== 1 ? "s" : ""}</span>`
          )
        }

        const node = p.data as NetworkNode
        const pct =
          node.torrentCount > 0 ? fmtNum((node.crossSeeded / node.torrentCount) * 100, 1) : "0.0"
        return (
          `<span style="color:${node.itemStyle.color};font-weight:600;">${escHtml(node.name)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${formatCount(node.torrentCount)} torrents</span><br/>` +
          `<span style="color:${CHART_THEME.accent};">${formatCount(node.crossSeeded)} cross-seeded</span>` +
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

function CrossSeedNetwork({ network, height = 450 }: CrossSeedNetworkProps) {
  const { nodes: aggregatedNodes, edges: aggregatedEdges } = network

  const option = useMemo(() => {
    const nodes = buildStyledNodes(aggregatedNodes)
    const edges = buildStyledEdges(aggregatedEdges)
    return buildCrossSeedNetworkOption(nodes, edges)
  }, [aggregatedNodes, aggregatedEdges])

  if (aggregatedNodes.length === 0)
    return <ChartEmptyState height={height} message="No torrent data available" />
  if (aggregatedEdges.length === 0)
    return <ChartEmptyState height={height} message="No cross-seeded content detected" />

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { CrossSeedNetworkProps }
export { CrossSeedNetwork }
