// src/components/dashboard/useFleetChartPreferences.ts
//
// Functions: useFleetChartPreferences
//
// Manages fleet dashboard chart visibility and collapse state in localStorage.
// Shared base logic lives in src/hooks/useChartPreferencesBase.ts.

"use client"

import { useChartPreferencesBase } from "@/hooks/useChartPreferencesBase"
import { STORAGE_KEYS } from "@/lib/storage-keys"

export interface FleetChartDef {
  id: string
  label: string
  description?: string
}

export const FLEET_CHARTS: FleetChartDef[] = [
  {
    id: "fleet-speed-sparklines",
    label: "Live Speeds",
    description: "Real-time per-client upload/download sparklines",
  },

  {
    id: "speed-theme-river",
    label: "Speed River",
    description: "Upload speed flow per tracker over time",
  },
  {
    id: "seeding-count-trends",
    label: "Seeding Trends",
    description: "Stacked seeding count per tracker over time",
  },
  {
    id: "leeching-trends",
    label: "Leeching Trends",
    description: "Leeching activity per tracker over time",
  },
  {
    id: "speed-history",
    label: "Speed History",
    description: "Upload vs download speed over time",
  },
  { id: "fleet-stat-cards", label: "Fleet Stats", description: "Aggregate fleet metrics" },
  {
    id: "fleet-ratio-distribution",
    label: "Ratio Distribution",
    description: "Fleet-wide ratio histogram",
  },
  {
    id: "fleet-cross-seed-donut",
    label: "Cross-Seed Coverage",
    description: "Cross-seeded vs unique torrents",
  },
  {
    id: "cross-seed-network",
    label: "Cross-Seed Network",
    description: "Force-directed graph showing cross-seed relationships between trackers",
  },
  {
    id: "tracker-health-radar",
    label: "Tracker Health",
    description: "Per-tracker health comparison radar",
  },
  {
    id: "fleet-activity-heatmap",
    label: "Activity Heatmap",
    description: "When torrents are added (day x hour)",
  },
  {
    id: "fleet-storage-treemap",
    label: "Storage Breakdown",
    description: "Storage by tracker and category",
  },
  {
    id: "fleet-seed-time-distribution",
    label: "Seed Time Distribution",
    description: "Seed time histogram",
  },
  {
    id: "fleet-age-timeline",
    label: "Library Growth",
    description: "Cumulative torrent count over time",
  },
  {
    id: "fleet-category-timeline",
    label: "Categories Over Time",
    description: "Cumulative torrents per qBT category",
  },
  {
    id: "fleet-size-jitter",
    label: "Size Scatter",
    description: "Torrent size distribution per tracker — jittered scatter plot",
  },
  {
    id: "fleet-category-breakdown",
    label: "Category Mix",
    description: "Normalized category breakdown per tracker — stacked percentage bars",
  },
]

interface FleetChartPrefs {
  hidden: string[]
  collapsed: string[]
}

const EMPTY_PREFS: FleetChartPrefs = { hidden: [], collapsed: [] }

export function useFleetChartPreferences() {
  const {
    hydrated,
    isHidden,
    isCollapsed,
    toggleHidden,
    toggleCollapsed,
    setVisible,
    collapseAll,
    allVisibleCollapsed,
  } = useChartPreferencesBase<FleetChartPrefs>(STORAGE_KEYS.FLEET_CHART_PREFERENCES, EMPTY_PREFS)

  return {
    hydrated,
    isHidden,
    isCollapsed,
    toggleHidden,
    toggleCollapsed,
    setVisible,
    collapseAll,
    allVisibleCollapsed,
  }
}
