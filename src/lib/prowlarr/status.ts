// src/lib/prowlarr/status.ts
//
// Functions: getIndexerStatus, isIndexerFailing, getProwlarrFailures, describeIndexerStatus,
//            prowlarrIndexersUrl, statsTotals
//
// Client-safe reading of the Prowlarr state included in TrackerSummary. It is
// shown next to the tracker's health and never changes it.

import { formatDateTime } from "@/lib/formatters"
import type { ProwlarrIndexerStats, TrackerProwlarrIndexer, TrackerSummary } from "@/types/api"

type IndexerStatus = "ok" | "failing" | "disabled" | "prowlarr-error" | "stale"

type IndexerStatusInput = Pick<
  TrackerProwlarrIndexer,
  "instanceError" | "enabled" | "stale" | "disabledTill" | "checkedAt"
>

/**
 * Prowlarr lists an indexer in /indexerstatus only while its DisabledTill is
 * in the future, so an indexer reads as failing only while it is backed off.
 * The first reading after a backoff ends is ok whether or not Prowlarr has
 * retried it yet. The backoff is compared with the reading's own time, not the
 * clock, so every view gives the same result for the same data.
 */
export function getIndexerStatus(indexer: IndexerStatusInput): IndexerStatus {
  if (indexer.instanceError) return "prowlarr-error"
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

/** The tracker's failing matched indexers, longest-failing first. */
export function getProwlarrFailures(
  tracker: Pick<TrackerSummary, "prowlarr">
): TrackerProwlarrIndexer[] {
  const since = (i: TrackerProwlarrIndexer) =>
    Date.parse(i.initialFailure ?? i.mostRecentFailure ?? i.checkedAt)
  return (tracker.prowlarr?.indexers ?? [])
    .filter(isIndexerFailing)
    .sort((a, b) => since(a) - since(b))
}

export function describeIndexerStatus(indexer: TrackerProwlarrIndexer): string {
  switch (getIndexerStatus(indexer)) {
    case "failing": {
      const since = indexer.initialFailure ?? indexer.mostRecentFailure
      const sinceText = since ? ` since ${formatDateTime(since)}` : ""
      const retryText = indexer.disabledTill
        ? `, retrying at ${formatDateTime(indexer.disabledTill)}`
        : ""
      return `Failing in Prowlarr${sinceText}${retryText}`
    }
    case "prowlarr-error":
      return indexer.instanceError ?? ""
    case "disabled":
      return "Disabled in Prowlarr"
    case "stale":
      return `No recent reading from Prowlarr (last ${formatDateTime(indexer.checkedAt)})`
    case "ok":
      return "OK in Prowlarr"
  }
}

/** Prowlarr's own Indexers page, where a backed-off indexer can be tested or edited. */
export function prowlarrIndexersUrl(indexer: Pick<TrackerProwlarrIndexer, "instanceUrl">): string {
  return `${indexer.instanceUrl.replace(/\/+$/, "")}/indexers`
}

/**
 * Queries are searches, RSS and auth requests. Prowlarr counts each history
 * event under one type, so grabs are separate, but the failed share is over
 * every request including grabs.
 */
export function statsTotals(stats: ProwlarrIndexerStats): {
  queries: number
  failed: number
  failureRate: number | null
} {
  const queries = stats.queries + stats.rssQueries + stats.authQueries
  const requests = queries + stats.grabs
  const failed =
    stats.failedQueries + stats.failedRssQueries + stats.failedGrabs + stats.failedAuthQueries
  return { queries, failed, failureRate: requests > 0 ? failed / requests : null }
}

export type { IndexerStatus }
