// src/components/dashboard/useChartPreferences.ts
//
// Functions: useChartPreferences, orderedCharts
//
// Manages dashboard chart visibility, collapse state, and display order in localStorage.
// Single source of truth for both inline chart controls and settings sheet.
// Order/reorder logic is dashboard-specific; shared base lives in src/hooks/useChartPreferencesBase.ts.

"use client"

import { useCallback } from "react"
import { useChartPreferencesBase } from "@/hooks/useChartPreferencesBase"

const STORAGE_KEY = "tracker-tracker:chart-preferences"

interface ChartDef {
  id: string
  label: string
  description?: string
  category: "analytics" | "torrents"
}

interface ChartPrefs {
  hidden: string[]
  collapsed: string[]
  order: string[]
}

const DASHBOARD_CHARTS: ChartDef[] = [
  { id: "daily-volume", label: "Daily Volume", category: "analytics" },
  {
    id: "volume-calendar",
    label: "Volume Calendar",
    description: "GitHub-style calendar showing daily upload or download volume over time",
    category: "analytics",
  },
  {
    id: "upload-landscape",
    label: "Upload Landscape",
    description: "Daily upload volume per tracker — drag to rotate, scroll to zoom",
    category: "analytics",
  },
  { id: "distribution", label: "Distribution", category: "analytics" },
  {
    id: "volume-heatmap",
    label: "Volume Heatmap",
    description: "Upload or download volume by day of week and hour — reveals activity patterns",
    category: "analytics",
  },
  { id: "comparison-uploaded", label: "Total Uploaded", category: "analytics" },
  { id: "comparison-downloaded", label: "Total Downloaded", category: "analytics" },
  { id: "comparison-ratio", label: "Ratio", category: "analytics" },
  { id: "comparison-buffer", label: "Buffer", category: "analytics" },
  { id: "comparison-seedbonus", label: "Seedbonus", category: "analytics" },
  { id: "comparison-active", label: "Active Torrents", category: "analytics" },
  {
    id: "ratio-stability",
    label: "Ratio Stability",
    description: "7-point EMA with ±1σ confidence band — wider bands indicate more volatile ratios",
    category: "analytics",
  },
  {
    id: "fleet-composition",
    label: "Fleet Composition",
    description: "Seeding torrent count over time per tracker — stacked to show total fleet size",
    category: "analytics",
  },
  {
    id: "rank-tenure",
    label: "Rank Tenure",
    description: "Time spent at each rank per tracker — hover segments for duration details",
    category: "analytics",
  },
  {
    id: "buffer-velocity",
    label: "Buffer Velocity",
    description: "Rate of buffer change per day — above zero means gaining, below means losing",
    category: "analytics",
  },
  {
    id: "buffer-candlestick",
    label: "Buffer Candlestick",
    description: "Daily buffer open/high/low/close per tracker — like stock price charts",
    category: "analytics",
  },
  {
    id: "tracker-landscape",
    label: "Tracker Landscape",
    description: "Each tracker as a bubble — position shows upload vs download, size shows fleet",
    category: "analytics",
  },
  {
    id: "seedbonus-flow",
    label: "Seedbonus Flow",
    description: "Seedbonus accumulation streams per tracker over time",
    category: "analytics",
  },
  // Torrents category — placeholder entries (no render cases yet)
  { id: "torrent-overview", label: "Torrent Overview", category: "torrents" },
  { id: "torrent-categories", label: "Category Breakdown", category: "torrents" },
  { id: "torrent-activity", label: "Activity Heatmap", category: "torrents" },
  { id: "torrent-health", label: "Swarm Health", category: "torrents" },
]

const EMPTY_PREFS: ChartPrefs = { hidden: [], collapsed: [], order: [] }

function useChartPreferences() {
  const base = useChartPreferencesBase<ChartPrefs>(STORAGE_KEY, EMPTY_PREFS)
  const { prefs, setPrefs, hydrated } = base

  const reorder = useCallback(
    (newOrder: string[]) => {
      setPrefs((prev) => ({ ...prev, order: newOrder }))
    },
    [setPrefs]
  )

  const orderedCharts = useCallback(
    (category?: "analytics" | "torrents") => {
      const charts = category
        ? DASHBOARD_CHARTS.filter((c) => c.category === category)
        : DASHBOARD_CHARTS
      if (prefs.order.length === 0) return charts
      return [...charts].sort((a, b) => {
        const ai = prefs.order.indexOf(a.id)
        const bi = prefs.order.indexOf(b.id)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    },
    [prefs.order]
  )

  return {
    prefs,
    hydrated,
    isHidden: base.isHidden,
    isCollapsed: base.isCollapsed,
    toggleHidden: base.toggleHidden,
    toggleCollapsed: base.toggleCollapsed,
    setVisible: base.setVisible,
    collapseAll: base.collapseAll,
    allVisibleCollapsed: base.allVisibleCollapsed,
    reorder,
    orderedCharts,
  }
}

export type { ChartDef, ChartPrefs }
export { DASHBOARD_CHARTS, useChartPreferences }
