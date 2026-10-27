// src/lib/prowlarr/sync.ts
//
// Functions: decryptInstanceKey, testProwlarrInstance, pollProwlarrInstance,
//            loadTrackerProwlarrStates, listIndexerOptions
//
// Reads each Prowlarr instance into prowlarr_indexers and turns those rows into
// the per-tracker state on TrackerSummary. A failed poll is recorded on the
// instance and never on a tracker. Polls go through requestProwlarrPoll in
// prowlarr-scheduler.ts, so two polls of one instance never overlap.

import "server-only"

import { and, eq, inArray, notInArray, sql } from "drizzle-orm"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { prowlarrIndexers, prowlarrInstances } from "@/lib/db/schema"
import { errMsg, isDecryptionError } from "@/lib/error-utils"
import {
  PROWLARR_INDEXER_REFRESH_MS,
  PROWLARR_STALE_MS,
  PROWLARR_STATS_REFRESH_MS,
} from "@/lib/limits"
import { log } from "@/lib/logger"
import {
  fetchIndexerStats,
  fetchIndexerStatuses,
  fetchIndexers,
  fetchSystemStatus,
  type ProwlarrConnection,
  sanitizeProwlarrError,
} from "@/lib/prowlarr/client"
import { type MatchableTracker, matchTrackerIndexers } from "@/lib/prowlarr/matching"
import type {
  ProwlarrIndexerOption,
  ProwlarrIndexerStats,
  TrackerProwlarrIndexer,
  TrackerProwlarrState,
} from "@/types/api"

const DAY_MS = 24 * 60 * 60 * 1000

type KeyedInstance = { url: string; encryptedApiKey: string | null }

/** A problem with the stored settings, already worded for the UI. */
class ProwlarrSetupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProwlarrSetupError"
  }
}

function describeFailure(err: unknown): string {
  if (err instanceof ProwlarrSetupError) return err.message
  if (isDecryptionError(err)) return "Stored API key could not be decrypted"
  return sanitizeProwlarrError(errMsg(err))
}

/** Decryption errors are thrown as they are, so a request route can answer them with a 401. */
export function decryptInstanceKey(instance: KeyedInstance, key: Buffer): ProwlarrConnection {
  if (!instance.encryptedApiKey) {
    throw new ProwlarrSetupError("No API key stored. Enter the Prowlarr API key")
  }
  return { url: instance.url, apiKey: decrypt(instance.encryptedApiKey, key) }
}

/** One cheap request, for the settings page's Test Connection button. */
export async function testProwlarrInstance(
  instance: KeyedInstance,
  key: Buffer
): Promise<{ version: string | null } | { error: string }> {
  const conn = decryptInstanceKey(instance, key)
  try {
    return await fetchSystemStatus(conn)
  } catch (err) {
    return { error: describeFailure(err) }
  }
}

function isDue(readAt: Date | null, now: Date, intervalMs: number): boolean {
  return !readAt || now.getTime() - readAt.getTime() >= intervalMs
}

type StatsWindow = "24h" | "7d"

const STATS_WINDOW_MS: Record<StatsWindow, number> = { "24h": DAY_MS, "7d": 7 * DAY_MS }

// The last stats failure per instance and window, so each cause is logged once.
const statsFailures = new Map<string, string>()

/**
 * One stats window, or undefined when the read fails. Stats are only shown, so
 * a failure does not fail the poll, and the stored stats age out of the card.
 */
async function readStats(
  conn: ProwlarrConnection,
  instanceId: number,
  window: StatsWindow,
  now: Date
): Promise<Map<number, ProwlarrIndexerStats> | undefined> {
  const failureKey = `${instanceId}:${window}`
  try {
    const stats = await fetchIndexerStats(
      conn,
      new Date(now.getTime() - STATS_WINDOW_MS[window]),
      now
    )
    if (statsFailures.delete(failureKey)) {
      log.info({ prowlarrInstanceId: instanceId, window }, "Prowlarr stats read recovered")
    }
    return stats
  } catch (err) {
    const message = describeFailure(err)
    if (statsFailures.get(failureKey) !== message) {
      statsFailures.set(failureKey, message)
      log.warn(
        { prowlarrInstanceId: instanceId, window, cause: errMsg(err) },
        `Prowlarr ${window} stats read failed: ${message}`
      )
    }
    return undefined
  }
}

/**
 * Reads the indexer status of one instance, plus the indexer list and the
 * stats when they are due or `readIndexers` is set. All reads finish before
 * any write, so a poll with a failed status or list request changes only the
 * instance's error.
 */
