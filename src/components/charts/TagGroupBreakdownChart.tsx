// src/components/charts/TagGroupBreakdownChart.tsx
//
// Functions: memberColor, barOption, donutOption, treemapOption, TagGroupBreakdownChart, numbersNeedsWideCard

"use client"

import { SlotLabel } from "@typography"
import type { EChartsOption } from "echarts"
import { hexToRgba } from "@/lib/formatters"
import type { TagGroupChartType } from "@/types/api"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartTooltip } from "./lib/theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagGroupBreakdownChartProps {
  groupName: string
  members: { label: string; count: number; color: string | null }[]
  accentColor: string
  chartType?: TagGroupChartType
  countUnmatched?: boolean
  unmatchedCount?: number
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function memberColor(
  accentColor: string,
  member: { color: string | null },
  index: number,
  total: number
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
  accentColor: string
): EChartsOption {
  const reversedMembers = [...members].reverse()

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", {
      borderColor: accentColor,
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const p = params as Array<{ name: string; value: number }>
        if (!p.length) return ""
        const item = p[0]
        return `<span style="font-family:${CHART_THEME.fontMono}">${item.name}: <b>${item.value}</b></span>`
      },
    }),
    grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
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
        fontSize: CHART_THEME.fontSizeCompact,
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
          fontSize: CHART_THEME.fontSizeCompact,
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
  accentColor: string
): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      borderColor: accentColor,
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
        itemStyle: { borderColor: CHART_THEME.surface, borderWidth: 2, borderRadius: 4 },
        label: {
          show: true,
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeCompact,
          formatter: "{b}: {c}",
        },
        labelLine: {
          lineStyle: { color: CHART_THEME.textTertiary },
        },
        emphasis: {
          label: { fontSize: CHART_THEME.fontSizeSmall, fontWeight: "bold", color: CHART_THEME.textPrimary },
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
  accentColor: string
): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      borderColor: accentColor,
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
          fontSize: CHART_THEME.fontSizeDense,
          color: CHART_THEME.textPrimary,
          formatter: "{b}\n{c}",
        },
        itemStyle: {
          borderColor: CHART_THEME.surface,
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
  countUnmatched,
  unmatchedCount,
}: TagGroupBreakdownChartProps) {
  if (chartType === "numbers") {
    const items = [...members]
    if (countUnmatched && unmatchedCount != null) {
      items.push({ label: "Unmatched", count: unmatchedCount, color: CHART_THEME.textTertiary })
    }
    if (items.length === 0) return null

    const total = items.reduce((sum, m) => sum + m.count, 0)
    const maxCount = Math.max(...items.map((m) => m.count))

    // Single item: hero layout
    if (items.length === 1) {
      const m = items[0]
      const color = memberColor(accentColor, m, 0, 1)
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-6">
          <span className="font-mono text-5xl font-bold tabular-nums" style={{ color }}>
            {m.count.toLocaleString()}
          </span>
          <span className="text-sm font-sans font-medium text-secondary">{m.label}</span>
        </div>
      )
    }

    // 2+ items: stat tiles with proportional accent bars
    const gridCols =
      items.length <= 3
        ? "grid-cols-1 sm:grid-cols-3"
        : items.length <= 6
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"

    return (
      <div className="flex flex-col gap-3">
        <div className={`grid ${gridCols} gap-2`}>
          {items.map((m, i) => {
            const color = memberColor(accentColor, m, i, items.length)
            const pct = total > 0 ? (m.count / total) * 100 : 0
            const barWidth = maxCount > 0 ? (m.count / maxCount) * 100 : 0

            return (
              <div
                key={m.label}
                className="relative flex flex-col gap-1 p-3 nm-inset-sm rounded-nm-md overflow-hidden"
              >
                <SlotLabel label={m.label} className="leading-tight" />
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-lg font-semibold tabular-nums" style={{ color }}>
                    {m.count.toLocaleString()}
                  </span>
                  <span className="text-3xs font-mono text-tertiary">{pct.toFixed(0)}%</span>
                </div>
                {/* Proportional bar */}
                <div className="h-0.5 mt-0.5 rounded-full bg-control-bg">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        {/* Total footer */}
        <div className="flex justify-end px-1">
          <span className="text-3xs font-mono text-tertiary">
            Total: {total.toLocaleString()}
          </span>
        </div>
      </div>
    )
  }

  const allMembers = [...members]
  if (countUnmatched && unmatchedCount != null && unmatchedCount > 0) {
    allMembers.push({ label: "Untagged", count: unmatchedCount, color: CHART_THEME.textTertiary })
  }

  if (allMembers.length === 0) return <ChartEmptyState height={200} message="No data available." />

  let option: EChartsOption
  let height: number

  switch (chartType) {
    case "donut":
      option = donutOption(allMembers, accentColor)
      height = 240
      break
    case "treemap":
      option = treemapOption(allMembers, accentColor)
      height = 240
      break
    default:
      option = barOption(allMembers, accentColor)
      height = Math.max(120, allMembers.length * 36 + 40)
      break
  }

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

/** Returns true if a numbers-mode chart with this many members should span full width */
function numbersNeedsWideCard(
  memberCount: number,
  countUnmatched?: boolean,
  unmatchedCount?: number
): boolean {
  const total = memberCount + (countUnmatched && unmatchedCount != null ? 1 : 0)
  return total > 5
}

export type { TagGroupBreakdownChartProps }
export { numbersNeedsWideCard, TagGroupBreakdownChart }
