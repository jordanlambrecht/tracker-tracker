// src/lib/dashboard.ts
//
// Functions: computeAggregateStats, computeAlerts, detectRankChanges, fetchDismissedKeys,
// postDismissAlert, deleteAllDismissed, computeSystemAlerts

import { findRegistryEntry } from "@/data/tracker-registry"
import { formatDateTime, formatRatio, formatTimeAgo } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import {
  checkAnniversaryMilestone,
  checkRatioBelowMinimum,
  checkTrackerError,
  checkWarned,
  checkZeroSeeding,
} from "@/lib/tracker-events"
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

export type AlertType =
  | "error"
  | "poll-paused"
  | "ratio-danger"
  | "stale-data"
  | "rank-change"
  | "zero-seeding"
  | "warned"
  | "anniversary"
  | "update-available"
  | "backup-failed"
  | "client-error"

export interface DashboardAlert {
  key: string
  type: AlertType
  trackerId: number | null
  trackerName: string
  trackerColor: string
  message: string
  timestamp?: string
  dismissible: boolean
}

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
  const avgRatio =
    totalDownloaded > 0n ? Number((totalUploaded * 1_000_000n) / totalDownloaded) / 1_000_000 : null

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

export function computeAlerts(trackers: TrackerSummary[]): DashboardAlert[] {
  const alerts: DashboardAlert[] = []

  for (const tracker of trackers) {
    // --- Poll paused (suppresses error alert when paused) ---
    const { paused, pausedByUser, hasError } = checkTrackerError(
      tracker.lastError,
      tracker.pausedAt,
      tracker.userPausedAt
    )
    if (paused && !pausedByUser) {
      alerts.push({
        key: `poll-paused-${tracker.id}`,
        type: "poll-paused",
        trackerId: tracker.id,
        trackerName: tracker.name,
        trackerColor: tracker.color,
        message: "Polling paused after repeated failures — check API key and resume",
        timestamp: tracker.pausedAt ?? undefined,
        dismissible: false,
      })
    } else if (hasError) {
      const snippet = tracker.lastError?.slice(0, 20).replace(/\s+/g, "_")
      alerts.push({
        key: `error-${tracker.id}-${snippet}`,
        type: "error",
        trackerId: tracker.id,
        trackerName: tracker.name,
        trackerColor: tracker.color,
        message: `Last poll failed: ${tracker.lastError}`,
        timestamp: tracker.lastPolledAt ?? undefined,
        dismissible: true,
      })
    }

    // --- Ratio danger ---
    const registryEntry = findRegistryEntry(tracker.baseUrl)
    const minimumRatio = registryEntry?.rules?.minimumRatio
    if (checkRatioBelowMinimum(tracker.latestStats?.ratio, minimumRatio)) {
      alerts.push({
        key: `ratio-danger-${tracker.id}`,
        type: "ratio-danger",
        trackerId: tracker.id,
        trackerName: tracker.name,
        trackerColor: tracker.color,
        message: `Ratio ${formatRatio(tracker.latestStats?.ratio)} is below the minimum of ${minimumRatio}`,
        timestamp: tracker.lastPolledAt ?? undefined,
        dismissible: true,
      })
    }

    // --- Stale data (skip if paused — staleness is expected) ---
    if (!tracker.pausedAt && !tracker.userPausedAt && tracker.lastPolledAt) {
      const lastPolled = new Date(tracker.lastPolledAt)
      const thresholdMs = 2 * 60 * 60 * 1000 // 2 hours
      const ageMs = Date.now() - lastPolled.getTime()
      if (ageMs > thresholdMs) {
        alerts.push({
          key: `stale-data-${tracker.id}`,
          type: "stale-data",
          trackerId: tracker.id,
          trackerName: tracker.name,
          trackerColor: tracker.color,
          message: `Last polled ${formatTimeAgo(tracker.lastPolledAt)}`,
          timestamp: tracker.lastPolledAt,
          dismissible: true,
        })
      }
    }

    // --- Zero seeding ---
    if (checkZeroSeeding(tracker.latestStats?.seedingCount, tracker.isActive)) {
      alerts.push({
        key: `zero-seeding-${tracker.id}`,
        type: "zero-seeding",
        trackerId: tracker.id,
        trackerName: tracker.name,
        trackerColor: tracker.color,
        message: "Seeding 0 torrents — no active seeds",
        timestamp: tracker.lastPolledAt ?? undefined,
        dismissible: true,
      })
    }

    // --- Warned by tracker ---
    if (checkWarned(tracker.latestStats?.warned)) {
      alerts.push({
        key: `warned-${tracker.id}`,
        type: "warned",
        trackerId: tracker.id,
        trackerName: tracker.name,
        trackerColor: tracker.color,
        message: "You have an active warning on this tracker",
        timestamp: tracker.lastPolledAt ?? undefined,
        dismissible: true,
      })
    }

    // --- Anniversary ---
    const milestone = checkAnniversaryMilestone(tracker.joinedAt)
    if (milestone) {
      alerts.push({
        key: `anniversary-${tracker.id}-${milestone.label}`,
        type: "anniversary",
        trackerId: tracker.id,
        trackerName: tracker.name,
        trackerColor: tracker.color,
        message: milestone.label,
        dismissible: true,
      })
    }
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
    const snapshots = snapshotMap.get(t.id)
    if (!snapshots || snapshots.length < 2) continue

    // INVARIANT: snapshots arrive sorted ascending by polledAt from the API
    // Walk backwards to find the most recent rank change
    for (let i = snapshots.length - 1; i > 0; i--) {
      const current = snapshots[i]
      const previous = snapshots[i - 1]

      // Skip if no group data or redacted (privacy mode)
      if (!current.group || !previous.group) continue
      if (isRedacted(current.group) || isRedacted(previous.group)) continue
      // Skip if same group
      if (current.group === previous.group) continue

      // Found a rank change. check freshness
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
        dismissible: true,
      })
      break // Only report the most recent change per tracker
    }
  }

  return alerts
}

