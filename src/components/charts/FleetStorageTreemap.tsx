// src/components/charts/FleetStorageTreemap.tsx
//
// Functions: buildFleetStorageTreemapOption, FleetStorageTreemap

"use client"

import type { EChartsOption } from "echarts"
import { useMemo } from "react"
import type { TrackerCategoryStorage } from "@/lib/fleet-aggregation"
import { formatBytesNum } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildTagColors, CHART_THEME, chartTooltip, escHtml } from "./lib/theme"

interface FleetStorageTreemapProps {
  data: TrackerCategoryStorage[]
  height?: number
}

interface TreemapNode {
  name: string
  value?: number
  children?: TreemapNode[]
  itemStyle?: { color: string }
  upperLabel?: { show: boolean; color: string }
}

function buildTreemapNodes(data: TrackerCategoryStorage[]): TreemapNode[] {
  const trackerNames = data.map((d) => d.tracker)
  const colorMap = buildTagColors(trackerNames)

  const nodes: TreemapNode[] = []
  for (const d of data) {
    const trackerColor = colorMap.get(d.tracker) ?? CHART_THEME.chartFallback
    const totalSize = d.categories.reduce((sum, c) => sum + c.totalSize, 0)
    if (totalSize === 0) continue

    const children: TreemapNode[] = d.categories.map((c) => ({
      name: c.name,
      value: c.totalSize,
      itemStyle: { color: trackerColor },
    }))

    nodes.push({
      name: d.tracker,
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
              fontSize: CHART_THEME.fontSizeDense,
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
          fontSize: CHART_THEME.fontSizeDense,
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
          fontSize: CHART_THEME.fontSizeCompact,
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

function FleetStorageTreemap({ data, height = 400 }: FleetStorageTreemapProps) {
  const { nodes, option } = useMemo(() => {
    const n = buildTreemapNodes(data)
    return { nodes: n, option: buildFleetStorageTreemapOption(n) }
  }, [data])

  if (data.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  if (nodes.length === 0) {
    return <ChartEmptyState height={height} message="No storage data to display" />
  }

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { FleetStorageTreemapProps }
export { FleetStorageTreemap }
