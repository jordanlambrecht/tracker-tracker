// src/components/charts/MetricChart.tsx
//
// Functions: computeDailyDeltas, buildLineOption, buildDailyDeltaOption, MetricChart

"use client"

import clsx from "clsx"
import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { useState } from "react"
import { bytesToGiB, getComplementaryColor, hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml } from "./theme"

// ── Types ──

export type Metric = "ratio" | "buffer" | "seedbonus" | "seedingCount" | "dailyDelta" | "shareScore"

interface MetricConfig {
  label: string
  unit: string
  getValue: (snap: Snapshot) => number | null
  isInteger?: boolean
  allowNegative?: boolean
}

export interface MetricChartProps {
  metric: Metric
  snapshots: Snapshot[]
  accentColor?: string
  height?: number
  baselineValue?: number
}

interface DailyBucket {
  label: string
  uploadDelta: number
  downloadDelta: number
}

// ── Metric configuration map ──

const METRIC_CONFIGS: Record<Exclude<Metric, "dailyDelta">, MetricConfig> = {
  shareScore: {
    label: "Share Score",
    unit: "pts",
    getValue: (s) => s.shareScore,
  },
  ratio: {
    label: "Ratio",
    unit: "×",
    getValue: (s) => s.ratio,
  },
  buffer: {
    label: "Buffer",
    unit: "GiB",
    getValue: (s) => bytesToGiB(s.bufferBytes),
    allowNegative: true,
  },
  seedbonus: {
    label: "Seedbonus",
    unit: "BON",
    getValue: (s) => (s.seedbonus !== null ? Math.floor(s.seedbonus) : null),
    isInteger: true,
  },
  seedingCount: {
    label: "Seeding",
    unit: "torrents",
    getValue: (s) => s.seedingCount,
    isInteger: true,
  },
}

const BORDER_SOFT = CHART_THEME.gridLine
const TERTIARY_COLOR = CHART_THEME.textTertiary

function fmtNum(v: number, decimals = 2): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// ── Daily delta computation ──

export function computeDailyDeltas(snapshots: Snapshot[]): DailyBucket[] {
  if (snapshots.length < 2) return []

  const sorted = [...snapshots].sort((a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime())

  const bucketMap = new Map<string, { upload: number; download: number }>()

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]

    const uploadDiff = Number(BigInt(curr.uploadedBytes) - BigInt(prev.uploadedBytes))
    const downloadDiff = Number(BigInt(curr.downloadedBytes) - BigInt(prev.downloadedBytes))

    const dayKey = new Date(curr.polledAt).toISOString().slice(0, 10)

    const existing = bucketMap.get(dayKey) ?? { upload: 0, download: 0 }
    existing.upload += uploadDiff
    existing.download += downloadDiff
    bucketMap.set(dayKey, existing)
  }

  return Array.from(bucketMap.entries()).map(([label, { upload, download }]) => ({
    label,
    uploadDelta: upload / 1024 ** 3,
    downloadDelta: download / 1024 ** 3,
  }))
}

// ── Build option for line metrics ──

