// src/components/charts/StorageSunburst.tsx
//
// Functions: StorageSunburst, buildOption

"use client"

import type { EChartsOption } from "echarts"
import { formatBytesNum, generatePalette, hexToHsl, hslToHex } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { CHART_THEME, chartDot, chartTooltip, escHtml } from "./lib/theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StorageSunburstProps {
  torrents: { name: string; size: number; category: string }[]
  accentColor: string
  height?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sliceColor(categoryColor: string, index: number, total: number): string {
  const [h, s, l] = hexToHsl(categoryColor)
  const spread = total > 1 ? 0.2 / (total - 1) : 0
  const offset = total > 1 ? index * spread - 0.1 : 0
  return hslToHex(h, s, Math.min(Math.max(l + offset, 0.25), 0.85))
}

// ---------------------------------------------------------------------------
// Option builder
// ---------------------------------------------------------------------------

function buildOption(
  torrents: StorageSunburstProps["torrents"],
  accentColor: string
): EChartsOption {
  const categoryMap = new Map<string, { total: number; items: { name: string; size: number }[] }>()

  for (const t of torrents) {
    const key = t.category || "(no category)"
    const entry = categoryMap.get(key) ?? { total: 0, items: [] }
    entry.total += t.size
    entry.items.push({ name: t.name, size: t.size })
    categoryMap.set(key, entry)
  }

  const sortedCategories = [...categoryMap.entries()].sort(([, a], [, b]) => b.total - a.total)

  const categoryColors = generatePalette(sortedCategories.length, accentColor)

  const treemapData = sortedCategories.map(([catName, catData], catIdx) => {
    const catColor = categoryColors[catIdx]
    const sortedItems = [...catData.items].sort((a, b) => b.size - a.size)

    return {
      name: catName,
      value: catData.total,
      itemStyle: {
        color: catColor,
        borderColor: CHART_THEME.surface,
        borderWidth: 2,
        gapWidth: 1,
      },
      children: sortedItems.map((item, itemIdx) => ({
        name: item.name,
        value: item.size,
        itemStyle: {
          color: sliceColor(catColor, itemIdx, sortedItems.length),
          borderColor: CHART_THEME.surface,
          borderWidth: 1,
        },
      })),
    }
  })

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as {
          name: string
          value: number
          treePathInfo?: Array<{ name: string; value: number }>
          color?: string
        }
        const path = p.treePathInfo ?? []
        const itemColor = p.color ?? accentColor
        const swatch = chartDot(itemColor)

        // Leaf node (torrent)
        if (path.length === 3) {
          const catName = path[1].name
          return (
            `${swatch}` +
            `<span style="color:${CHART_THEME.textTertiary};font-size:${CHART_THEME.fontSizeCompact}px;">${escHtml(catName)}</span><br/>` +
            `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(p.name)}</span><br/>` +
            `<span style="color:${CHART_THEME.textSecondary};">${formatBytesNum(p.value)}</span>`
          )
        }

        // Category node
        if (path.length === 2) {
          const childCount = treemapData.find((d) => d.name === p.name)?.children.length ?? 0
          return (
            `${swatch}` +
            `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(p.name)}</span><br/>` +
            `<span style="color:${CHART_THEME.textSecondary};">${formatBytesNum(p.value)}</span>` +
            `<span style="color:${CHART_THEME.textTertiary};font-size:${CHART_THEME.fontSizeCompact}px;"> · ${childCount} torrent${childCount !== 1 ? "s" : ""}</span>`
          )
        }

        return `<span style="color:${CHART_THEME.textPrimary};">${escHtml(p.name)}: ${formatBytesNum(p.value)}</span>`
      },
    }),
    series: [
      {
        type: "treemap",
        data: treemapData,
        width: "100%",
        height: "100%",
        roam: false,
        nodeClick: "zoomToNode" as const,
        breadcrumb: {
          show: true,
          bottom: 4,
          itemStyle: {
            color: CHART_THEME.overlay,
            borderColor: CHART_THEME.borderEmphasis,
            shadowBlur: 0,
          },
          textStyle: {
            color: CHART_THEME.textSecondary,
            fontFamily: CHART_THEME.fontMono,
            fontSize: CHART_THEME.fontSizeDense,
          },
        },
        upperLabel: {
          show: true,
          height: 24,
          color: CHART_THEME.textPrimary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeDense,
          fontWeight: "bold" as const,
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number }
            return `${p.name}  ${formatBytesNum(p.value)}`
          },
        },
        label: {
          show: true,
          color: CHART_THEME.textTertiary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeMicro,
          formatter: "{b}",
          position: "insideTopLeft" as const,
        },
        itemStyle: {
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
          gapWidth: 2,
        },
        levels: [
          {
            itemStyle: {
              borderColor: CHART_THEME.surface,
              borderWidth: 3,
              gapWidth: 3,
            },
            upperLabel: { show: true },
          },
          {
            itemStyle: {
              borderColor: CHART_THEME.surface,
              borderWidth: 1,
              gapWidth: 1,
            },
            label: { show: true },
          },
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 12,
            shadowColor: "rgba(0,0,0,0.4)",
          },
          upperLabel: {
            show: true,
            color: CHART_THEME.textPrimary,
          },
        },
      },
    ],
  } as EChartsOption
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function StorageSunburst({ torrents, accentColor, height = 480 }: StorageSunburstProps) {
  if (torrents.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  const totalSize = torrents.reduce((sum, t) => sum + t.size, 0)
  if (totalSize === 0) {
    return <ChartEmptyState height={height} message="All torrents report zero size" />
  }

  return (
    <ChartECharts option={buildOption(torrents, accentColor)} style={{ height, width: "100%" }} />
  )
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type { StorageSunburstProps }
export { StorageSunburst }
