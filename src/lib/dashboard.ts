// src/lib/dashboard.ts
//
// Functions: computeAggregateStats, computeAlerts, getDismissedAlerts, dismissAlert, clearDismissedAlerts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import type { TrackerSummary } from "@/types/api"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AggregateStats {
  totalUploaded: string
  totalDownloaded: string
  totalBuffer: string
  avgRatio: number | null
  totalSeeding: number
  totalLeeching: number
}

export type AlertType = "error" | "ratio-danger" | "stale-data"

export interface DashboardAlert {
  key: string
  type: AlertType
  trackerId: number
  trackerName: string
  trackerColor: string
  message: string
}

const DISMISSED_STORAGE_KEY = "dashboard-dismissed-alerts"

// ---------------------------------------------------------------------------
// computeAggregateStats
// ---------------------------------------------------------------------------

export function computeAggregateStats(trackers: TrackerSummary[]): AggregateStats {
  let totalUploaded = BigInt(0)
  let totalDownloaded = BigInt(0)
  let totalSeeding = 0
  let totalLeeching = 0

  for (const tracker of trackers) {
    if (!tracker.latestStats) continue
    const { uploadedBytes, downloadedBytes, seedingCount, leechingCount } = tracker.latestStats

    totalUploaded += uploadedBytes ? BigInt(uploadedBytes) : BigInt(0)
    totalDownloaded += downloadedBytes ? BigInt(downloadedBytes) : BigInt(0)
    totalSeeding += seedingCount ?? 0
    totalLeeching += leechingCount ?? 0
  }

  const totalBuffer = totalUploaded - totalDownloaded
  const avgRatio = totalDownloaded > 0n
    ? Number(totalUploaded * 1_000_000n / totalDownloaded) / 1_000_000
    : null

  return {
    totalUploaded: totalUploaded.toString(),
    totalDownloaded: totalDownloaded.toString(),
    totalBuffer: totalBuffer.toString(),
    avgRatio,
    totalSeeding,
    totalLeeching,
  }
}

// ---------------------------------------------------------------------------
// computeAlerts
// ---------------------------------------------------------------------------

export function computeAlerts(
  trackers: TrackerSummary[],
  registry: TrackerRegistryEntry[]
): DashboardAlert[] {
  const alerts: DashboardAlert[] = []

  for (const tracker of trackers) {
    // --- Error alert ---
    if (tracker.lastError) {
      const snippet = tracker.lastError.slice(0, 20).replace(/\s+/g, "_")
      alerts.push({
        key: `error-${tracker.id}-${snippet}`,
        type: "error",
        trackerId: tracker.id,
        trackerName: tracker.name,
        trackerColor: tracker.color,
        message: `Last poll failed: ${tracker.lastError}`,
      })
    }

    // --- Ratio danger ---
    const registryEntry = registry.find(
      (r) => r.name.toLowerCase() === tracker.name.toLowerCase()
    )
    const minimumRatioStr = registryEntry?.rules?.minimumRatio
    if (minimumRatioStr !== undefined && tracker.latestStats?.ratio !== null && tracker.latestStats?.ratio !== undefined) {
      const minimumRatio = parseFloat(minimumRatioStr)
      if (isFinite(minimumRatio) && tracker.latestStats.ratio < minimumRatio) {
        alerts.push({
          key: `ratio-danger-${tracker.id}`,
          type: "ratio-danger",
          trackerId: tracker.id,
          trackerName: tracker.name,
          trackerColor: tracker.color,
          message: `Ratio ${tracker.latestStats.ratio.toFixed(2)} is below the minimum of ${minimumRatioStr}`,
        })
      }
    }

    // --- Stale data ---
    if (tracker.lastPolledAt) {
      const lastPolled = new Date(tracker.lastPolledAt)
      const thresholdMs = tracker.pollIntervalMinutes * 2 * 60 * 1000
      const ageMs = Date.now() - lastPolled.getTime()
      if (ageMs > thresholdMs) {
        const hoursAgo = Math.floor(ageMs / (1000 * 60 * 60))
        alerts.push({
          key: `stale-data-${tracker.id}`,
          type: "stale-data",
          trackerId: tracker.id,
          trackerName: tracker.name,
          trackerColor: tracker.color,
          message: `Last polled ${hoursAgo}h ago (expected every ${tracker.pollIntervalMinutes / 60}h)`,
        })
      }
    }

    // H&R risk: skipped — requires snapshot data not available in TrackerSummary
  }

  return alerts
}

// ---------------------------------------------------------------------------
// Dismissal helpers (localStorage, SSR-safe)
// ---------------------------------------------------------------------------

export function getDismissedAlerts(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed)
  } catch {
    return new Set()
  }
}

export function dismissAlert(key: string): void {
  try {
    const dismissed = getDismissedAlerts()
    dismissed.add(key)
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...dismissed]))
  } catch {
    // silently ignore — SSR or storage quota exceeded
  }
}

export function clearDismissedAlerts(): void {
  try {
    localStorage.removeItem(DISMISSED_STORAGE_KEY)
  } catch {
    // silently ignore
  }
}
