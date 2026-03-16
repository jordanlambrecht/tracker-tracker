// src/components/charts/TorrentCategoryDonut.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { CHART_THEME, chartDot, chartTooltip, escHtml } from "@/components/charts/theme"
import { formatBytesNum, generatePalette } from "@/lib/formatters"
import type { CategoryStats } from "@/lib/torrent-utils"
import { ChartEmptyState } from "./ChartEmptyState"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TorrentCategoryDonutProps {
  categories: CategoryStats[]
  accentColor: string
}

export function TorrentCategoryDonut({ categories, accentColor }: TorrentCategoryDonutProps) {
  if (categories.length === 0) {
    return <ChartEmptyState height={320} message="No category data" />
  }

  const sorted = [...categories].sort((a, b) => b.count - a.count)
  const palette = generatePalette(sorted.length, accentColor)
  const total = sorted.reduce((sum, c) => sum + c.count, 0)

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number; color: string }
        const cat = sorted.find((c) => c.name === p.name)
        if (!cat) return ""
        return [
          `${chartDot(p.color)}<span style="color:${p.color};font-weight:600;">${escHtml(p.name)}</span>`,
          `Torrents: ${cat.count} (${p.percent.toFixed(1)}%)`,
          `Size: ${formatBytesNum(cat.totalSize)}`,
        ].join("<br/>")
      },
    }),
    legend: {
      orient: "vertical",
      right: 0,
      top: "middle",
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 8,
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
        },
        label: {
          show: true,
          position: "center",
          formatter: `{total|${total}}\n{label|torrents}`,
          rich: {
            total: {
              fontSize: 22,
              fontWeight: "bold",
              fontFamily: CHART_THEME.fontMono,
              color: CHART_THEME.textPrimary,
              lineHeight: 30,
            },
            label: {
              fontSize: 11,
              fontFamily: CHART_THEME.fontMono,
              color: CHART_THEME.textTertiary,
              lineHeight: 16,
            },
          },
        },
        emphasis: {
          label: { show: true },
          itemStyle: {
            shadowBlur: 12,
            shadowColor: "rgba(0,0,0,0.3)",
          },
        },
        data: sorted.map((cat, i) => ({
          name: cat.name,
          value: cat.count,
          itemStyle: { color: palette[i % palette.length] },
        })),
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 320, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