function buildLineOption(
  snapshots: Snapshot[],
  config: MetricConfig,
  safeAccent: string,
  baselineValue?: number
): EChartsOption {
  const labels = snapshots.map((s) =>
    new Date(s.polledAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  )

  const rawData = snapshots.map((s) => config.getValue(s))

  // Auto-detect TiB for byte-based metrics
  let { unit } = config
  let divisor = 1
  if (unit === "GiB") {
    const maxGiB = Math.max(...rawData.filter((v): v is number => v !== null), 0)
    if (maxGiB >= 1024) {
      divisor = 1024
      unit = "TiB"
    }
  }

  const data = rawData.map((v) => (v !== null ? Number((v / divisor).toFixed(3)) : null))
  const dotSize = snapshots.length > 100 ? 2 : snapshots.length > 30 ? 4 : 6

  const yAxisPad = (value: { min: number; max: number }) => {
    const range = value.max - value.min
    return Math.max(range * 0.15, (value.max || 1) * 0.001)
  }

  const showSlider = snapshots.length >= 30
  const dataZoom: EChartsOption["dataZoom"] = []
  if (showSlider) {
    dataZoom.push({
      type: "slider",
      bottom: 8,
      height: 24,
      borderColor: BORDER_SOFT,
      backgroundColor: CHART_THEME.surfaceSemi,
      fillerColor: hexToRgba(safeAccent, 0.06),
      handleStyle: { color: safeAccent, borderColor: safeAccent },
      moveHandleStyle: { color: safeAccent },
      handleLabel: { show: false },
      selectedDataBackground: {
        lineStyle: { color: safeAccent, opacity: 0.3 },
        areaStyle: { color: safeAccent, opacity: 0.05 },
      },
      textStyle: {
        color: TERTIARY_COLOR,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
    })
  }

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 24, right: 16, bottom: showSlider ? 80 : 40, left: 64 }),
    tooltip: chartTooltip("axis", {
      borderColor: safeAccent,
      axisPointer: {
        type: "line",
        lineStyle: {
          color: safeAccent,
          opacity: 0.3,
          width: 1,
          type: "dashed",
        },
      },
      formatter: (params: unknown) => {
        const items = params as Array<{
          value: number | null
          axisValueLabel: string
          color: string
        }>
        if (!items?.[0]) return ""
        const val = items[0].value
        if (val === null || val === undefined) return ""
        const display = config.isInteger ? Math.round(val).toLocaleString() : fmtNum(val)
        return (
          chartTooltipHeader(items[0].axisValueLabel) +
          chartDot(safeAccent) +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(display)} ${escHtml(unit)}</span>`
        )
      },
    }),
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: BORDER_SOFT } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: 30, interval: "auto" }),
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: unit,
      scale: true,
      min: config.allowNegative
        ? undefined
        : ((value: { min: number; max: number }) =>
            Math.max(0, Math.floor((value.min - yAxisPad(value)) * 100) / 100)) as unknown as number,
      max: ((value: { min: number; max: number }) =>
        Math.ceil((value.max + yAxisPad(value)) * 100) / 100) as unknown as number,
      nameTextStyle: {
        color: TERTIARY_COLOR,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: config.isInteger
          ? (val: number) => Math.round(val).toLocaleString()
          : (val: number) => fmtNum(val, 1),
      }),
      splitLine: { lineStyle: { color: BORDER_SOFT, width: 1 } },
    },
    dataZoom,
    series: [
      {
        name: config.label,
        type: "line",
        data,
        smooth: true,
        connectNulls: true,
        symbol: "circle",
        symbolSize: dotSize,
        itemStyle: { color: safeAccent },
        lineStyle: {
          color: safeAccent,
          width: 2,
          shadowColor: safeAccent,
          shadowBlur: 8,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(safeAccent, 0.25) },
              { offset: 1, color: hexToRgba(safeAccent, 0) },
            ],
          },
        },
        emphasis: {
          lineStyle: { shadowBlur: 16, shadowColor: safeAccent },
        },
        markLine: baselineValue != null && baselineValue > 0 ? {
          silent: true,
          symbol: "none",
          lineStyle: { color: CHART_THEME.danger, type: "dashed", width: 1.5 },
          label: {
            show: true,
            formatter: `Min: ${baselineValue}`,
            position: "insideEndTop",
            color: CHART_THEME.danger,
            fontSize: 10,
            fontFamily: CHART_THEME.fontMono,
          },
          data: [{ yAxis: baselineValue }],
        } : undefined,
      },
    ],
  }
}

// ── Build option for daily delta bar chart ──

type DeltaMode = "bar" | "line"

function buildDailyDeltaOption(
  snapshots: Snapshot[],
  safeAccent: string,
  mode: DeltaMode = "bar"
): EChartsOption | null {
  const buckets = computeDailyDeltas(snapshots)
  if (buckets.length === 0) return null

  const labels = buckets.map((b) => b.label)
  const uploadData = buckets.map((b) => Number(b.uploadDelta.toFixed(3)))
  const downloadData = buckets.map((b) => Number(b.downloadDelta.toFixed(3)))

  const maxGiB = Math.max(...uploadData, ...downloadData, 0)
  const useTiB = maxGiB >= 1024
  const divisor = useTiB ? 1024 : 1
  const unit = useTiB ? "TiB" : "GiB"

  const finalUpload = uploadData.map((v) => Number((v / divisor).toFixed(3)))
  const finalDownload = downloadData.map((v) => Number((v / divisor).toFixed(3)))

  const complementColor = getComplementaryColor(safeAccent)

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 32, right: 16, left: 64 }),
    tooltip: chartTooltip("axis", {
      borderColor: safeAccent,
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number
          color: string
          axisValueLabel: string
        }>
        if (!items?.length) return ""
        const time = items[0].axisValueLabel
        const rows = items
          .map(
            (item) =>
              chartDot(item.color) +
              `<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> ` +
              `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${fmtNum(item.value)} ${unit}</span>`
          )
          .join("<br/>")
        return `${chartTooltipHeader(time)}${rows}`
      },
    }),
    legend: chartLegend(),
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: BORDER_SOFT } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: 30, interval: "auto" }),
    },
    yAxis: {
      type: "value",
      name: `Δ ${unit}/day`,
      nameTextStyle: {
        color: TERTIARY_COLOR,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => fmtNum(val, 1),
      }),
      splitLine: { lineStyle: { color: BORDER_SOFT, width: 1 } },
    },
    dataZoom: [],
    series: mode === "line"
      ? [
          {
            name: "Upload Δ",
            type: "line",
            data: finalUpload,
            smooth: true,
            symbol: "circle",
            symbolSize: buckets.length > 30 ? 2 : buckets.length > 14 ? 4 : 6,
            itemStyle: { color: safeAccent },
            lineStyle: { color: safeAccent, width: 2, shadowColor: safeAccent, shadowBlur: 8 },
            areaStyle: {
              color: {
                type: "linear",
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: hexToRgba(safeAccent, 0.25) },
                  { offset: 1, color: hexToRgba(safeAccent, 0) },
                ],
              },
            },
            emphasis: { lineStyle: { shadowBlur: 16, shadowColor: safeAccent } },
          },
          {
            name: "Download Δ",
            type: "line",
            data: finalDownload,
            smooth: true,
            symbol: "circle",
            symbolSize: buckets.length > 30 ? 2 : buckets.length > 14 ? 4 : 6,
            itemStyle: { color: complementColor },
            lineStyle: { color: complementColor, width: 2, shadowColor: complementColor, shadowBlur: 8 },
            areaStyle: {
              color: {
                type: "linear",
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: hexToRgba(complementColor, 0.2) },
                  { offset: 1, color: hexToRgba(complementColor, 0) },
                ],
              },
            },
            emphasis: { lineStyle: { shadowBlur: 16, shadowColor: complementColor } },
          },
        ]
      : [
          {
            name: "Upload Δ",
            type: "bar",
            data: finalUpload,
            itemStyle: {
              color: safeAccent,
              borderRadius: [3, 3, 0, 0],
            },
            emphasis: { itemStyle: { shadowBlur: 8, shadowColor: safeAccent } },
          },
          {
            name: "Download Δ",
            type: "bar",
            data: finalDownload,
            itemStyle: {
              color: complementColor,
              borderRadius: [3, 3, 0, 0],
            },
            emphasis: { itemStyle: { shadowBlur: 8, shadowColor: complementColor } },
          },
        ],
  }
}

// ── Main component ──

function MetricChart({
  metric,
  snapshots,
  accentColor = CHART_THEME.accent,
  height = 350,
  baselineValue,
}: MetricChartProps) {
  const [deltaMode, setDeltaMode] = useState<DeltaMode>("bar")

  const safeAccent = /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : CHART_THEME.accent

  if (snapshots.length === 0) {
    return <ChartEmptyState height={height} message="No snapshot data yet." />
  }

  const option =
    metric === "dailyDelta"
      ? buildDailyDeltaOption(snapshots, safeAccent, deltaMode)
      : buildLineOption(
          snapshots,
          METRIC_CONFIGS[metric],
          safeAccent,
          metric === "ratio" ? baselineValue : undefined
        )

  if (option === null) {
    return <ChartEmptyState height={height} message="Not enough data for daily deltas." />
  }

  if (metric === "dailyDelta") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <div className="nm-inset-sm p-1 flex gap-0.5 rounded-nm-sm">
            {(["bar", "line"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDeltaMode(m)}
                className={clsx(
                  "px-2.5 py-1 text-xs font-mono transition-all duration-150 cursor-pointer rounded-nm-sm",
                  deltaMode === m
                    ? "nm-raised-sm text-primary font-semibold"
                    : "text-tertiary hover:text-secondary",
                )}
              >
                {m === "bar" ? "Bar" : "Line"}
              </button>
            ))}
          </div>
        </div>
        <ReactECharts
          option={option}
          style={{ height, width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
          lazyUpdate
        />
      </div>
    )
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

export { MetricChart, METRIC_CONFIGS }
export type { MetricConfig, DailyBucket }
