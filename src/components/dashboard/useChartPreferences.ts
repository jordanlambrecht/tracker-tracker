// src/components/dashboard/useChartPreferences.ts
//
// Functions: useChartPreferences, readPrefs, writePrefs, orderedCharts
//
// Manages dashboard chart visibility, collapse state, and display order in localStorage.
// Single source of truth for both inline chart controls and settings sheet.

"use client"

import { useCallback, useEffect, useState } from "react"

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
    id: "upload-landscape",
    label: "Upload Landscape",
    description: "Daily upload volume per tracker — drag to rotate, scroll to zoom",
    category: "analytics",
  },
  { id: "distribution", label: "Distribution", category: "analytics" },
  { id: "comparison-uploaded", label: "Total Uploaded", category: "analytics" },
  { id: "comparison-ratio", label: "Ratio", category: "analytics" },
  { id: "comparison-buffer", label: "Buffer", category: "analytics" },
  { id: "comparison-seedbonus", label: "Seedbonus", category: "analytics" },
  { id: "comparison-active", label: "Active Torrents", category: "analytics" },
  {
    id: "ratio-stability",
    label: "Ratio Stability",
    description:
      "7-point EMA with ±1σ confidence band — wider bands indicate more volatile ratios",
    category: "analytics",
  },
  {
    id: "fleet-composition",
    label: "Fleet Composition",
    description:
      "Seeding torrent count over time per tracker — stacked to show total fleet size",
    category: "analytics",
  },
  {
    id: "rank-tenure",
    label: "Rank Tenure",
    description:
      "Time spent at each rank per tracker — hover segments for duration details",
    category: "analytics",
  },
  {
    id: "buffer-velocity",
    label: "Buffer Velocity",
    description:
      "Rate of buffer change per day — above zero means gaining, below means losing",
    category: "analytics",
  },
  {
    id: "buffer-candlestick",
    label: "Buffer Candlestick",
    description:
      "Daily buffer open/high/low/close per tracker — like stock price charts",
    category: "analytics",
  },
  {
    id: "tracker-landscape",
    label: "Tracker Landscape",
    description:
      "Each tracker as a bubble — position shows upload vs download, size shows fleet",
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

function readPrefs(): ChartPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { hidden: [], collapsed: [], order: [] }
    const parsed = JSON.parse(raw) as Partial<ChartPrefs>
    return {
      hidden: parsed.hidden ?? [],
      collapsed: parsed.collapsed ?? [],
      order: parsed.order ?? [],
    }
  } catch {
    return { hidden: [], collapsed: [], order: [] }
  }
}

function writePrefs(prefs: ChartPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // SSR or quota exceeded
  }
}

function useChartPreferences() {
  const [prefs, setPrefs] = useState<ChartPrefs>({ hidden: [], collapsed: [], order: [] })

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    setPrefs(readPrefs())
  }, [])

  const isHidden = useCallback(
    (id: string) => prefs.hidden.includes(id),
    [prefs.hidden]
  )

  const isCollapsed = useCallback(
    (id: string) => prefs.collapsed.includes(id),
    [prefs.collapsed]
  )

  const toggleHidden = useCallback((id: string) => {
    setPrefs((prev) => {
      const hidden = prev.hidden.includes(id)
        ? prev.hidden.filter((x) => x !== id)
        : [...prev.hidden, id]
      const next = { ...prev, hidden }
      writePrefs(next)
      return next
    })
  }, [])

  const toggleCollapsed = useCallback((id: string) => {
    setPrefs((prev) => {
      const collapsed = prev.collapsed.includes(id)
        ? prev.collapsed.filter((x) => x !== id)
        : [...prev.collapsed, id]
      const next = { ...prev, collapsed }
      writePrefs(next)
      return next
    })
  }, [])

  const setVisible = useCallback((id: string, visible: boolean) => {
    setPrefs((prev) => {
      const hidden = visible
        ? prev.hidden.filter((x) => x !== id)
        : prev.hidden.includes(id)
          ? prev.hidden
          : [...prev.hidden, id]
      const next = { ...prev, hidden }
      writePrefs(next)
      return next
    })
  }, [])

  const collapseAll = useCallback((chartIds: string[]) => {
    setPrefs((prev) => {
      const visibleIds = chartIds.filter((id) => !prev.hidden.includes(id))
      const allCollapsed = visibleIds.length > 0 && visibleIds.every((id) => prev.collapsed.includes(id))
      const collapsed = allCollapsed
        ? prev.collapsed.filter((id) => !visibleIds.includes(id))
        : [...new Set([...prev.collapsed, ...visibleIds])]
      const next = { ...prev, collapsed }
      writePrefs(next)
      return next
    })
  }, [])

  const allVisibleCollapsed = useCallback(
    (chartIds: string[]) => {
      const visibleIds = chartIds.filter((id) => !prefs.hidden.includes(id))
      return visibleIds.length > 0 && visibleIds.every((id) => prefs.collapsed.includes(id))
    },
    [prefs]
  )

  const reorder = useCallback((newOrder: string[]) => {
    setPrefs((prev) => {
      const next = { ...prev, order: newOrder }
      writePrefs(next)
      return next
    })
  }, [])

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
    isHidden,
    isCollapsed,
    toggleHidden,
    toggleCollapsed,
    setVisible,
    collapseAll,
    allVisibleCollapsed,
    reorder,
    orderedCharts,
  }
}

export { useChartPreferences, DASHBOARD_CHARTS }
export type { ChartDef, ChartPrefs }
