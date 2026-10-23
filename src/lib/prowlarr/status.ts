// src/lib/prowlarr/status.ts
//
// Functions: getIndexerStatus, isIndexerFailing, getProwlarrFailure, describeProwlarrFailure,
//            describeIndexerStatus, statsTotals
//
// Client-safe reading of the Prowlarr state included in TrackerSummary. tracker-status.ts
// builds the tracker's warning from this, so every view derives it the same way.

import { formatDateTime } from "@/lib/formatters"
import type { ProwlarrIndexerStats, TrackerProwlarrIndexer, TrackerSummary } from "@/types/api"

type IndexerStatus = "ok" | "failing" | "disabled" | "unreachable" | "stale"

type IndexerStatusInput = Pick<
  TrackerProwlarrIndexer,
  "instanceError" | "enabled" | "stale" | "disabledTill" | "checkedAt"
>

/**
 * Prowlarr lists an indexer in /indexerstatus only while it is backed off after
 * failures, so a disabledTill from the last check is the failure signal. It is
 * compared with that check rather than the clock: once the backoff ends the
 * indexer stays failing until Prowlarr's next attempt succeeds. Nothing here
 * reads the clock, so every view gives the same result for the same data.
 */
export function getIndexerStatus(indexer: IndexerStatusInput): IndexerStatus {
  if (indexer.instanceError) return "unreachable"
  if (!indexer.enabled) return "disabled"
  if (indexer.stale) return "stale"
  if (indexer.disabledTill && Date.parse(indexer.disabledTill) > Date.parse(indexer.checkedAt)) {
    return "failing"
  }
  return "ok"
}

export function isIndexerFailing(indexer: IndexerStatusInput): boolean {
  return getIndexerStatus(indexer) === "failing"
}

/** The tracker's longest-failing matched indexer, or null when none is failing. */
export function getProwlarrFailure(
  tracker: Pick<TrackerSummary, "prowlarr">
): TrackerProwlarrIndexer | null {
  const failing = (tracker.prowlarr?.indexers ?? []).filter(isIndexerFailing)
  if (failing.length === 0) return null
  const since = (i: TrackerProwlarrIndexer) =>
    Date.parse(i.initialFailure ?? i.mostRecentFailure ?? i.checkedAt)
  return failing.reduce((a, b) => (since(b) < since(a) ? b : a))
}

export function describeProwlarrFailure(indexer: TrackerProwlarrIndexer): string {
  const since = indexer.initialFailure ?? indexer.mostRecentFailure
  const sinceText = since ? ` since ${formatDateTime(since)}` : ""
  const retryText = indexer.disabledTill
    ? `, retrying at ${formatDateTime(indexer.disabledTill)}`
    : ""
  return `Failing in Prowlarr${sinceText}${retryText}`
}

export function describeIndexerStatus(indexer: TrackerProwlarrIndexer): string {
  switch (getIndexerStatus(indexer)) {
    case "failing":
      return describeProwlarrFailure(indexer)
    case "unreachable":
      return `Prowlarr unreachable: ${indexer.instanceError}`
    case "disabled":
      return "Disabled in Prowlarr"
    case "stale":
      return `No recent reading from Prowlarr (last ${formatDateTime(indexer.checkedAt)})`
    case "ok":
      return "OK"
  }
}

/** Every request Prowlarr counted, and how many of them failed. */
export function statsTotals(stats: ProwlarrIndexerStats): {
  requests: number
  failed: number
  failureRate: number | null
} {
  const requests = stats.queries + stats.rssQueries + stats.grabs + stats.authQueries
  const failed =
    stats.failedQueries + stats.failedRssQueries + stats.failedGrabs + stats.failedAuthQueries
  return { requests, failed, failureRate: requests > 0 ? failed / requests : null }
}

export type { IndexerStatus }
