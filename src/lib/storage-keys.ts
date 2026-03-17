// src/lib/storage-keys.ts
//
// Single source of truth for all localStorage key strings.
// Prevents silent key mismatches from typos across components.

export const STORAGE_KEYS = {
  SIDEBAR_STAT_MODE: "sidebar-stat-mode",
  SIDEBAR_SORT_MODE: "sidebar-sort-mode",
  CHART_PREFERENCES: "tracker-tracker:chart-preferences",
  FLEET_CHART_PREFERENCES: "tracker-tracker:fleet-chart-preferences",
  DASHBOARD_SETTINGS: "tracker-tracker:dashboard-settings",
  CLIENT_WIDGET_EXPANDED: "tracker-tracker:client-widget-expanded",
  DRAFT_QUICKLINKS: "tracker-tracker:draft-quicklinks",
} as const
