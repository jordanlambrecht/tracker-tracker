// src/lib/download-client-scheduler.ts
//
// Two polling loops with different cadences:
//   heartbeat  — lightweight: login + getTransferInfo (2 requests). Runs every 5s.
//                Stores upload/download speed in memory cache. Updates connection status.
//                Records success/failure in uptime accumulator (5-min buckets).
//   deep poll  — heavy: login + syncMaindata (delta) + post-filter + aggregation.
//                Runs on each client's configured pollIntervalSeconds.
//                Stores full tagStats alongside speed data.
//
// Functions: heartbeatClient, heartbeatAllClients, deepPollClient, deepPollAllClients,
//            startClientScheduler, stopClientScheduler, ensureClientSchedulerRunning
//
// Side effects of deepPollClient:
//   - Writes torrent daily checkpoints (torrentDailyCheckpoints) for "Movers & Shakers".
//     Uses onConflictDoNothing so the first poll of the day wins; subsequent polls skip.

import { eq, isNotNull, lt, sql } from "drizzle-orm"
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
  pushSpeedSnapshot,
  replaceStoreTorrents,
  slimTorrentForCache,
} from "@/lib/download-clients"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { parseTorrentTags } from "@/lib/fleet"
import { localDateStr } from "@/lib/formatters"
import { SNAPSHOT_RETENTION_DEFAULT } from "@/lib/limits"
import { log } from "@/lib/logger"
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
  encryptedUsername: downloadClients.encryptedUsername,
  encryptedPassword: downloadClients.encryptedPassword,
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
const PRUNE_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

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
    encryptedUsername: string
    encryptedPassword: string
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

    // Only write to DB if recovering from error — skip if already healthy
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
    log.error(
      { clientId: client.id, clientName: client.name },
      `Heartbeat failed for client ${client.id} (${client.name}): ${message}`
    )
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

  if (allClients.length === 0) return

  await Promise.allSettled(allClients.map((c) => heartbeatClient(c, encryptionKey)))
}

// ---------------------------------------------------------------------------
// Deep poll
// ---------------------------------------------------------------------------

export async function deepPollClient(
  clientId: number,
  encryptionKey: Buffer,
  trackerTags: string[]
): Promise<void> {
  const [client] = await db
    .select(DEEP_POLL_COLUMNS)
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!client?.enabled) return
  if (!client.encryptedUsername || !client.encryptedPassword) return

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
      const data = await adapter.getDeltaSync(rid)
      applyMaindataUpdate(adapter.baseUrl, data)

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

    // Post-filter to only torrents carrying at least one app-tracked tag
    const tagSet = new Set(allTags.map((t) => t.toLowerCase()))
    const torrents = getFilteredTorrents(adapter.baseUrl, (t) => {
      if (!t.tags) return false
      return parseTorrentTags(t.tags).some((tag) => tagSet.has(tag))
    })

    const syncMsg = `[deep-poll] client=${clientId} → ${syncSummary}, ${torrents.length} relevant (${allTags.length} tags)`
    if (isFullSync) log.info(syncMsg)
    else log.debug(syncMsg)

    // Write daily torrent checkpoints for "Movers & Shakers" — first-seen-today wins
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

    // Cache the filtered torrent list for fallback when client is offline.
    const sanitizedTorrents = torrents.map(slimTorrentForCache)
    const now = new Date()

    await Promise.all([
      db
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
        .where(eq(downloadClients.id, clientId)),
      db.insert(clientSnapshots).values({
        clientId,
        polledAt: now,
        totalSeedingCount: tagStatsResult.totalSeedingCount,
        totalLeechingCount: tagStatsResult.totalLeechingCount,
        uploadSpeedBytes: BigInt(stats.uploadSpeed),
        downloadSpeedBytes: BigInt(stats.downloadSpeed),
        tagStats: JSON.stringify(tagStatsResult.tagStats),
      }),
    ])
    if (!hasChanges) {
      log.debug(`[deep-poll] client=${clientId} → no torrent changes, JSONB write skipped`)
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unknown error"
    const message = sanitizeNetworkError(raw)
    log.error(
      { clientId, clientName: client?.name },
      `Deep poll failed for client ${clientId} (${client?.name ?? "unknown"}): ${message}`
    )
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

  // Fetch tracker tags once for the entire cycle (same for all clients)
  const trackerTagRows = await db
    .select({ qbtTag: trackers.qbtTag })
    .from(trackers)
    .where(isNotNull(trackers.qbtTag))
  const trackerTags = trackerTagRows.map((r) => r.qbtTag as string)

  await Promise.allSettled(overdue.map((c) => deepPollClient(c.id, encryptionKey, trackerTags)))
}

// ---------------------------------------------------------------------------
// Scheduler lifecycle
// ---------------------------------------------------------------------------

export function startClientScheduler(encryptionKey: Buffer): void {
  if (getHeartbeatTask()) return

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
        const retentionDays = settings?.retention ?? SNAPSHOT_RETENTION_DEFAULT
        if (retentionDays > 0) {
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

export function stopClientScheduler(): void {
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

  flushCompletedBuckets().catch((err) => {
    log.warn(err, "Failed to flush uptime buckets during scheduler stop")
  })
  clearUptimeAccumulator()
}

/**
 * Restarts the client scheduler if it died.
 * Called from ensureSchedulerRunning in scheduler.ts.
 */
export function ensureClientSchedulerRunning(encryptionKeyHex: string): void {
  if (getHeartbeatTask()) return
  const key = Buffer.from(encryptionKeyHex, "hex")
  startClientScheduler(key)
}
