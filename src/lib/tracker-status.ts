// src/lib/tracker-status.ts
//
// Functions: getTrackerHealth, getHealthBadgeVariant, getHealthLabel, getHealthDescription
//
// Single source of truth for tracker health status — type, derivation logic,
// and all visual mappings (PulseDot status, Badge variant, labels, descriptions).

import type { BadgeVariant } from "@/components/ui/Badge"
import type { PulseDotStatus } from "@/components/ui/PulseDot"
import type { TrackerSummary } from "@/types/api"

type TrackerHealth = "healthy" | "warning" | "critical" | "error" | "paused" | "offline"

interface HealthMeta {
  label: string
  description: string
  pulseDot: PulseDotStatus
  badge: BadgeVariant
}

const HEALTH_META: Record<TrackerHealth, HealthMeta> = {
  healthy: {
    label: "Healthy",
    description: "Ratio \u2265 2.0 \u2014 healthy buffer",
    pulseDot: "healthy",
    badge: "accent",
  },
  warning: {
    label: "Warning",
    description: "Ratio 1.0\u20132.0 or zero active seeds",
    pulseDot: "warning",
    badge: "warn",
  },
  critical: {
    label: "Critical",
    description: "Ratio < 1.0 \u2014 needs seeding",
    pulseDot: "critical",
    badge: "danger",
  },
  paused: {
    label: "Paused",
    description: "Polling paused after consecutive failures",
    pulseDot: "paused",
    badge: "danger",
  },
  error: {
    label: "Error",
    description: "Last poll returned an error",
    pulseDot: "error",
    badge: "danger",
  },
  offline: {
    label: "Offline",
    description: "No data available",
    pulseDot: "offline",
    badge: "default",
  },
}

function getTrackerHealth(tracker: TrackerSummary): TrackerHealth {
  if (tracker.pausedAt) return "paused"
  if (tracker.lastError) return "error"
  if (!tracker.latestStats) return "offline"
  const { ratio, seedingCount } = tracker.latestStats
  if (ratio === null) return "offline"

  // Warned by tracker is always critical — potential ban risk
  if (tracker.latestStats.warned === true) return "critical"

  let status: TrackerHealth
  if (ratio >= 2) status = "healthy"
  else if (ratio >= 1) status = "warning"
  else status = "critical"

  if (seedingCount === 0 && status === "healthy") status = "warning"

  return status
}

function getHealthBadgeVariant(status: TrackerHealth): BadgeVariant {
  return HEALTH_META[status].badge
}

function getHealthLabel(status: TrackerHealth): string {
  return HEALTH_META[status].label
}

function getHealthDescription(status: TrackerHealth): string {
  return HEALTH_META[status].description
}

function getHealthPulseDot(status: TrackerHealth): PulseDotStatus {
  return HEALTH_META[status].pulseDot
}

export type { TrackerHealth }
export {
  getHealthBadgeVariant,
  getHealthDescription,
  getHealthLabel,
  getHealthPulseDot,
  getTrackerHealth,
}
