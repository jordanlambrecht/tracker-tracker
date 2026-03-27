// src/components/charts/DistributionChart.tsx
//
// Functions: buildPieOption, buildSankeyOption, buildParallelOption, DistributionChart

"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { TabBar } from "@/components/ui/TabBar"
import { formatBytesFromString } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { fmtNum } from "./lib/chart-helpers"
import { CHART_THEME, chartDot, chartTooltip, escHtml } from "./lib/theme"

type ViewMode = "donuts" | "sankey" | "parallel"

interface TrackerSlice {
  name: string
  color: string
  uploadedBytes: string | null
  seedingCount: number | null
}

interface DistributionChartProps {
  trackers: TrackerSlice[]
  height?: number
}

function buildPieOption(
  title: string,
  data: { name: string; value: number; color: string }[],
  formatValue: (v: number) => string
): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number; color: string }
        return (
          chartDot(p.color) +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(p.name)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${formatValue(p.value)}</span>` +
          `<span style="color:${CHART_THEME.textTertiary};"> · ${p.percent}%</span>`
        )
      },
    }),
    title: {
      text: title,
      left: "center",
      top: 0,
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeDense,
        fontWeight: 500,
      },
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["50%", "55%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
        },
        label: {
          show: true,
          position: "outside",
          color: CHART_THEME.textTertiary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeCompact,
          formatter: "{b}",
        },
        labelLine: {
          lineStyle: { color: CHART_THEME.borderMid },
          length: 10,
          length2: 8,
        },
        emphasis: {
          label: { show: true, fontWeight: "bold", color: CHART_THEME.textPrimary },
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,0,0,0.3)" },
        },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color },
        })),
      },
    ],
  }
}

function buildSankeyOption(
  trackers: { name: string; color: string; uploadPct: number; seedingPct: number }[]
): EChartsOption {
  // Nodes: left side = "Upload: TrackerName", right side = "Seeding: TrackerName"
  // Links: each tracker flows from its upload node to its seeding node
  const nodes: {
    name: string
    itemStyle: { color: string; borderColor: string }
    depth: number
  }[] = []
  const links: {
    source: string
    target: string
    value: number
    lineStyle: { color: string; opacity: number }
  }[] = []

  // Sort left side by upload % (desc), right side by seeding % (desc)
  // layoutIterations: 0 preserves insertion order per depth, so different orderings produce crossing flows
  const byUpload = [...trackers].sort((a, b) => b.uploadPct - a.uploadPct)
  const bySeeding = [...trackers].sort((a, b) => b.seedingPct - a.seedingPct)

  // Interleave: all left nodes first (depth 0), then all right nodes (depth 1)
  for (const t of byUpload) {
    nodes.push({
      name: `${t.name} `,
      depth: 0,
      itemStyle: { color: t.color, borderColor: CHART_THEME.surface },
    })
  }

  for (const t of bySeeding) {
    nodes.push({
      name: ` ${t.name}`,
      depth: 1,
      itemStyle: { color: t.color, borderColor: CHART_THEME.surface },
    })
  }

  // Use upload % as flow value so widths represent upload contribution
  for (const t of trackers) {
    links.push({
      source: `${t.name} `,
      target: ` ${t.name}`,
      value: Math.max(t.uploadPct, 0.1),
      lineStyle: {
        color: t.color,
        opacity: 0.35,
      },
    })
  }

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as {
          dataType: "node" | "edge"
          data: { name: string; value?: number }
          name: string
        }

        if (p.dataType === "edge") {
          const edge = p.data as unknown as { source: string; target: string; value: number }
          const trackerName = edge.source.trim()
          const tracker = trackers.find((t) => t.name === trackerName)
          if (!tracker) return ""
          return (
            `<span style="color:${tracker.color};font-weight:600;">${escHtml(trackerName)}</span><br/>` +
            `<span style="color:${CHART_THEME.textSecondary};">Upload: ${fmtNum(tracker.uploadPct, 1)}%</span><br/>` +
            `<span style="color:${CHART_THEME.textSecondary};">Seeding: ${fmtNum(tracker.seedingPct, 1)}%</span>`
          )
        }

        const nodeName = p.name.trim()
        const tracker = trackers.find((t) => t.name === nodeName)
        if (!tracker) return ""
        const isUploadSide = p.name.endsWith(" ")
        return (
          `<span style="color:${tracker.color};font-weight:600;">${escHtml(nodeName)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">${isUploadSide ? "Upload" : "Seeding"}: ${fmtNum(isUploadSide ? tracker.uploadPct : tracker.seedingPct, 1)}%</span>`
        )
      },
    }),
    series: [
      {
        type: "sankey" as const,
        left: 80,
        right: 100,
        top: 32,
        bottom: 16,
        nodeWidth: 16,
        nodeGap: 10,
        layoutIterations: 0,
        emphasis: {
          focus: "adjacency",
        },
        label: {
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeCompact,
          formatter: (params: { name: string }) => params.name.trim(),
        },
        lineStyle: {
          curveness: 0.5,
        },
        data: nodes,
        links,
      },
    ],
    graphic: [
      {
        type: "text",
        left: 20,
        top: 8,
        style: {
          text: "Upload %",
          fill: CHART_THEME.textTertiary,
          fontSize: CHART_THEME.fontSizeDense,
          fontFamily: CHART_THEME.fontMono,
        },
      },
      {
        type: "text",
        right: 20,
        top: 8,
        style: {
          text: "Seeding %",
          fill: CHART_THEME.textTertiary,
          fontSize: CHART_THEME.fontSizeDense,
          fontFamily: CHART_THEME.fontMono,
        },
      },
    ],
  }
}

