// src/components/charts/UploadDownloadChart.tsx
/*
 * Available functions:
 *   bytesToGiB     - Convert a byte string to a GiB number
 *   buildOption    - Build the ECharts option object from snapshot data
 *   UploadDownloadChart - React component (default export)
 */

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"

interface Snapshot {
  polledAt: string
  uploadedBytes: string
  downloadedBytes: string
}

interface UploadDownloadChartProps {
  snapshots: Snapshot[]
  height?: number
}

function bytesToGiB(bytesStr: string): number {
  return Number(BigInt(bytesStr)) / 1024 ** 3
}

function buildOption(snapshots: Snapshot[]): EChartsOption {
  const labels = snapshots.map((s) =>
    new Date(s.polledAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  )

  const uploadData = snapshots.map((s) =>
    Number(bytesToGiB(s.uploadedBytes).toFixed(3))
  )
  const downloadData = snapshots.map((s) =>
    Number(bytesToGiB(s.downloadedBytes).toFixed(3))
  )

  const cyanColor = "#00d4ff"
  const amberColor = "#f59e0b"
  const borderSoft = "rgba(148, 163, 184, 0.06)"
  const tertiaryColor = "#64748b"
  const tooltipBg = "#151b30"

  return {
    backgroundColor: "transparent",
    grid: {
      top: 24,
      right: 16,
      bottom: 80,
      left: 64,
      containLabel: false,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: tooltipBg,
      borderColor: cyanColor,
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
          color: cyanColor,
          opacity: 0.3,
          width: 1,
          type: "dashed",
        },
      },
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number
          color: string
          axisValueLabel: string
        }>
        if (!items || items.length === 0) return ""
        const time = items[0].axisValueLabel
        const rows = items
          .map(
            (item) =>
              `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px;box-shadow:0 0 6px ${item.color};"></span>` +
              `<span style="color:#94a3b8;">${item.seriesName}:</span> ` +
              `<span style="color:#e2e8f0;font-weight:600;">${item.value.toFixed(3)} GiB</span>`
          )
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
      name: "GiB",
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
        formatter: (val: number) => `${val.toFixed(1)}`,
      },
      splitLine: {
        lineStyle: {
          color: borderSoft,
          width: 1,
        },
      },
    },
    dataZoom: [
      {
        type: "slider",
        bottom: 8,
        height: 24,
        borderColor: "rgba(148,163,184,0.12)",
        backgroundColor: "rgba(15,20,36,0.6)",
        fillerColor: "rgba(0,212,255,0.06)",
        handleStyle: {
          color: cyanColor,
          borderColor: cyanColor,
        },
        moveHandleStyle: {
          color: cyanColor,
        },
        handleLabel: { show: false },
        selectedDataBackground: {
          lineStyle: { color: cyanColor, opacity: 0.3 },
          areaStyle: { color: cyanColor, opacity: 0.05 },
        },
        textStyle: {
          color: tertiaryColor,
          fontFamily: "var(--font-mono), monospace",
          fontSize: 10,
        },
      },
      {
        type: "inside",
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    series: [
      {
        name: "Uploaded",
        type: "line",
        data: uploadData,
        smooth: true,
        symbol: "none",
        lineStyle: {
          color: cyanColor,
          width: 2,
          shadowColor: cyanColor,
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
              { offset: 0, color: "rgba(0,212,255,0.25)" },
              { offset: 1, color: "rgba(0,212,255,0.00)" },
            ],
          },
        },
        emphasis: {
          lineStyle: {
            shadowBlur: 16,
            shadowColor: cyanColor,
          },
        },
      },
      {
        name: "Downloaded",
        type: "line",
        data: downloadData,
        smooth: true,
        symbol: "none",
        lineStyle: {
          color: amberColor,
          width: 2,
          shadowColor: amberColor,
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
              { offset: 0, color: "rgba(245,158,11,0.20)" },
              { offset: 1, color: "rgba(245,158,11,0.00)" },
            ],
          },
        },
        emphasis: {
          lineStyle: {
            shadowBlur: 16,
            shadowColor: amberColor,
          },
        },
      },
    ],
  }
}

function UploadDownloadChart({
  snapshots,
  height = 400,
}: UploadDownloadChartProps) {
  if (snapshots.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-tertiary font-mono text-sm"
        style={{ height }}
      >
        No snapshot data yet. Waiting for first poll...
      </div>
    )
  }

  return (
    <ReactECharts
      option={buildOption(snapshots)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { UploadDownloadChart }
export type { UploadDownloadChartProps, Snapshot }