export async function pollProwlarrInstance(
  instanceId: number,
  key: Buffer,
  options: { readIndexers?: boolean } = {}
): Promise<void> {
  const [instance] = await db
    .select({
      id: prowlarrInstances.id,
      url: prowlarrInstances.url,
      encryptedApiKey: prowlarrInstances.encryptedApiKey,
      enabled: prowlarrInstances.enabled,
      lastError: prowlarrInstances.lastError,
      indexersReadAt: prowlarrInstances.indexersReadAt,
      statsAttemptedAt: prowlarrInstances.statsAttemptedAt,
    })
    .from(prowlarrInstances)
    .where(eq(prowlarrInstances.id, instanceId))
    .limit(1)
  if (!instance?.enabled) return

  const now = new Date()
  const readIndexers =
    options.readIndexers === true ||
    isDue(instance.indexersReadAt, now, PROWLARR_INDEXER_REFRESH_MS)
  // Due by the last attempt, so a failed read waits for the next hour.
  const dayStatsDue =
    readIndexers || isDue(instance.statsAttemptedAt, now, PROWLARR_STATS_REFRESH_MS)

  try {
    const conn = decryptInstanceKey(instance, key)
    const [indexers, statuses, version, dayStats, weekStats] = await Promise.all([
      readIndexers ? fetchIndexers(conn) : null,
      fetchIndexerStatuses(conn),
      // Only shown in settings, so a failure here does not fail the poll.
      readIndexers
        ? fetchSystemStatus(conn).then(
            (s) => s.version,
            () => undefined
          )
        : undefined,
      dayStatsDue ? readStats(conn, instanceId, "24h", now) : undefined,
      // Read with the list only, so a failed read waits for the next one.
      readIndexers ? readStats(conn, instanceId, "7d", now) : undefined,
    ])
    const statusById = new Map(statuses.map((s) => [s.indexerId, s]))
    const failureFields = (indexerId: number) => {
      const failure = statusById.get(indexerId)
      return {
        disabledTill: failure?.disabledTill ?? null,
        mostRecentFailure: failure?.mostRecentFailure ?? null,
        initialFailure: failure?.initialFailure ?? null,
        checkedAt: now,
      }
    }
    // A window that was not read is left out, so its stored stats are kept.
    const statsFields = (indexerId: number): Record<string, ProwlarrIndexerStats | null> => ({
      ...(dayStats ? { stats24h: dayStats.get(indexerId) ?? null } : {}),
      ...(weekStats ? { stats7d: weekStats.get(indexerId) ?? null } : {}),
    })

    await db.transaction(async (tx) => {
      if (indexers) {
        const ids = indexers.map((i) => i.indexerId)
        await tx
          .delete(prowlarrIndexers)
          .where(
            ids.length > 0
              ? and(
                  eq(prowlarrIndexers.instanceId, instanceId),
                  notInArray(prowlarrIndexers.indexerId, ids)
                )
              : eq(prowlarrIndexers.instanceId, instanceId)
          )
        for (const indexer of indexers) {
          const values = {
            name: indexer.name,
            enabled: indexer.enabled,
            hosts: indexer.hosts,
            ...failureFields(indexer.indexerId),
            ...statsFields(indexer.indexerId),
          }
          await tx
            .insert(prowlarrIndexers)
            .values({ instanceId, indexerId: indexer.indexerId, ...values })
            .onConflictDoUpdate({
              target: [prowlarrIndexers.instanceId, prowlarrIndexers.indexerId],
              set: values,
            })
        }
      } else {
        // An indexer added in Prowlarr since the last list read has no row yet,
        // so its status is skipped until the next one.
        await tx
          .update(prowlarrIndexers)
          .set({ ...failureFields(0), ...statsFields(0) })
          .where(eq(prowlarrIndexers.instanceId, instanceId))
        const changed = new Set([
          ...statuses.map((s) => s.indexerId),
          ...(dayStats?.keys() ?? []),
          ...(weekStats?.keys() ?? []),
        ])
        for (const indexerId of changed) {
          await tx
            .update(prowlarrIndexers)
            .set({ ...failureFields(indexerId), ...statsFields(indexerId) })
            .where(
              and(
                eq(prowlarrIndexers.instanceId, instanceId),
                eq(prowlarrIndexers.indexerId, indexerId)
              )
            )
        }
      }
      await tx
        .update(prowlarrInstances)
        .set({
          lastPolledAt: now,
          lastError: null,
          errorSince: null,
          ...(readIndexers ? { indexersReadAt: now } : {}),
          ...(dayStatsDue ? { statsAttemptedAt: now } : {}),
          ...(dayStats ? { statsReadAt: now } : {}),
          ...(weekStats ? { stats7dReadAt: now } : {}),
          ...(version !== undefined ? { version: version?.slice(0, 50) ?? null } : {}),
        })
        .where(eq(prowlarrInstances.id, instanceId))
    })

    if (instance.lastError) log.info({ prowlarrInstanceId: instanceId }, "Prowlarr poll recovered")
  } catch (err) {
    const raw = errMsg(err)
    const message = describeFailure(err)
    // Logged on a change of cause only. The raw cause names the host at most,
    // never the URL path or the key.
    if (message !== instance.lastError) {
      log.warn({ prowlarrInstanceId: instanceId, cause: raw }, `Prowlarr poll failed: ${message}`)
    }
    try {
      await db
        .update(prowlarrInstances)
        .set({
          lastError: message,
          errorSince: sql`COALESCE(${prowlarrInstances.errorSince}, NOW())`,
        })
        .where(eq(prowlarrInstances.id, instanceId))
    } catch (dbErr) {
      log.error(
        { prowlarrInstanceId: instanceId, error: errMsg(dbErr) },
        "Failed to record Prowlarr poll error"
      )
    }
  }
}

