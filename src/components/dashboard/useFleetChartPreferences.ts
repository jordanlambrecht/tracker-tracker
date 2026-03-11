// src/components/dashboard/useFleetChartPreferences.ts
//
// Functions: useFleetChartPreferences

"use client"

import { useCallback, useEffect, useState } from "react"

export interface FleetChartDef {
  id: string
  label: string
  description?: string
}

export const FLEET_CHARTS: FleetChartDef[] = [
  { id: "fleet-speed-sparklines", label: "Live Speeds", description: "Real-time per-client upload/download sparklines" },
  { id: "fleet-speed-gauges", label: "Speed Gauges", description: "Upload and download speed gauge meters" },
  { id: "speed-theme-river", label: "Speed River", description: "Upload speed flow per tracker over time" },
  { id: "seeding-count-trends", label: "Seeding Trends", description: "Stacked seeding count per tracker over time" },
  { id: "leeching-trends", label: "Leeching Trends", description: "Leeching activity per tracker over time" },
  { id: "speed-history", label: "Speed History", description: "Upload vs download speed over time" },
  { id: "fleet-stat-cards", label: "Fleet Stats", description: "Aggregate fleet metrics" },
  { id: "fleet-ratio-distribution", label: "Ratio Distribution", description: "Fleet-wide ratio histogram" },
  { id: "fleet-cross-seed-donut", label: "Cross-Seed Coverage", description: "Cross-seeded vs unique torrents" },
  { id: "tracker-health-radar", label: "Tracker Health", description: "Per-tracker health comparison radar" },
  { id: "fleet-activity-heatmap", label: "Activity Heatmap", description: "When torrents are added (day x hour)" },
  { id: "fleet-storage-treemap", label: "Storage Breakdown", description: "Storage by tracker and category" },
  { id: "fleet-seed-time-distribution", label: "Seed Time Distribution", description: "Seed time histogram" },
  { id: "fleet-age-timeline", label: "Library Growth", description: "Cumulative torrent count over time" },
]

const STORAGE_KEY = "tracker-tracker:fleet-chart-preferences"

interface FleetChartPrefs {
  hidden: string[]
  collapsed: string[]
}

function readPrefs(): FleetChartPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { hidden: [], collapsed: [] }
    return JSON.parse(raw) as FleetChartPrefs
  } catch {
    return { hidden: [], collapsed: [] }
  }
}

function writePrefs(prefs: FleetChartPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // SSR or quota exceeded
  }
}

export function useFleetChartPreferences() {
  const [prefs, setPrefs] = useState<FleetChartPrefs>({ hidden: [], collapsed: [] })

  useEffect(() => {
    setPrefs(readPrefs())
  }, [])

  const isHidden = useCallback((id: string) => prefs.hidden.includes(id), [prefs.hidden])
  const isCollapsed = useCallback((id: string) => prefs.collapsed.includes(id), [prefs.collapsed])

  const toggleHidden = useCallback((id: string) => {
    setPrefs((prev) => {
      const next = prev.hidden.includes(id)
        ? { ...prev, hidden: prev.hidden.filter((h) => h !== id) }
        : { ...prev, hidden: [...prev.hidden, id] }
      writePrefs(next)
      return next
    })
  }, [])

  const toggleCollapsed = useCallback((id: string) => {
    setPrefs((prev) => {
      const next = prev.collapsed.includes(id)
        ? { ...prev, collapsed: prev.collapsed.filter((c) => c !== id) }
        : { ...prev, collapsed: [...prev.collapsed, id] }
      writePrefs(next)
      return next
    })
  }, [])

  const setVisible = useCallback((id: string, visible: boolean) => {
    setPrefs((prev) => {
      const hidden = visible
        ? prev.hidden.filter((x) => x !== id)
        : prev.hidden.includes(id) ? prev.hidden : [...prev.hidden, id]
      const next = { ...prev, hidden }
      writePrefs(next)
      return next
    })
  }, [])

  const collapseAll = useCallback((chartIds: string[]) => {
    setPrefs((prev) => {
      const visibleIds = chartIds.filter((id) => !prev.hidden.includes(id))
      const allCollapsed = visibleIds.every((id) => prev.collapsed.includes(id))
      const next = allCollapsed
        ? { ...prev, collapsed: prev.collapsed.filter((c) => !chartIds.includes(c)) }
        : { ...prev, collapsed: [...new Set([...prev.collapsed, ...visibleIds])] }
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

  return { isHidden, isCollapsed, toggleHidden, toggleCollapsed, setVisible, collapseAll, allVisibleCollapsed }
}
