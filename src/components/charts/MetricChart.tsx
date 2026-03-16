// src/components/charts/MetricChart.tsx
//
// Functions: buildLineOption, buildDailyDeltaOption, MetricChart

"use client"

import clsx from "clsx"
import type { EChartsOption } from "echarts"
import { useState } from "react"
import { bytesToGiB, getComplementaryColor } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import { ChartECharts } from "./ChartECharts"
import { ChartEmptyState } from "./ChartEmptyState"
import { adaptiveDotSize, autoByteScale, buildAxisPointer, buildGlowAreaStyle, fmtNum, yAxisAutoRange } from "./chart-helpers"
import { computeDailyDeltas, formatSnapshotLabel } from "./chart-transforms"
import { LogScaleToggle } from "./LogScaleToggle"
import { CHART_THEME, chartAxisLabel, chartDataZoom, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml, shouldUseLogScale } from "./theme"

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

// ── Build option for line metrics ──

function buildLineOption(
  snapshots: Snapshot[],
  config: MetricConfig,
  safeAccent: string,
  baselineValue?: number,
  useLog?: boolean
): EChartsOption {
  const labels = snapshots.map((s) => formatSnapshotLabel(s.polledAt))

  const rawData = snapshots.map((s) => config.getValue(s))

  // Auto-detect TiB for byte-based metrics
  let { unit } = config
  let divisor = 1
  if (unit === "GiB") {
    const maxGiB = Math.max(...rawData.filter((v): v is number => v !== null), 0)
    ;({ divisor, unit } = autoByteScale(maxGiB))
  }

  const data = rawData.map((v) => (v !== null ? Number((v / divisor).toFixed(3)) : null))
  const dotSize = adaptiveDotSize(snapshots.length)

  const showSlider = snapshots.length >= 30
  const dataZoom: EChartsOption["dataZoom"] = showSlider ? chartDataZoom(safeAccent) as EChartsOption["dataZoom"] : []

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 16, right: 16, bottom: showSlider ? 80 : 40, left: 64 }),
    tooltip: chartTooltip("axis", {
      borderColor: safeAccent,
      axisPointer: buildAxisPointer(safeAccent, 0.3, 1),
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
      type: useLog ? "log" : "value",
      name: useLog ? `${unit} (log)` : unit,
      scale: true,
      ...(useLog
        ? {}
        : yAxisAutoRange({ allowNegative: config.allowNegative, baselineValue })),
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
        areaStyle: buildGlowAreaStyle(safeAccent),
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
  const { divisor, unit } = autoByteScale(maxGiB)

  const finalUpload = uploadData.map((v) => Number((v / divisor).toFixed(3)))
  const finalDownload = downloadData.map((v) => Number((v / divisor).toFixed(3)))

  const complementColor = getComplementaryColor(safeAccent)
  const deltaDotSize = adaptiveDotSize(buckets.length, [30, 14])

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 16, right: 16, left: 64 }),
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
            symbolSize: deltaDotSize,
            itemStyle: { color: safeAccent },
            lineStyle: { color: safeAccent, width: 2, shadowColor: safeAccent, shadowBlur: 8 },
            areaStyle: buildGlowAreaStyle(safeAccent),
            emphasis: { lineStyle: { shadowBlur: 16, shadowColor: safeAccent } },
          },
          {
            name: "Download Δ",
            type: "line",
            data: finalDownload,
            smooth: true,
            symbol: "circle",
            symbolSize: deltaDotSize,
            itemStyle: { color: complementColor },
            lineStyle: { color: complementColor, width: 2, shadowColor: complementColor, shadowBlur: 8 },
            areaStyle: buildGlowAreaStyle(complementColor, 0.2),
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
  const [forceLog, setForceLog] = useState<boolean | null>(null)

  const safeAccent = /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : CHART_THEME.accent

  if (snapshots.length === 0) {
    return <ChartEmptyState height={height} message="No snapshot data yet." />
  }

  const config = metric !== "dailyDelta" ? METRIC_CONFIGS[metric] : null
  const ratioValues = config ? snapshots.map((s) => config.getValue(s)).filter((v): v is number => v !== null && v > 0) : []
  const autoLog = ratioValues.length > 0 ? shouldUseLogScale(ratioValues) : false
  const useLog = forceLog ?? autoLog
  const showLogToggle = metric === "ratio" || metric === "buffer" || metric === "seedbonus"

  const option =
    metric === "dailyDelta"
      ? buildDailyDeltaOption(snapshots, safeAccent, deltaMode)
      : buildLineOption(
          snapshots,
          METRIC_CONFIGS[metric],
          safeAccent,
          metric === "ratio" ? baselineValue : undefined,
          showLogToggle ? useLog : undefined
        )

  if (option === null) {
    return <ChartEmptyState height={height} message="Not enough data for daily deltas." />
  }

  if (metric === "dailyDelta") {
    return (
      <div className="flex flex-col gap-1">
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
        <ChartECharts
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
    <div className="flex flex-col gap-1">
      {showLogToggle && (
        <div className="flex justify-end">
          <LogScaleToggle
            effectiveLog={useLog}
            isAuto={forceLog === null}
            onToggle={() => setForceLog((prev) => {
              if (prev === null) return !autoLog
              return prev ? false : null
            })}
          />
        </div>
      )}
      <ChartECharts
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
      />
    </div>
  )
}

export type { MetricConfig }
export { METRIC_CONFIGS, MetricChart }
