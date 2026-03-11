// src/components/charts/TagGroupBreakdownChart.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { hexToRgba } from "@/lib/formatters"
import type { TagGroupChartType } from "@/types/api"
import { CHART_THEME, chartAxisLabel, chartTooltip } from "./theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagGroupBreakdownChartProps {
  groupName: string
  members: { label: string; count: number; color: string | null }[]
  accentColor: string
  chartType?: TagGroupChartType
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function memberColor(
  accentColor: string,
  member: { color: string | null },
  index: number,
  total: number,
): string {
  if (member.color) return member.color
  const opacity = Math.max(0.4, 1 - index * (0.6 / Math.max(total - 1, 1)))
  return hexToRgba(accentColor, opacity)
}

// ---------------------------------------------------------------------------
// Bar chart option
// ---------------------------------------------------------------------------

function barOption(
  members: TagGroupBreakdownChartProps["members"],
  accentColor: string,
): EChartsOption {
  const reversedMembers = [...members].reverse()

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", {
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const p = params as Array<{ name: string; value: number }>
        if (!p.length) return ""
        const item = p[0]
        return `<span style="font-family:${CHART_THEME.fontMono}">${item.name}: <b>${item.value}</b></span>`
      },
    }),
    grid: { left: 100, right: 48, top: 8, bottom: 8, containLabel: false },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisLabel: chartAxisLabel(),
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: reversedMembers.map((m) => m.label),
      axisLabel: {
        color: CHART_THEME.textSecondary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
        width: 90,
        overflow: "truncate",
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: reversedMembers.map((m, i) => {
          const originalIndex = members.length - 1 - i
          return {
            value: m.count,
            itemStyle: {
              color: memberColor(accentColor, m, originalIndex, members.length),
              borderRadius: [0, 4, 4, 0],
            },
          }
        }),
        barWidth: "60%",
        label: {
          show: true,
          position: "right",
          formatter: "{c}",
          fontFamily: CHART_THEME.fontMono,
          fontSize: 10,
          color: CHART_THEME.textSecondary,
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Donut chart option
// ---------------------------------------------------------------------------

function donutOption(
  members: TagGroupBreakdownChartProps["members"],
  accentColor: string,
): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number }
        return `<span style="font-family:${CHART_THEME.fontMono}">${p.name}: <b>${p.value}</b> (${p.percent}%)</span>`
      },
    }),
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#282a36", borderWidth: 2, borderRadius: 4 },
        label: {
          show: true,
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 10,
          formatter: "{b}: {c}",
        },
        labelLine: {
          lineStyle: { color: CHART_THEME.textTertiary },
        },
        emphasis: {
          label: { fontSize: 12, fontWeight: "bold", color: CHART_THEME.textPrimary },
        },
        data: members.map((m, i) => ({
          name: m.label,
          value: m.count,
          itemStyle: {
            color: memberColor(accentColor, m, i, members.length),
          },
        })),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Treemap chart option
// ---------------------------------------------------------------------------

function treemapOption(
  members: TagGroupBreakdownChartProps["members"],
  accentColor: string,
): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number }
        return `<span style="font-family:${CHART_THEME.fontMono}">${p.name}: <b>${p.value}</b></span>`
      },
    }),
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: {
          show: true,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 11,
          color: CHART_THEME.textPrimary,
          formatter: "{b}\n{c}",
        },
        itemStyle: {
          borderColor: "#282a36",
          borderWidth: 2,
          gapWidth: 2,
        },
        levels: [
          {
            itemStyle: { borderWidth: 0, gapWidth: 2 },
          },
        ],
        data: members.map((m, i) => ({
          name: m.label,
          value: m.count,
          itemStyle: {
            color: memberColor(accentColor, m, i, members.length),
          },
        })),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TagGroupBreakdownChart({
  members,
  accentColor,
  chartType = "bar",
}: TagGroupBreakdownChartProps) {
  if (members.length === 0) return null

  let option: EChartsOption
  let height: number

  switch (chartType) {
    case "donut":
      option = donutOption(members, accentColor)
      height = 240
      break
    case "treemap":
      option = treemapOption(members, accentColor)
      height = 240
      break
    default:
      option = barOption(members, accentColor)
      height = Math.max(120, members.length * 36 + 40)
      break
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

export { TagGroupBreakdownChart }
export type { TagGroupBreakdownChartProps }
