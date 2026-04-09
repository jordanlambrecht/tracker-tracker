// src/components/charts/FleetCategoryBreakdown.tsx
"use client"

import type { EChartsOption } from "echarts"
import { useMemo } from "react"
import type { TrackerCategoryCount } from "@/lib/fleet-aggregation"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { fmtNum } from "./lib/chart-helpers"
import {
  CHART_THEME,
  chartAxisLabel,
  chartLegend,
  chartTooltip,
  chartTooltipRow,
  escHtml,
} from "./lib/theme"

interface FleetCategoryBreakdownProps {
  data: TrackerCategoryCount[]
  height?: number
}

function buildFleetCategoryBreakdownOption(
  trackerNames: string[],
  categories: string[],
  categoryColors: string[],
  // tracker name -> category -> count
  data: Map<string, Map<string, number>>
): EChartsOption {
  const series: NonNullable<EChartsOption["series"]> = categories.map((cat, catIndex) => {
    const seriesData: number[] = trackerNames.map((tracker) => {
      const trackerCats = data.get(tracker)
      if (!trackerCats) return 0
      const total = Array.from(trackerCats.values()).reduce((a, b) => a + b, 0)
      const count = trackerCats.get(cat) ?? 0
      return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
    })

    return {
      name: cat,
      type: "bar",
      stack: "total",
      barWidth: 20,
      itemStyle: {
        color: categoryColors[catIndex],
        borderRadius: catIndex === categories.length - 1 ? [2, 2, 0, 0] : 0,
      },
      label: { show: false },
      emphasis: {
        itemStyle: {
          shadowBlur: 8,
          shadowColor: "rgba(0,0,0,0.3)",
        },
        label: {
          show: true,
          position: "inside",
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeMicro,
          color: CHART_THEME.textPrimary,
          formatter: (params: unknown) => {
            const p = params as { value: number }
            return p.value >= 5 ? `${fmtNum(p.value, 1)}%` : ""
          },
        },
      },
      data: seriesData,
    }
  })

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", {
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number
          axisValueLabel: string
          color: string
        }>
        if (!items?.length) return ""
        const trackerLabel = items[0].axisValueLabel
        const rows = items
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((item) => chartTooltipRow(item.color, item.seriesName, `${fmtNum(item.value, 1)}%`))
          .join("<br/>")
        return `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(trackerLabel)}</span><br/>${rows}`
      },
    }),
    legend: chartLegend({ data: categories }),
    grid: {
      left: 48,
      right: 16,
      top: 48,
      bottom: 16,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: trackerNames,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: trackerNames.length > 8 ? 30 : 0 }),
    },
    yAxis: {
      type: "value",
      max: 100,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => `${val}%`,
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    series,
  }
}

const CATEGORY_PALETTE = [
  CHART_THEME.accent,
  CHART_THEME.warn,
  CHART_THEME.danger,
  CHART_THEME.success,
  ...CHART_THEME.scale,
]

function FleetCategoryBreakdown({ data, height = 360 }: FleetCategoryBreakdownProps) {
  const option = useMemo(() => {
    const trackerNames = data.map((d) => d.tracker)

    const allCategories = new Set<string>()
    for (const entry of data) {
      for (const { name } of entry.categories) allCategories.add(name)
    }
    const categories = Array.from(allCategories).sort()
    const categoryColors = categories.map((_, i) => CATEGORY_PALETTE[i % CATEGORY_PALETTE.length])

    const dataMap = new Map<string, Map<string, number>>()
    for (const entry of data) {
      const catMap = new Map<string, number>()
      for (const { name, count } of entry.categories) catMap.set(name, count)
      dataMap.set(entry.tracker, catMap)
    }

    return buildFleetCategoryBreakdownOption(trackerNames, categories, categoryColors, dataMap)
  }, [data])

  if (data.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { FleetCategoryBreakdownProps }
export { FleetCategoryBreakdown }
