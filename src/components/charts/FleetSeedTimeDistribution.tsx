// src/components/charts/FleetSeedTimeDistribution.tsx
//
// Functions: buildFleetSeedTimeOption, FleetSeedTimeDistribution

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { SEED_TIME_BUCKETS, SEEDING_STATES } from "@/lib/fleet"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartGrid, chartDot, chartTooltip } from "./theme"

interface FleetSeedTimeDistributionProps {
  torrents: { state: string; seeding_time: number }[]
  height?: number
}

function buildFleetSeedTimeOption(
  seedingTorrents: { seeding_time: number }[],
  total: number
): EChartsOption {
  const buckets = SEED_TIME_BUCKETS.map((bucket, i) => {
    const prevMax = i === 0 ? -Infinity : SEED_TIME_BUCKETS[i - 1].maxSeconds
    const count = seedingTorrents.filter(
      (t) => t.seeding_time >= prevMax && t.seeding_time < bucket.maxSeconds
    ).length
    return { ...bucket, count }
  })

  const data = buckets.map((b) => ({
    value: b.count,
    itemStyle: { color: b.color, borderRadius: [4, 4, 0, 0] },
  }))

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 24, right: 16, bottom: 40, left: 48 }),
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; color: string; dataIndex: number }
        const bucket = buckets[p.dataIndex]
        if (!bucket) return ""
        const pct = total > 0 ? ((bucket.count / total) * 100).toFixed(1) : "0.0"
        return (
          chartDot(p.color) +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">Seed Time ${bucket.label}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${bucket.count.toLocaleString()} torrents</span>` +
          `<span style="color:${CHART_THEME.textTertiary};"> · ${pct}% of seeding</span>`
        )
      },
    }),
    xAxis: {
      type: "category",
      data: SEED_TIME_BUCKETS.map((b) => b.label),
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    series: [
      {
        type: "bar",
        data,
        barMaxWidth: 48,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" },
        },
      },
    ],
  }
}

function FleetSeedTimeDistribution({
  torrents,
  height = 280,
}: FleetSeedTimeDistributionProps) {
  const seedingTorrents = torrents.filter((t) => SEEDING_STATES.has(t.state))

  if (seedingTorrents.length === 0) {
    return (
      <ChartEmptyState
        height={height}
        message="No seeding torrents found"
      />
    )
  }

  return (
    <ReactECharts
      option={buildFleetSeedTimeOption(seedingTorrents, seedingTorrents.length)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { FleetSeedTimeDistribution }
export type { FleetSeedTimeDistributionProps }
