// src/lib/dashboard.ts
//
// Functions: computeAggregateStats, computeAlerts, detectRankChanges, getDismissedAlerts, dismissAlert, clearDismissedAlerts

import { findRegistryEntry } from "@/data/tracker-registry"
import { isRedacted } from "@/lib/privacy"
import type { Snapshot, TrackerSummary } from "@/types/api"

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

export type AlertType = "error" | "ratio-danger" | "stale-data" | "rank-change" | "zero-seeding"

export interface DashboardAlert {
  key: string
  type: AlertType
  trackerId: number
  trackerName: string
  trackerColor: string
  message: string
  timestamp?: string
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
        timestamp: tracker.lastPolledAt ?? undefined,
      })
    }

    // --- Ratio danger ---
    const registryEntry = findRegistryEntry(tracker.baseUrl)
    const minimumRatio = registryEntry?.rules?.minimumRatio
    if (minimumRatio !== undefined && tracker.latestStats?.ratio !== null && tracker.latestStats?.ratio !== undefined) {
      if (Number.isFinite(minimumRatio) && tracker.latestStats.ratio < minimumRatio) {
        alerts.push({
          key: `ratio-danger-${tracker.id}`,
          type: "ratio-danger",
          trackerId: tracker.id,
          trackerName: tracker.name,
          trackerColor: tracker.color,
          message: `Ratio ${tracker.latestStats.ratio.toFixed(2)} is below the minimum of ${minimumRatio}`,
          timestamp: tracker.lastPolledAt ?? undefined,
        })
      }
    }

    // --- Stale data ---
    if (tracker.lastPolledAt) {
      const lastPolled = new Date(tracker.lastPolledAt)
      const thresholdMs = 2 * 60 * 60 * 1000 // 2 hours — stale if no poll in this window
      const ageMs = Date.now() - lastPolled.getTime()
      if (ageMs > thresholdMs) {
        const hoursAgo = Math.floor(ageMs / (1000 * 60 * 60))
        alerts.push({
          key: `stale-data-${tracker.id}`,
          type: "stale-data",
          trackerId: tracker.id,
          trackerName: tracker.name,
          trackerColor: tracker.color,
          message: `Last polled ${hoursAgo}h ago`,
          timestamp: tracker.lastPolledAt,
        })
      }
    }

    // --- Zero seeding ---
    if (
      tracker.isActive &&
      tracker.latestStats &&
      tracker.latestStats.seedingCount === 0
    ) {
      alerts.push({
        key: `zero-seeding-${tracker.id}`,
        type: "zero-seeding",
        trackerId: tracker.id,
        trackerName: tracker.name,
        trackerColor: tracker.color,
        message: "Seeding 0 torrents — no active seeds",
        timestamp: tracker.lastPolledAt ?? undefined,
      })
    }

    // H&R risk: skipped — requires snapshot data not available in TrackerSummary
  }

  return alerts
}

// ---------------------------------------------------------------------------
// detectRankChanges
// ---------------------------------------------------------------------------

/**
 * Detects rank/group changes from snapshot history.
 * Only surfaces changes from the last `freshnessDays` days.
 * Returns alerts that can be merged with other dashboard alerts.
 */
export function detectRankChanges(
  trackers: TrackerSummary[],
  snapshotMap: Map<number, Snapshot[]>,
  freshnessDays = 7
): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const cutoff = Date.now() - freshnessDays * 24 * 60 * 60 * 1000

  for (const t of trackers) {
    const raw = snapshotMap.get(t.id)
    if (!raw || raw.length < 2) continue

    // Sort ascending by polledAt so index 0 is oldest, last is newest
    const snapshots = [...raw].sort(
      (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
    )

    // Walk backwards through snapshots to find the most recent rank change
    for (let i = snapshots.length - 1; i > 0; i--) {
      const current = snapshots[i]
      const previous = snapshots[i - 1]

      // Skip if no group data or redacted (privacy mode)
      if (!current.group || !previous.group) continue
      if (isRedacted(current.group) || isRedacted(previous.group)) continue
      // Skip if same group
      if (current.group === previous.group) continue

      // Found a rank change — check freshness
      const changeTime = new Date(current.polledAt).getTime()
      if (changeTime < cutoff) break // Older than freshness window, stop looking

      alerts.push({
        key: `rank-change-${t.id}-${current.group}`,
        type: "rank-change" as AlertType,
        trackerId: t.id,
        trackerName: t.name,
        trackerColor: t.color,
        message: `Rank changed: ${previous.group} → ${current.group}`,
        timestamp: current.polledAt,
      })
      break // Only report the most recent change per tracker
    }
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