/**
 * Stored stats while current, else null with the time they were last read.
 * They are shown for two refresh intervals, so one missed read does not hide them.
 */
function currentStats(
  stored: unknown,
  readAt: Date | null | undefined,
  window: StatsWindow,
  nowMs: number
): { stats: ProwlarrIndexerStats | null; staleSince: Date | null } {
  const stats = (stored as ProwlarrIndexerStats | null) ?? null
  if (!stats) return { stats: null, staleSince: null }
  const refreshMs = window === "24h" ? PROWLARR_STATS_REFRESH_MS : PROWLARR_INDEXER_REFRESH_MS
  if (readAt && nowMs - readAt.getTime() <= 2 * refreshMs) return { stats, staleSince: null }
  return { stats: null, staleSince: readAt ?? null }
}

interface StoredIndexer extends TrackerProwlarrIndexer {
  hosts: string[]
}

async function loadStoredIndexers(): Promise<StoredIndexer[]> {
  const instances = await db
    .select({
      id: prowlarrInstances.id,
      name: prowlarrInstances.name,
      url: prowlarrInstances.url,
      publicUrl: prowlarrInstances.publicUrl,
      lastError: prowlarrInstances.lastError,
      statsReadAt: prowlarrInstances.statsReadAt,
      stats7dReadAt: prowlarrInstances.stats7dReadAt,
    })
    .from(prowlarrInstances)
    .where(eq(prowlarrInstances.enabled, true))
  if (instances.length === 0) return []

  const byId = new Map(instances.map((i) => [i.id, i]))
  const nowMs = Date.now()
  const staleBefore = nowMs - PROWLARR_STALE_MS
  const rows = await db
    .select({
      instanceId: prowlarrIndexers.instanceId,
      indexerId: prowlarrIndexers.indexerId,
      name: prowlarrIndexers.name,
      enabled: prowlarrIndexers.enabled,
      hosts: prowlarrIndexers.hosts,
      disabledTill: prowlarrIndexers.disabledTill,
      mostRecentFailure: prowlarrIndexers.mostRecentFailure,
      initialFailure: prowlarrIndexers.initialFailure,
      stats24h: prowlarrIndexers.stats24h,
      stats7d: prowlarrIndexers.stats7d,
      checkedAt: prowlarrIndexers.checkedAt,
    })
    .from(prowlarrIndexers)
    .where(inArray(prowlarrIndexers.instanceId, [...byId.keys()]))
    .orderBy(prowlarrIndexers.instanceId, prowlarrIndexers.name)

  return rows.map((row) => {
    const instance = byId.get(row.instanceId)
    const day = currentStats(row.stats24h, instance?.statsReadAt, "24h", nowMs)
    const week = currentStats(row.stats7d, instance?.stats7dReadAt, "7d", nowMs)
    const staleReads = [day.staleSince, week.staleSince].filter((d): d is Date => d !== null)
    return {
      instanceId: row.instanceId,
      instanceName: instance?.name ?? "",
      instanceUrl: instance?.url ?? "",
      instancePublicUrl: instance?.publicUrl ?? null,
      instanceError: instance?.lastError ?? null,
      stale: row.checkedAt.getTime() < staleBefore,
      indexerId: row.indexerId,
      name: row.name,
      enabled: row.enabled,
      hosts: row.hosts ?? [],
      disabledTill: row.disabledTill?.toISOString() ?? null,
      mostRecentFailure: row.mostRecentFailure?.toISOString() ?? null,
      initialFailure: row.initialFailure?.toISOString() ?? null,
      checkedAt: row.checkedAt.toISOString(),
      stats24h: day.stats,
      stats7d: week.stats,
      statsStaleSince:
        staleReads.length > 0
          ? new Date(Math.min(...staleReads.map((d) => d.getTime()))).toISOString()
          : null,
    }
  })
}

/**
 * The matched Prowlarr state for each tracker, keyed by tracker id. Trackers
 * with no match are absent. One query when no instance is enabled.
 */
export async function loadTrackerProwlarrStates(
  trackers: readonly (MatchableTracker & { id: number })[]
): Promise<Map<number, TrackerProwlarrState>> {
  const out = new Map<number, TrackerProwlarrState>()
  const stored = await loadStoredIndexers()
  if (stored.length === 0) return out
  for (const tracker of trackers) {
    const match = matchTrackerIndexers(tracker, stored)
    if (!match) continue
    out.set(tracker.id, {
      matchedBy: match.matchedBy,
      indexers: match.indexers.map(({ hosts: _hosts, ...indexer }) => indexer),
    })
  }
  return out
}

/** Every stored indexer of an enabled instance, for the manual match picker. */
export async function listIndexerOptions(): Promise<ProwlarrIndexerOption[]> {
  const stored = await loadStoredIndexers()
  return stored.map((i) => ({
    instanceId: i.instanceId,
    instanceName: i.instanceName,
    indexerId: i.indexerId,
    name: i.name,
    hosts: i.hosts,
  }))
}
