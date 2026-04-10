// src/lib/storage-keys.ts
//
// Single source of truth for all localStorage key strings.
// Prevents silent key mismatches from typos across components.

export const STORAGE_KEYS = {
  SIDEBAR_STAT_MODE: "tracker-tracker:sidebar-stat-mode",
  SIDEBAR_SORT_MODE: "tracker-tracker:sidebar-sort-mode",
  SIDEBAR_FILTERS_EXPANDED: "tracker-tracker:sidebar-filters-expanded",
  SIDEBAR_FAVORITES_ONLY: "tracker-tracker:sidebar-favorites-only",
  SIDEBAR_SHOW_ARCHIVED: "tracker-tracker:sidebar-show-archived",
  SIDEBAR_UNLOCKED: "tracker-tracker:sidebar-unlocked",
  CHART_PREFERENCES: "tracker-tracker:chart-preferences",
  FLEET_CHART_PREFERENCES: "tracker-tracker:fleet-chart-preferences",
  DASHBOARD_SETTINGS: "tracker-tracker:dashboard-settings",
  CLIENT_WIDGET_EXPANDED: "tracker-tracker:client-widget-expanded",
  DRAFT_QUICKLINKS: "tracker-tracker:draft-quicklinks",
} as const
