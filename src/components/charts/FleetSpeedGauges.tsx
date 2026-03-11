// src/components/charts/FleetSpeedGauges.tsx
//
// ECharts gauge pair showing fleet-wide upload and download speed.
//
// Functions: buildGaugeOption, FleetSpeedGauges

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { formatBytesFromNumber } from "@/lib/formatters"
import { Card } from "@/components/ui/Card"
import { CHART_THEME } from "./theme"

// ── Constants ──

const COLOR_UPLOAD = CHART_THEME.accent
const COLOR_DOWNLOAD = CHART_THEME.warn
const TRACK_COLOR = "rgba(148, 163, 184, 0.08)"
const MIN_MAX_BYTES = 100 * 1024 * 1024 // 100 MiB/s

// ── Types ──

interface FleetSpeedGaugesProps {
  uploadSpeed: number
  downloadSpeed: number
  height?: number
}

// ── Option builder ──

/**
 * Builds an ECharts gauge option for a single speed metric.
 * Auto-scales max to at least 100 MiB/s, or 2× current speed.
 */
function buildGaugeOption(
  speed: number,
  color: string,
  label: string
): EChartsOption {
  const max = Math.max(speed * 2, MIN_MAX_BYTES)
  const formatted = formatBytesFromNumber(speed)
  const speedLabel = `${formatted}/s`

  return {
    backgroundColor: "transparent",
    series: [
      {
        type: "gauge",
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max,
        radius: "88%",
        center: ["50%", "55%"],
        // Background track
        axisLine: {
          lineStyle: {
            width: 12,
            color: [[1, TRACK_COLOR]],
          },
        },
        // Progress bar
        progress: {
          show: true,
          width: 12,
          roundCap: true,
          itemStyle: {
            color,
            shadowColor: color,
            shadowBlur: 8,
          },
        },
        // No pointer
        pointer: {
          show: false,
        },
        // No axis ticks or labels
        axisTick: {
          show: false,
        },
        splitLine: {
          show: false,
        },
        axisLabel: {
          show: false,
        },
        detail: {
          show: true,
          valueAnimation: true,
          formatter: () => speedLabel,
          color: CHART_THEME.textPrimary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 13,
          fontWeight: 600,
          offsetCenter: ["0%", "10%"],
        },
        title: {
          show: true,
          offsetCenter: ["0%", "38%"],
          color: CHART_THEME.textTertiary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 10,
        },
        data: [
          {
            value: speed,
            name: label,
          },
        ],
      },
    ],
  }
}

// ── Main component ──

/**
 * Two ECharts gauges side-by-side showing upload (cyan) and download (amber) speed.
 * Renders inside a Card wrapper for consistent surface styling.
 */
function FleetSpeedGauges({
  uploadSpeed,
  downloadSpeed,
  height = 180,
}: FleetSpeedGaugesProps) {
  const uploadOption = buildGaugeOption(uploadSpeed, COLOR_UPLOAD, "Upload")
  const downloadOption = buildGaugeOption(downloadSpeed, COLOR_DOWNLOAD, "Download")

  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-2 gap-4 p-4">
        <ReactECharts
          option={uploadOption}
          style={{ height, width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
          lazyUpdate
        />
        <ReactECharts
          option={downloadOption}
          style={{ height, width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
          lazyUpdate
        />
      </div>
    </Card>
  )
}

export { FleetSpeedGauges }
export type { FleetSpeedGaugesProps }
