// src/lib/download-client-scheduler.ts
//
// Two polling loops with different cadences:
//   heartbeat: lightweight (login + getTransferInfo, 2 requests). Runs every 5s.
//             Stores upload/download speed in memory cache. Updates connection status.
//             Records success/failure in uptime accumulator (5-min buckets).
//   deep poll: heavy (login + syncMaindata delta, post-filter, aggregation).
//             Runs on each client's configured pollIntervalSeconds.
//             Stores full tagStats alongside speed data.
//
// Functions: heartbeatClient, heartbeatAllClients, deepPollClient, deepPollAllClients,
//            startClientScheduler, stopClientScheduler, isClientSchedulerRunning,
//            ensureClientSchedulerRunning
//
// Side effects of deepPollClient:
//   - Writes torrent daily checkpoints (torrentDailyCheckpoints) for "Movers & Shakers".
//     Uses onConflictDoNothing so the first poll of the day wins; subsequent polls skip.
//   - Writes one clientSnapshots row per successful poll, inserted before the
//     downloadClients status update and skipped when the sync store is
//     uninitialised or refused the update. Zeros would read as an idle client
//     and stale figures as a fresh reading.
//
// Retention: the hourly prune below deletes clientSnapshots and
// clientUptimeBuckets only when app_settings.snapshot_retention_days is
// positive. NULL means keep forever (see db/schema.ts) and must not be
// defaulted to a number here.
//
// Failure logging for both loops goes through failure-log-gate.ts, which logs
// state changes only (outage onset, a changed cause, a periodic reminder,
// recovery). Uptime recording sits outside the gate, so every attempt is still
// recorded.

import { eq, lt, sql } from "drizzle-orm"
import cron, { type ScheduledTask } from "node-cron"
import { db } from "@/lib/db"
import {
  appSettings,
  clientSnapshots,
  clientUptimeBuckets,
  downloadClients,
  torrentDailyCheckpoints,
  trackers,
} from "@/lib/db/schema"
import {
  aggregateByTag,
  applyMaindataUpdate,
  clearAllSessions,
  clearSpeedCache,
  createAdapterForClient,
  getFilteredTorrents,
  getStoreRevision,
  isStoreInitialized,
  pushSpeedSnapshot,
  replaceStoreTorrents,
  slimTorrentForCache,
} from "@/lib/download-clients"
import { sanitizeNetworkError } from "@/lib/error-utils"
import {
  clearFailureLogGate,
  noteFailure,
  noteSuccess,
  retainFailureLogClients,
} from "@/lib/failure-log-gate"
import { parseTorrentTags } from "@/lib/fleet"
import { localDateStr } from "@/lib/formatters"
import { log } from "@/lib/logger"
import { createTrackedTorrentPredicate, trackerHostKey } from "@/lib/tracker-matching"
import { clearUptimeAccumulator, flushCompletedBuckets, recordHeartbeat } from "@/lib/uptime"

/** Needed by heartbeatClient. Excludes large blobs like cachedTorrents */
export const HEARTBEAT_COLUMNS = {
  id: downloadClients.id,
  enabled: downloadClients.enabled,
  name: downloadClients.name,
  type: downloadClients.type,
  host: downloadClients.host,
  port: downloadClients.port,
  useSsl: downloadClients.useSsl,
  authMethod: downloadClients.authMethod,
  encryptedUsername: downloadClients.encryptedUsername,
  encryptedPassword: downloadClients.encryptedPassword,
  encryptedApiKey: downloadClients.encryptedApiKey,
  encryptedUrlPath: downloadClients.encryptedUrlPath,
  crossSeedTags: downloadClients.crossSeedTags,
  lastError: downloadClients.lastError,
} as const

/** Needed by deepPollClient. Heartbeat fields + poll config */
export const DEEP_POLL_COLUMNS = {
  ...HEARTBEAT_COLUMNS,
  pollIntervalSeconds: downloadClients.pollIntervalSeconds,
  lastPolledAt: downloadClients.lastPolledAt,
} as const

// Store on globalThis to survive HMR in development.
// Without this, each hot-reload orphans the old cron job while creating a new one.
const g = globalThis as typeof globalThis & {
  __clientHeartbeatTask?: ScheduledTask | null
  __clientDeepPollTask?: ScheduledTask | null
  __heartbeatInFlight?: boolean
  __deepPollInFlight?: boolean
  __lastPruneAt?: number
}
const PRUNE_INTERVAL_MS = 60 * 60 * 1000