// ---------------------------------------------------------------------------
// Dismissal helpers
// ---------------------------------------------------------------------------

export async function fetchDismissedKeys(): Promise<Set<string>> {
  try {
    const res = await fetch("/api/alerts/dismissed", {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return new Set()
    const data = (await res.json()) as { keys: string[] }
    return new Set(data.keys)
  } catch {
    // security-audit-ignore: best-effort. dismissed keys default to empty on failure
    return new Set()
  }
}

export async function postDismissAlert(key: string, type: string): Promise<void> {
  try {
    await fetch("/api/alerts/dismissed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, type }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // security-audit-ignore: best-effort. alert will reappear on next load if POST failed
  }
}

export async function deleteAllDismissed(): Promise<void> {
  try {
    await fetch("/api/alerts/dismissed", {
      method: "DELETE",
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // security-audit-ignore: best-effort. dismissals will be re-fetched on next load
  }
}

// ---------------------------------------------------------------------------
// computeSystemAlerts
// ---------------------------------------------------------------------------

export interface SystemAlertData {
  latestVersion?: string
  currentVersion: string
  failedBackups: { createdAt: string }[]
  clients: { id: number; name: string; enabled: boolean; lastError: string | null }[]
}

export function computeSystemAlerts(data: SystemAlertData): DashboardAlert[] {
  const alerts: DashboardAlert[] = []

  // Update available
  if (data.latestVersion && data.latestVersion !== data.currentVersion) {
    alerts.push({
      key: `update-available-${data.latestVersion}`,
      type: "update-available",
      trackerId: null,
      trackerName: "System",
      trackerColor: "var(--color-accent)",
      message: `Version ${data.latestVersion} is available (current: ${data.currentVersion})`,
      dismissible: true,
    })
  }

  // Failed backups (most recent only)
  if (data.failedBackups.length > 0) {
    const latest = data.failedBackups[0]
    alerts.push({
      key: `backup-failed-${latest.createdAt}`,
      type: "backup-failed",
      trackerId: null,
      trackerName: "Backups",
      trackerColor: "var(--color-danger)",
      message: `Scheduled backup failed at ${formatDateTime(latest.createdAt)}`,
      timestamp: latest.createdAt,
      dismissible: true,
    })
  }

  // DL Client errors (non-dismissible)
  for (const client of data.clients) {
    if (client.enabled && client.lastError) {
      alerts.push({
        key: `client-error-${client.id}`,
        type: "client-error",
        trackerId: null,
        trackerName: client.name,
        trackerColor: "var(--color-danger)",
        message: client.lastError,
        dismissible: false,
      })
    }
  }

  return alerts
}