function buildParallelOption(
  trackers: { name: string; color: string; uploadPct: number; seedingPct: number }[]
): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { data: number[]; color: string; seriesName: string }
        const tracker = trackers.find((t) => t.name === p.seriesName)
        if (!tracker) return ""
        return (
          `<span style="color:${tracker.color};font-weight:600;">${escHtml(tracker.name)}</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">Upload: ${fmtNum(tracker.uploadPct, 1)}%</span><br/>` +
          `<span style="color:${CHART_THEME.textSecondary};">Seeding: ${fmtNum(tracker.seedingPct, 1)}%</span>`
        )
      },
    }),
    parallelAxis: [
      {
        dim: 0,
        name: "Upload %",
        nameLocation: "start",
        nameTextStyle: {
          color: CHART_THEME.textTertiary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeDense,
          padding: [0, 0, 12, 0],
        },
        axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
        axisLabel: {
          color: CHART_THEME.textTertiary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeCompact,
          formatter: (v: number) => `${fmtNum(v, 1)}%`,
        },
      },
      {
        dim: 1,
        name: "Seeding %",
        nameLocation: "start",
        nameTextStyle: {
          color: CHART_THEME.textTertiary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeDense,
          padding: [0, 0, 12, 0],
        },
        axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
        axisLabel: {
          color: CHART_THEME.textTertiary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeCompact,
          formatter: (v: number) => `${fmtNum(v, 1)}%`,
        },
      },
    ],
    parallel: {
      left: 80,
      right: 80,
      top: 40,
      bottom: 40,
      parallelAxisDefault: {
        type: "log",
        min: 0.01,
      },
    },
    series: trackers.map((t) => ({
      type: "parallel" as const,
      name: t.name,
      lineStyle: {
        color: t.color,
        width: 2.5,
        opacity: 0.7,
      },
      emphasis: {
        lineStyle: { width: 5, opacity: 1, shadowBlur: 12, shadowColor: t.color },
      },
      data: [[t.uploadPct, t.seedingPct]],
    })),
  }
}

function DistributionChart({ trackers, height = 300 }: DistributionChartProps) {
  const [mode, setMode] = useState<ViewMode>("donuts")

  const uploadData = trackers
    .filter((t) => t.uploadedBytes !== null)
    .map((t) => ({
      name: t.name,
      value: Number(BigInt(t.uploadedBytes as string)),
      color: t.color,
    }))

  const seedingData = trackers
    .filter((t) => t.seedingCount != null && t.seedingCount > 0)
    .map((t) => ({
      name: t.name,
      value: t.seedingCount as number,
      color: t.color,
    }))

  const hasUpload = uploadData.some((d) => d.value > 0)
  const hasSeeding = seedingData.some((d) => d.value > 0)

  if (!hasUpload && !hasSeeding) {
    return <ChartEmptyState height={height} message="No distribution data yet" />
  }

  const hasBothMetrics = hasUpload && hasSeeding
  const modes: ViewMode[] = hasBothMetrics ? ["donuts", "sankey", "parallel"] : ["donuts"]

  // Compute percentage data for sankey and parallel views
  const totalUpload = uploadData.reduce((a, b) => a + b.value, 0)
  const totalSeeding = seedingData.reduce((a, b) => a + b.value, 0)
  const pctTrackers = trackers
    .filter((t) => t.uploadedBytes !== null && t.seedingCount != null && t.seedingCount > 0)
    .map((t) => ({
      name: t.name,
      color: t.color,
      uploadPct: Math.max(
        0.01,
        totalUpload > 0 ? (Number(BigInt(t.uploadedBytes as string)) / totalUpload) * 100 : 0
      ),
      seedingPct: Math.max(
        0.01,
        totalSeeding > 0 ? ((t.seedingCount as number) / totalSeeding) * 100 : 0
      ),
    }))
    .sort((a, b) => b.uploadPct - a.uploadPct)

  function renderChart() {
    if (mode === "sankey" && hasBothMetrics) {
      return (
        <ChartECharts
          option={buildSankeyOption(pctTrackers)}
          style={{ height: height + 60, width: "100%" }}
        />
      )
    }

    if (mode === "parallel" && hasBothMetrics) {
      return (
        <ChartECharts
          option={buildParallelOption(pctTrackers)}
          style={{ height: height + 60, width: "100%" }}
        />
      )
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {hasUpload && (
          <ChartECharts
            option={buildPieOption("Upload Share", uploadData, (v) =>
              formatBytesFromString(v.toString())
            )}
            style={{ height, width: "100%" }}
          />
        )}
        {hasSeeding && (
          <ChartECharts
            option={buildPieOption(
              "Seeding Share",
              seedingData,
              (v) => `${v.toLocaleString()} torrents`
            )}
            style={{ height, width: "100%" }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {modes.length > 1 && (
        <div className="flex justify-end">
          <TabBar
            compact
            tabs={modes.map((m) => ({
              key: m,
              label: m === "donuts" ? "Donuts" : m === "sankey" ? "Flow" : "Parallel",
            }))}
            activeTab={mode}
            onChange={setMode}
          />
        </div>
      )}
      {renderChart()}
    </div>
  )
}

export type { DistributionChartProps, TrackerSlice }
export { DistributionChart }