function getHeartbeatTask(): ScheduledTask | null {
  return g.__clientHeartbeatTask ?? null
}
function setHeartbeatTask(task: ScheduledTask | null) {
  g.__clientHeartbeatTask = task
}
function getDeepPollTask(): ScheduledTask | null {
  return g.__clientDeepPollTask ?? null
}
function setDeepPollTask(task: ScheduledTask | null) {
  g.__clientDeepPollTask = task
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

async function heartbeatClient(
  client: {
    id: number
    name: string
    type: string
    host: string
    port: number
    useSsl: boolean
    authMethod: string
    encryptedUsername: string
    encryptedPassword: string
    encryptedApiKey: string
    encryptedUrlPath: string
    crossSeedTags: string[] | null
    lastError: string | null
  },
  encryptionKey: Buffer
): Promise<void> {
  try {
    const adapter = createAdapterForClient(client, encryptionKey)
    const stats = await adapter.getTransferInfo()
    pushSpeedSnapshot(client.id, stats)
    recordHeartbeat(client.id, true)

    // Unconditional, and deliberately outside the DB guard below: the gate is
    // memory-backed, so it must clear even when lastError already reads null.
    // For a healthy client this is one Map lookup that returns null.
    const recovered = noteSuccess(client.id, "heartbeat")
    if (recovered) {
      log.info(
        {
          clientId: client.id,
          clientName: client.name,
          previousFailures: recovered.failures,
          downForMs: recovered.downForMs,
        },
        "client outage cleared by successful heartbeat"
      )
    }

    // Only write to DB if recovering from error. Skip if already healthy.
    if (client.lastError !== null) {
      await db
        .update(downloadClients)
        .set({ lastError: null, errorSince: null, updatedAt: new Date() })
        .where(eq(downloadClients.id, client.id))
    }
  } catch (error) {
    recordHeartbeat(client.id, false)
    const raw = error instanceof Error ? error.message : "Unknown error"
    const message = sanitizeNetworkError(raw)
    const verdict = noteFailure(client.id, "heartbeat", raw)
    // `message` is deliberately lossy. It is what reaches the UI. Keep the
    // unsanitised cause in the server log too, or a missing DB column, a DNS
    // failure and a refused connection are all indistinguishable from the
    // "Connection failed" fallback. Safe to log because transport messages name
    // the client without its URL path, which can carry a proxy key.
    const base = { clientId: client.id, clientName: client.name, cause: raw }
    switch (verdict.kind) {
      case "first":
        log.error(base, `Heartbeat failed for client ${client.id} (${client.name}): ${message}`)
        break
      case "cause-changed":
        log.error(
          {
            ...base,
            previousCause: verdict.previousCause,
            outageSince: verdict.since,
            failures: verdict.failures,
            suppressed: verdict.suppressed,
          },
          `Heartbeat failure changed for client ${client.id} (${client.name}): ${message}`
        )
        break
      case "reminder": {
        const downForMs = Date.now() - verdict.since
        log.warn(
          {
            ...base,
            outageSince: verdict.since,
            failures: verdict.failures,
            suppressed: verdict.suppressed,
            distinctCauses: verdict.distinctCauses,
            downForMs,
          },
          `Heartbeat still failing for client ${client.id} (${client.name}), down ${Math.round(downForMs / 60_000)}m, ${verdict.failures} failed attempts, ${verdict.suppressed} log lines suppressed: ${message}`
        )
        break
      }
      case "silent":
        break
    }
    try {
      await db
        .update(downloadClients)
        .set({
          lastError: message,
          errorSince: sql`COALESCE(${downloadClients.errorSince}, NOW())`,
          updatedAt: new Date(),
        })
        .where(eq(downloadClients.id, client.id))
    } catch (dbErr) {
      log.error(
        `Failed to record heartbeat error for client ${client.id}: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`
      )
    }
  }
}

async function heartbeatAllClients(encryptionKey: Buffer): Promise<void> {
  const allClients = await db
    .select(HEARTBEAT_COLUMNS)
    .from(downloadClients)
    .where(eq(downloadClients.enabled, true))

  // Sweep before the early return: an empty enabled set must still clear every
  // entry, or the last client to be disabled strands its state and a later
  // re-enable is wrongly treated as a repeat instead of a fresh first failure.
  // This one line covers deletion, disable, and restore-from-backup. It also
  // sweeps deep-poll keys. A disabled client should hold neither.
  retainFailureLogClients(new Set(allClients.map((c) => c.id)))

  if (allClients.length === 0) return

  await Promise.allSettled(allClients.map((c) => heartbeatClient(c, encryptionKey)))
}

// ---------------------------------------------------------------------------
// Deep poll
// ---------------------------------------------------------------------------

/**
 * The sync store refused a whole update, so it still holds the previous poll.
 * A class rather than a recognisable message because the catch below has to
 * tell this verdict of ours apart from a fault the host reported.
 */
class SyncStoreRefusedError extends Error {
  constructor(cap: number) {
    super(`Sync store limit reached: this client would hold more than ${cap} torrents`)
    this.name = "SyncStoreRefusedError"
  }
}

export async function deepPollClient(
  clientId: number,
  encryptionKey: Buffer,
  trackerTags: string[],
  announceHostKeys: ReadonlySet<string> = new Set()
): Promise<void> {
  const [client] = await db
    .select(DEEP_POLL_COLUMNS)
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!client?.enabled) return
  // Skip clients whose credential columns were never written (i.e. cleared by
  // a restore). Blank username/password is a valid configuration. qBittorrent
  // bypasses auth for localhost, so this checks for a missing *ciphertext*,
  // not a missing secret, and reads whichever column the auth mode uses.
  //
  // heartbeatClient has no matching guard, so a silent skip would leave the
  // client heartbeating green while recording nothing. The warning goes through
  // the failure-log gate: one line plus a reminder every 15 minutes.
  const missingCredentials =
    client.authMethod === "apikey"
      ? !client.encryptedApiKey
      : !client.encryptedUsername || !client.encryptedPassword
  if (missingCredentials) {
    const verdict = noteFailure(clientId, "deep-poll", "missing credential ciphertext")
    if (verdict.kind !== "silent") {
      log.warn(
        { clientId, clientName: client.name, authMethod: client.authMethod },
        `Deep poll skipped for client ${clientId} (${client.name}): stored credentials are empty, so re-enter them for this client`
      )
    }
    return
  }

  try {
    const adapter = createAdapterForClient(client, encryptionKey)

    const crossSeedTags = client.crossSeedTags ?? []
    const allTags = [...new Set([...trackerTags, ...crossSeedTags])]

    let hasChanges = false
    let syncSummary = ""
    let isFullSync = false

    if (adapter.getDeltaSync) {
      // Delta sync path (qBittorrent). First call (rid=0) returns everything;
      // subsequent calls return only changed fields.
      const rid = getStoreRevision(adapter.baseUrl)
      let data = await adapter.getDeltaSync(rid)
      // A refusal means the store applied nothing and still holds the previous
      // poll, so the poll fails here rather than reading stale figures out of
      // it and filing them as this poll's observation.
      const refused = applyMaindataUpdate(adapter.baseUrl, data)
      if (refused) throw new SyncStoreRefusedError(refused.cap)

      // A heartbeat that takes a 403 resets the store during this await, and a
      // delta merged into an empty store never re-arms `initialized`. Re-sync
      // from rid 0, and fail the poll if the store still will not initialise: a
      // snapshot of zeros would read as an idle client.
      if (!isStoreInitialized(adapter.baseUrl)) {
        log.warn(
          { clientId, rid },
          `[deep-poll] client=${clientId} → sync store was reset mid-poll, re-syncing from rid 0 before recording a snapshot`
        )
        data = await adapter.getDeltaSync(0)
        const refusedResync = applyMaindataUpdate(adapter.baseUrl, data)
        if (refusedResync) throw new SyncStoreRefusedError(refusedResync.cap)
        if (!isStoreInitialized(adapter.baseUrl)) {
          throw new Error("Sync store failed to initialise after a full re-sync")
        }
      }

      const changedCount = Object.keys(data.torrents ?? {}).length
      const removedCount = data.torrentsRemoved?.length ?? 0
      if (data.fullUpdate) {
        isFullSync = true
        syncSummary = `rid 0→${data.rid} (full sync, ${changedCount} torrents)`
      } else {
        syncSummary = `rid ${rid}→${data.rid} (delta, ${changedCount} changed, ${removedCount} removed)`
      }

      hasChanges =
        data.fullUpdate ||
        (data.torrents != null && Object.keys(data.torrents).length > 0) ||
        (data.torrentsRemoved != null && data.torrentsRemoved.length > 0)
    } else {
      // Full fetch path (rTorrent and other non-delta clients).
      const allTorrents = await adapter.getTorrents()
      replaceStoreTorrents(adapter.baseUrl, allTorrents)
      hasChanges = true
      isFullSync = true
      syncSummary = `full fetch, ${allTorrents.length} torrents`
    }

    const stats = await adapter.getTransferInfo()

    // Two post-filters, and they must stay two.
    //
    // `torrents` is tag-only and feeds aggregateByTag and the daily
    // checkpoints; widening it would shift the seeding and leeching counts and
    // break the historical series.
    //
    // `cacheable` also matches by announce host, so the cached list agrees with
    // the warm read in download-clients/coordinator.ts.
    const tagSet = new Set(allTags.map((t) => t.toLowerCase()))
    const torrents = getFilteredTorrents(adapter.baseUrl, (t) => {
      if (!t.tags) return false
      return parseTorrentTags(t.tags).some((tag) => tagSet.has(tag))
    })
    const cacheable = getFilteredTorrents(
      adapter.baseUrl,
      createTrackedTorrentPredicate(tagSet, announceHostKeys)
    )

    const syncMsg = `[deep-poll] client=${clientId} → ${syncSummary}, ${torrents.length} relevant (${allTags.length} tags)`
    if (isFullSync) log.info(syncMsg)
    else log.debug(syncMsg)

    // Write daily torrent checkpoints for "Movers & Shakers". First-seen-today wins.
    const checkpointDate = localDateStr()
    const checkpointable = torrents.filter(
      (t) => t.uploaded != null && t.downloaded != null && t.hash && t.name
    )
    if (checkpointable.length > 0) {
      const CHUNK = 500
      try {
        for (let i = 0; i < checkpointable.length; i += CHUNK) {
          await db
            .insert(torrentDailyCheckpoints)
            .values(
              checkpointable.slice(i, i + CHUNK).map((t) => ({
                clientId,
                hash: t.hash,
                name: t.name,
                checkpointDate,
                uploadedStart: BigInt(t.uploaded),
                downloadedStart: BigInt(t.downloaded),
              }))
            )
            .onConflictDoNothing()
        }
      } catch (err) {
        log.warn(
          `Torrent checkpoint insert failed for client ${clientId}: ${err instanceof Error ? err.message : "Unknown"}`
        )
      }
    }

    const tagStatsResult = aggregateByTag(torrents, trackerTags, crossSeedTags)

    // Cache the wider list for fallback when the client is offline.
    // See the two-list note above.
    const sanitizedTorrents = cacheable.map(slimTorrentForCache)
    const now = new Date()

    // Sequenced, not raced. The snapshot row is the observation and the
    // downloadClients update only claims one was made. Insert first: if it
    // throws, lastPolledAt stays put, the catch records the error, and the next
    // tick retries.
    await db.insert(clientSnapshots).values({
      clientId,
      polledAt: now,
      totalSeedingCount: tagStatsResult.totalSeedingCount,
      totalLeechingCount: tagStatsResult.totalLeechingCount,
      uploadSpeedBytes: BigInt(stats.uploadSpeed),
      downloadSpeedBytes: BigInt(stats.downloadSpeed),
      tagStats: JSON.stringify(tagStatsResult.tagStats),
    })

    await db
      .update(downloadClients)
      .set(
        hasChanges
          ? {
              cachedTorrents: sanitizedTorrents,
              cachedTorrentsAt: now,
              lastPolledAt: now,
              lastError: null,
              errorSince: null,
              updatedAt: now,
            }
          : {
              cachedTorrentsAt: now,
              lastPolledAt: now,
              lastError: null,
              errorSince: null,
              updatedAt: now,
            }
      )
      .where(eq(downloadClients.id, clientId))

    const recovered = noteSuccess(clientId, "deep-poll")
    if (recovered) {
      log.info(
        {
          clientId,
          clientName: client.name,
          previousFailures: recovered.failures,
          downForMs: recovered.downForMs,
        },
        "client outage cleared by successful deep poll"
      )
    }

    if (!hasChanges) {
      log.debug(`[deep-poll] client=${clientId} → no torrent changes, JSONB write skipped`)
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unknown error"
    // A refusal is our own verdict on the payload rather than a fault the host
    // reported, and it names the cap the operator has to act on. The sanitizer
    // has no rule for it, and its fallback means the host never answered.
    const message = error instanceof SyncStoreRefusedError ? raw : sanitizeNetworkError(raw)
    // Keyed on the clientId parameter, which is always defined. The row lookup
    // itself may be what failed.
    const verdict = noteFailure(clientId, "deep-poll", raw)
    // See heartbeatClient: the sanitised message is for the UI, the raw cause
    // is what makes the failure diagnosable from the logs.
    const base = { clientId, clientName: client?.name, cause: raw }
    switch (verdict.kind) {
      case "first":
        log.error(
          base,
          `Deep poll failed for client ${clientId} (${client?.name ?? "unknown"}): ${message}`
        )
        break
      case "cause-changed":
        log.error(
          {
            ...base,
            previousCause: verdict.previousCause,
            outageSince: verdict.since,
            failures: verdict.failures,
            suppressed: verdict.suppressed,
          },
          `Deep poll failure changed for client ${clientId} (${client?.name ?? "unknown"}): ${message}`
        )
        break
      case "reminder": {
        const downForMs = Date.now() - verdict.since
        log.warn(
          {
            ...base,
            outageSince: verdict.since,
            failures: verdict.failures,
            suppressed: verdict.suppressed,
            distinctCauses: verdict.distinctCauses,
            downForMs,
          },
          `Deep poll still failing for client ${clientId} (${client?.name ?? "unknown"}), down ${Math.round(downForMs / 60_000)}m, ${verdict.failures} failed attempts, ${verdict.suppressed} log lines suppressed: ${message}`
        )
        break
      }
      case "silent":
        break
    }
    try {
      await db
        .update(downloadClients)
        .set({
          lastError: message,
          errorSince: sql`COALESCE(${downloadClients.errorSince}, NOW())`,
          updatedAt: new Date(),
        })
        .where(eq(downloadClients.id, clientId))
    } catch (dbErr) {
      log.error(
        `Failed to record deep poll error for client ${clientId}: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`
      )
    }
  }
}

async function deepPollAllClients(encryptionKey: Buffer): Promise<void> {
  const allClients = await db
    .select({
      id: downloadClients.id,
      enabled: downloadClients.enabled,
      pollIntervalSeconds: downloadClients.pollIntervalSeconds,
      lastPolledAt: downloadClients.lastPolledAt,
    })
    .from(downloadClients)
    .where(eq(downloadClients.enabled, true))

  const now = Date.now()

  const overdue = allClients.filter((client) => {
    const intervalMs = client.pollIntervalSeconds * 1000
    const lastPoll = client.lastPolledAt?.getTime() ?? 0
    return now - lastPoll >= intervalMs
  })

  if (overdue.length === 0) return

  // Fetch trackers once for the entire cycle (same for all clients). Untagged
  // trackers are read too: they contribute no tag, but their announce host is
  // what lets the cached list match the warm read.
  const trackerRows = await db
    .select({ qbtTag: trackers.qbtTag, baseUrl: trackers.baseUrl })
    .from(trackers)
  const trackerTags = trackerRows.map((r) => r.qbtTag).filter((t): t is string => Boolean(t))
  const announceHostKeys = new Set(
    trackerRows.map((r) => trackerHostKey(r.baseUrl)).filter((h): h is string => h !== null)
  )

  await Promise.allSettled(
    overdue.map((c) => deepPollClient(c.id, encryptionKey, trackerTags, announceHostKeys))
  )
}

// ---------------------------------------------------------------------------
// Scheduler lifecycle
// ---------------------------------------------------------------------------

/** True only when both loops are registered. Half-started is not running. */
export function isClientSchedulerRunning(): boolean {
  return getHeartbeatTask() !== null && getDeepPollTask() !== null
}

export function startClientScheduler(encryptionKey: Buffer): void {
  // Checks both tasks: the heartbeat is registered first, so a throw before the
  // deep-poll task exists leaves a live heartbeat over a dead deep poll.
  if (isClientSchedulerRunning()) return
  // Half-started: tear the surviving half down so the restart below is clean
  // rather than orphaning a second heartbeat task. The returned promise is
  // deliberately dropped: this is a restart, not a shutdown, so the only thing
  // waiting would buy is a later start, and every teardown side effect has
  // already happened synchronously by the time the call returns.
  if (getHeartbeatTask() || getDeepPollTask()) void stopClientScheduler()

  // Run both immediately on start
  heartbeatAllClients(encryptionKey).catch((error) => {
    log.error(error, "Initial heartbeat error")
  })
  deepPollAllClients(encryptionKey).catch((error) => {
    log.error(error, "Initial deep poll error")
  })

  // Heartbeat: every 5 seconds
  const hbTask = cron.schedule("*/5 * * * * *", async () => {
    if (g.__heartbeatInFlight) return
    g.__heartbeatInFlight = true
    try {
      await heartbeatAllClients(encryptionKey)
      await flushCompletedBuckets()
    } catch (error) {
      log.error(error, "Client heartbeat error")
    } finally {
      g.__heartbeatInFlight = false
    }
  })
  setHeartbeatTask(hbTask)

  // Deep poll: 30s tick so per-client pollIntervalSeconds (min 60s) is honored
  const dpTask = cron.schedule("*/30 * * * * *", async () => {
    if (g.__deepPollInFlight) return
    g.__deepPollInFlight = true
    try {
      await deepPollAllClients(encryptionKey)
      // Prune client snapshots + uptime buckets at most once per hour
      const now = Date.now()
      if (now - (g.__lastPruneAt ?? 0) >= PRUNE_INTERVAL_MS) {
        const [settings] = await db
          .select({ retention: appSettings.snapshotRetentionDays })
          .from(appSettings)
          .limit(1)
        // NULL retention means keep forever and is also the never-configured
        // default (see db/schema.ts). No configured value, no delete.
        const retentionDays = settings?.retention ?? null
        if (retentionDays !== null && retentionDays > 0) {
          const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000)
          await db.delete(clientSnapshots).where(lt(clientSnapshots.polledAt, cutoff))
          await db.delete(clientUptimeBuckets).where(lt(clientUptimeBuckets.bucketTs, cutoff))
        }
        g.__lastPruneAt = now
      }
    } catch (error) {
      log.error(error, "Client deep poll error")
    } finally {
      g.__deepPollInFlight = false
    }
  })
  setDeepPollTask(dpTask)

  log.info("Client scheduler started (heartbeat: 5s, deep poll: 30s tick)")
}

