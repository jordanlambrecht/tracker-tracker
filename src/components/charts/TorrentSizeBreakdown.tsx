// src/components/charts/TorrentSizeBreakdown.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { CHART_THEME, escHtml } from "@/components/charts/theme"
import { formatBytesNum, generatePalette } from "@/lib/formatters"
import type { CategoryStats } from "@/lib/torrent-utils"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TorrentSizeBreakdownProps {
  categories: CategoryStats[]
  accentColor: string
}

export function TorrentSizeBreakdown({
  categories,
  accentColor,
}: TorrentSizeBreakdownProps) {
  if (categories.length === 0) {
    return <p className="text-sm text-muted font-mono py-4">No category data</p>
  }

  const top = categories.slice(0, 8)
  const palette = generatePalette(top.length, accentColor)

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number; color: string }[])[0]
        if (!p) return ""
        const cat = top.find((c) => c.name === p.name)
        return [
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;box-shadow:0 0 6px ${p.color};"></span><span style="font-weight:600;color:${p.color}">${escHtml(p.name)}</span>`,
          `Size: ${formatBytesNum(p.value)}`,
          cat ? `Torrents: ${cat.count}` : "",
        ].filter(Boolean).join("<br/>")
      },
    },
    grid: { left: 100, right: 24, top: 8, bottom: 8 },
    xAxis: {
      type: "value",
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
        formatter: (val: number) => formatBytesNum(val),
      },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    yAxis: {
      type: "category",
      data: top.map((c) => c.name).reverse(),
      axisLabel: {
        color: CHART_THEME.textSecondary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
        width: 80,
        overflow: "truncate",
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: top.map((c, i) => ({
          value: c.totalSize,
          itemStyle: { color: palette[i % palette.length], borderRadius: [0, 4, 4, 0] },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: palette[i % palette.length] } },
        })).reverse(),
        barWidth: "60%",
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(160, top.length * 36), width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
