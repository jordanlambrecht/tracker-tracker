// src/components/settings/DatabaseSizeChart.tsx
"use client"

import type { EChartsOption } from "echarts"
import { useEffect, useState } from "react"
import { ChartECharts } from "@/components/charts/lib/ChartECharts"
import { CHART_THEME, chartAxisLabel, chartGrid, chartTooltip } from "@/components/charts/lib/theme"
import { Shimmer } from "@/components/ui/Shimmer"
import { hexToRgba } from "@/lib/color-utils"
import { formatBytesNum, splitValueUnit } from "@/lib/formatters"
import type { DbSizeResponse } from "@/lib/server-data"

function buildOption(data: DbSizeResponse): EChartsOption {
  const lineColor = CHART_THEME.textTertiary

  const historicalData = data.history.map((h) => [h.date, Number(h.bytes)])

  // Projection data points
  const projectionData: [string, number][] = []
  if (data.history.length >= 2 && data.dailyGrowthBytes > 0) {
    const lastEntry = data.history[data.history.length - 1]
    const lastBytes = Number(lastEntry.bytes)
    const lastDate = new Date(lastEntry.date)
    const endDate = new Date(data.projectionDate)
    const days = Math.round((endDate.getTime() - lastDate.getTime()) / 86_400_000)

    // Start projection from the last historical point for continuity
    projectionData.push([lastEntry.date, lastBytes])
    for (let i = 1; i <= days; i++) {
      const date = new Date(lastDate.getTime() + i * 86_400_000)
      const projected = lastBytes + data.dailyGrowthBytes * i
      projectionData.push([date.toISOString().slice(0, 10), projected])
    }
  }

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 8, bottom: 32, left: 56, right: 16 }),
    tooltip: chartTooltip("axis", {
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: [string, number]
          color: string
        }>
        if (!items?.length) return ""
        const date = items[0].value[0]
        const rows = items
          .map((item) => {
            const { num, unit } = splitValueUnit(formatBytesNum(item.value[1]))
            const label = item.seriesName === "Projected" ? "Projected" : "Size"
            return `<span style="color:${CHART_THEME.textSecondary}">${label}:</span> <b>${num} ${unit}</b>`
          })
          .join("<br/>")
        return `<span style="font-family:${CHART_THEME.fontMono};font-size:${CHART_THEME.fontSizeSmall}px">${date}<br/>${rows}</span>`
      },
    }),
    xAxis: {
      type: "category",
      data: [...data.history.map((h) => h.date), ...projectionData.slice(1).map((p) => p[0])],
      axisLabel: {
        ...chartAxisLabel(),
        formatter: (val: string) => {
          const d = new Date(val)
          return `${d.getMonth() + 1}/${d.getDate()}`
        },
        interval: "auto",
      },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        ...chartAxisLabel(),
        formatter: (val: number) => {
          const { num, unit } = splitValueUnit(formatBytesNum(val))
          return `${num} ${unit}`
        },
      },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine, width: 1 } },
      axisLine: { show: false },
    },
    series: [
      {
        name: "Size",
        type: "line",
        data: historicalData,
        symbol: "none",
        lineStyle: { color: lineColor, width: 1 },
        itemStyle: { color: lineColor },
      },
      ...(projectionData.length > 0
        ? [
            {
              name: "Projected",
              type: "line" as const,
              data: projectionData.map((p) => [p[0], p[1]]),
              symbol: "none",
              lineStyle: { color: lineColor, width: 1, type: "dashed" as const, opacity: 0.5 },
              areaStyle: { color: hexToRgba(lineColor, 0.04) },
              itemStyle: { color: lineColor },
            },
          ]
        : []),
    ],
  }
}

function StatsRow({ data }: { data: DbSizeResponse }) {
  const current = splitValueUnit(formatBytesNum(Number(data.currentBytes)))
  const daily = splitValueUnit(formatBytesNum(data.dailyGrowthBytes))
  const projected = splitValueUnit(formatBytesNum(Number(data.projectedBytes)))
  const historyDays = data.history.length

  return (
    <p className="text-xs font-mono text-muted">
      {current.num} {current.unit} current
      {data.dailyGrowthBytes > 0 && (
        <>
          {" · "}
          {daily.num} {daily.unit}/day avg growth
          {" · "}~{projected.num} {projected.unit} in {historyDays} days
        </>
      )}
    </p>
  )
}

export function DatabaseSizeChart() {
  const [data, setData] = useState<DbSizeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/settings/db-size")
        if (res.ok) setData(await res.json())
      } catch {
        // Silently fail — chart is non-critical
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Shimmer size="bar" className="w-full h-40" />
        <Shimmer size="text" className="w-48" />
      </div>
    )
  }

  if (!data || data.history.length < 2) {
    return (
      <p className="text-xs font-mono text-muted">
        {data?.history.length === 1
          ? "Collecting size data — chart available tomorrow."
          : "No size data recorded yet."}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <ChartECharts option={buildOption(data)} style={{ height: 160, width: "100%" }} />
      <StatsRow data={data} />
    </div>
  )
}