/**
 * Tears the scheduler down and resolves once the final uptime flush has landed.
 *
 * Every side effect runs synchronously before the single trailing await, so
 * both callers, which drop the promise, still get the full teardown. It never
 * rejects: an unhandled rejection takes the process down, so a flush failure is
 * logged and swallowed. No caller awaits it yet, so the SIGTERM handler in
 * scheduler.ts can exit before the flush lands. The in-progress 5-minute bucket
 * is never flushed and is lost on stop.
 */
export function stopClientScheduler(): Promise<void> {
  const hb = getHeartbeatTask()
  if (hb) {
    hb.stop()
    setHeartbeatTask(null)
  }
  const dp = getDeepPollTask()
  if (dp) {
    dp.stop()
    setDeepPollTask(null)
  }
  clearAllSessions()
  clearSpeedCache()

  // Started before the clear on purpose: flushCompletedBuckets drains the
  // accumulator into its row array synchronously and only then awaits the
  // insert, so wiping the globals below cannot steal rows already in flight.
  // It leaves an empty queue behind, so a second stop cannot re-insert them.
  const flushed = flushCompletedBuckets().catch((err) => {
    log.warn(err, "Failed to flush uptime buckets during scheduler stop")
  })
  clearUptimeAccumulator()
  clearFailureLogGate()

  // Must stay last. Anything placed after this await becomes a side effect the
  // fire-and-forget callers would silently lose.
  return flushed.then(() => undefined)
}

/**
 * Restarts the client scheduler if it died.
 * Called from ensureSchedulerRunning in scheduler.ts.
 */
export function ensureClientSchedulerRunning(encryptionKeyHex: string): void {
  if (isClientSchedulerRunning()) return
  const key = Buffer.from(encryptionKeyHex, "hex")
  startClientScheduler(key)
}
