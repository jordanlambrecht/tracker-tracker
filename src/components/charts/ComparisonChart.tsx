// src/components/charts/ComparisonChart.tsx
//
// Functions: getValue, buildComparisonOption, ComparisonChart

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { bytesToGiB } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"

type ChartMetric = "uploaded" | "ratio" | "buffer"

interface TrackerSeries {
  name: string
  color: string
  snapshots: Snapshot[]
}

interface ComparisonChartProps {
  metric: ChartMetric
  trackerData: TrackerSeries[]
  height?: number
}

function getValue(snapshot: Snapshot, metric: ChartMetric): number | null {
  switch (metric) {
    case "uploaded":
      return bytesToGiB(snapshot.uploadedBytes)
    case "ratio":
      return snapshot.ratio
    case "buffer":
      return bytesToGiB(snapshot.bufferBytes)
  }
}

function buildComparisonOption(
  metric: ChartMetric,
  trackerData: TrackerSeries[]
): EChartsOption {
  // Build unified time axis from the union of all polledAt timestamps
  const allTimestamps = new Set<string>()
  for (const tracker of trackerData) {
    for (const snap of tracker.snapshots) {
      allTimestamps.add(snap.polledAt)
    }
  }
  const sortedTimestamps = Array.from(allTimestamps).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  const labels = sortedTimestamps.map((ts) =>
    new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  )

  // Determine unit for byte metrics
  let unit = "×"
  let divisor = 1
  if (metric !== "ratio") {
    const allGiB: number[] = []
    for (const tracker of trackerData) {
      for (const snap of tracker.snapshots) {
        const v = getValue(snap, metric)
        if (v !== null) allGiB.push(v)
      }
    }
    const maxGiB = Math.max(...allGiB, 0)
    const useTiB = maxGiB >= 1024
    divisor = useTiB ? 1024 : 1
    unit = useTiB ? "TiB" : "GiB"
  }

  // Total data points across all trackers — drives adaptive dot size
  const totalPoints = trackerData.reduce((sum, t) => sum + t.snapshots.length, 0)
  const dotSize = totalPoints > 100 ? 2 : totalPoints > 30 ? 4 : 6

  const borderSoft = "rgba(148, 163, 184, 0.08)"
  const tertiaryColor = "#64748b"
  const tooltipBg = "#2e3042"

  const fmtNum = (v: number, decimals = 2): string =>
    v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })

  const yAxisPad = (value: { min: number; max: number }) => {
    const range = value.max - value.min
    return Math.max(range * 0.15, (value.max || 1) * 0.001)
  }

  // Build per-tracker series mapped to the unified time axis
  const series: EChartsOption["series"] = trackerData.map((tracker) => {
    const snapByTs = new Map<string, Snapshot>()
    for (const snap of tracker.snapshots) {
      snapByTs.set(snap.polledAt, snap)
    }

    const data = sortedTimestamps.map((ts) => {
      const snap = snapByTs.get(ts)
      if (!snap) return null
      const raw = getValue(snap, metric)
      if (raw === null) return null
      return Number((raw / divisor).toFixed(3))
    })

    return {
      name: tracker.name,
      type: "line",
      data,
      smooth: true,
      connectNulls: true,
      symbol: "circle",
      symbolSize: dotSize,
      itemStyle: { color: tracker.color },
      lineStyle: {
        color: tracker.color,
        width: 2,
        shadowColor: tracker.color,
        shadowBlur: 8,
      },
      emphasis: {
        lineStyle: {
          shadowBlur: 16,
          shadowColor: tracker.color,
        },
      },
    }
  })

  return {
    backgroundColor: "transparent",
    grid: {
      top: 32,
      right: 16,
      bottom: 40,
      left: 64,
      containLabel: false,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: tooltipBg,
      borderColor: "rgba(148, 163, 184, 0.2)",
      borderWidth: 1,
      padding: [8, 12],
      textStyle: {
        color: "#e2e8f0",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 12,
      },
      axisPointer: {
        type: "line",
        lineStyle: {
          color: "rgba(148, 163, 184, 0.3)",
          opacity: 0.8,
          width: 1,
          type: "dashed",
        },
      },
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number | null
          color: string
          axisValueLabel: string
        }>
        if (!items || items.length === 0) return ""
        const time = items[0].axisValueLabel
        const rows = items
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            const val = item.value as number
            const display =
              metric === "ratio"
                ? `${fmtNum(val)} ×`
                : `${fmtNum(val)} ${unit}`
            return (
              `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px;box-shadow:0 0 6px ${item.color};"></span>` +
              `<span style="color:#94a3b8;">${item.seriesName}:</span> ` +
              `<span style="color:#e2e8f0;font-weight:600;">${display}</span>`
            )
          })
          .join("<br/>")
        return `<div style="font-family:var(--font-mono),monospace;font-size:11px;color:#64748b;margin-bottom:4px;">${time}</div>${rows}`
      },
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: {
        color: tertiaryColor,
        fontFamily: "var(--font-mono), monospace",
        fontSize: 11,
      },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: borderSoft } },
      axisTick: { show: false },
      axisLabel: {
        color: tertiaryColor,
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
        rotate: 30,
        interval: "auto",
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: unit,
      scale: true,
      min: ((value: { min: number; max: number }) =>
        Math.max(0, Math.floor((value.min - yAxisPad(value)) * 100) / 100)) as unknown as number,
      max: ((value: { min: number; max: number }) =>
        Math.ceil((value.max + yAxisPad(value)) * 100) / 100) as unknown as number,
      nameTextStyle: {
        color: tertiaryColor,
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: tertiaryColor,
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
        formatter: (val: number) => fmtNum(val, 1),
      },
      splitLine: {
        lineStyle: {
          color: borderSoft,
          width: 1,
        },
      },
    },
    dataZoom: [
      { type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true },
    ],
    series,
  }
}

function ComparisonChart({
  metric,
  trackerData,
  height = 500,
}: ComparisonChartProps) {
  const hasData = trackerData.some((t) => t.snapshots.length > 0)

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center text-tertiary font-mono text-sm"
        style={{ height }}
      >
        No snapshot data yet. Waiting for first polls...
      </div>
    )
  }

  return (
    <ReactECharts
      option={buildComparisonOption(metric, trackerData)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { ComparisonChart, buildComparisonOption }
export type { TrackerSeries, ChartMetric, ComparisonChartProps }
