// src/lib/prowlarr/sync.ts
//
// Functions: decryptInstanceKey, testProwlarrInstance, retestProwlarrIndexer,
//            pollProwlarrInstance, loadTrackerProwlarrStates, listIndexerOptions
//
// Reads each Prowlarr instance into prowlarr_indexers and turns those rows into
// the per-tracker state on TrackerSummary. A failed poll is recorded on the
// instance and never on a tracker.

import "server-only"

import { and, eq, inArray, notInArray, sql } from "drizzle-orm"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { prowlarrIndexers, prowlarrInstances } from "@/lib/db/schema"
import { errMsg, isDecryptionError } from "@/lib/error-utils"
import { PROWLARR_STALE_MS } from "@/lib/limits"
import { log } from "@/lib/logger"
import {
  fetchHealth,
  fetchIndexerStats,
  fetchIndexerStatuses,
  fetchIndexers,
  fetchSystemStatus,
  type ProwlarrConnection,
  retestIndexer,
  sanitizeProwlarrError,
} from "@/lib/prowlarr/client"
import { matchTrackerIndexers } from "@/lib/prowlarr/matching"
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
  return err instanceof ProwlarrSetupError ? err.message : sanitizeProwlarrError(errMsg(err))
}

export function decryptInstanceKey(instance: KeyedInstance, key: Buffer): ProwlarrConnection {
  if (!instance.encryptedApiKey) {
    throw new ProwlarrSetupError("No API key stored. Enter the Prowlarr API key")
  }
  try {
    return { url: instance.url, apiKey: decrypt(instance.encryptedApiKey, key) }
  } catch (err) {
    if (isDecryptionError(err)) {
      throw new ProwlarrSetupError("Stored API key could not be decrypted. Re-enter it")
    }
    throw err
  }
}

/** One cheap request, for the settings page's Test Connection button. */
export async function testProwlarrInstance(
  instance: KeyedInstance,
  key: Buffer
): Promise<{ version: string | null } | { error: string }> {
  try {
    return await fetchSystemStatus(decryptInstanceKey(instance, key))
  } catch (err) {
    return { error: describeFailure(err) }
  }
}

/**
 * Runs Prowlarr's test for one indexer, then re-reads the instance so a cleared
 * backoff is shown immediately. A failed test is returned as a test result, not
 * as a connection error.
 */
export async function retestProwlarrIndexer(
  instance: KeyedInstance & { id: number },
  indexerId: number,
  key: Buffer
): Promise<{ ok: true } | { failures: string[] } | { error: string }> {
  let result: { ok: true } | { failures: string[] }
  try {
    result = await retestIndexer(decryptInstanceKey(instance, key), indexerId)
  } catch (err) {
    return { error: describeFailure(err) }
  }
  await pollProwlarrInstance(instance.id, key)
  return result
}

/**
 * Fetches everything for one instance and replaces its stored indexers. All
 * reads finish before any write, so a poll with a failed request changes only
 * the instance's error.
 */
export async function pollProwlarrInstance(instanceId: number, key: Buffer): Promise<void> {
  const [instance] = await db
    .select({
      id: prowlarrInstances.id,
      url: prowlarrInstances.url,
      encryptedApiKey: prowlarrInstances.encryptedApiKey,
      enabled: prowlarrInstances.enabled,
      lastError: prowlarrInstances.lastError,
    })
    .from(prowlarrInstances)
    .where(eq(prowlarrInstances.id, instanceId))
    .limit(1)
  if (!instance?.enabled) return

  try {
    const conn = decryptInstanceKey(instance, key)
    const now = new Date()
    const [status, indexers, statuses, stats24h, stats7d, health] = await Promise.all([
      fetchSystemStatus(conn),
      fetchIndexers(conn),
      fetchIndexerStatuses(conn),
      fetchIndexerStats(conn, new Date(now.getTime() - DAY_MS), now),
      fetchIndexerStats(conn, new Date(now.getTime() - 7 * DAY_MS), now),
      fetchHealth(conn),
    ])
    const statusById = new Map(statuses.map((s) => [s.indexerId, s]))

    await db.transaction(async (tx) => {
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
        const failure = statusById.get(indexer.indexerId)
        const values = {
          name: indexer.name,
          definitionName: indexer.definitionName,
          enabled: indexer.enabled,
          privacy: indexer.privacy,
          hosts: indexer.hosts,
          disabledTill: failure?.disabledTill ?? null,
          mostRecentFailure: failure?.mostRecentFailure ?? null,
          initialFailure: failure?.initialFailure ?? null,
          stats24h: stats24h.get(indexer.indexerId) ?? null,
          stats7d: stats7d.get(indexer.indexerId) ?? null,
          checkedAt: now,
        }
        await tx
          .insert(prowlarrIndexers)
          .values({ instanceId, indexerId: indexer.indexerId, ...values })
          .onConflictDoUpdate({
            target: [prowlarrIndexers.instanceId, prowlarrIndexers.indexerId],
            set: values,
          })
      }
      await tx
        .update(prowlarrInstances)
        .set({
          lastPolledAt: now,
          lastError: null,
          errorSince: null,
          version: status.version?.slice(0, 50) ?? null,
          healthIssues: health,
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

interface StoredIndexer extends TrackerProwlarrIndexer {
  hosts: string[]
}

async function loadStoredIndexers(): Promise<StoredIndexer[]> {
  const instances = await db
    .select({
      id: prowlarrInstances.id,
      name: prowlarrInstances.name,
      lastError: prowlarrInstances.lastError,
    })
    .from(prowlarrInstances)
    .where(eq(prowlarrInstances.enabled, true))
  if (instances.length === 0) return []

  const byId = new Map(instances.map((i) => [i.id, i]))
  const staleBefore = Date.now() - PROWLARR_STALE_MS
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
    return {
      instanceId: row.instanceId,
      instanceName: instance?.name ?? "",
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
      stats24h: (row.stats24h as ProwlarrIndexerStats | null) ?? null,
      stats7d: (row.stats7d as ProwlarrIndexerStats | null) ?? null,
    }
  })
}

/**
 * The matched Prowlarr state for each tracker, keyed by tracker id. Trackers
 * with no match are absent. One query when no instance is enabled.
 */
export async function loadTrackerProwlarrStates(
  trackers: readonly {
    id: number
    baseUrl: string
    registrySlug: string | null
    prowlarrIndexer: string | null
  }[]
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
