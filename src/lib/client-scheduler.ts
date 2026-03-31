// src/lib/client-scheduler.ts
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
import { decryptClientCredentials } from "@/lib/client-decrypt"
import { db } from "@/lib/db"
import {
  appSettings,
  clientSnapshots,
  clientUptimeBuckets,
  downloadClients,
  torrentDailyCheckpoints,
  trackers,
} from "@/lib/db/schema"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { parseTorrentTags } from "@/lib/fleet"
import { localDateStr } from "@/lib/formatters"
import { log } from "@/lib/logger"
import {
  aggregateByTag,
  applyMaindataUpdate,
  clearAllSessions,
  clearSpeedCache,
  getStoredTorrents,
  getStoreRevision,
  getTransferInfo,
  parseCrossSeedTags,
  pushSpeedSnapshot,
  stripSensitiveTorrentFields,
  syncMaindata,
  withSessionRetry,
} from "@/lib/qbt"
import { clearUptimeAccumulator, flushCompletedBuckets, recordHeartbeat } from "@/lib/uptime"

/** Columns needed by heartbeatClient. Excludes large blobs like cachedTorrents */
export const HEARTBEAT_COLUMNS = {
  id: downloadClients.id,
  enabled: downloadClients.enabled,
  name: downloadClients.name,
  host: downloadClients.host,
  port: downloadClients.port,
  useSsl: downloadClients.useSsl,
  encryptedUsername: downloadClients.encryptedUsername,
  encryptedPassword: downloadClients.encryptedPassword,
} as const

/** Columns needed by deepPollClient. Heartbeat fields + poll config + tags */
export const DEEP_POLL_COLUMNS = {
  ...HEARTBEAT_COLUMNS,
  crossSeedTags: downloadClients.crossSeedTags,
  pollIntervalSeconds: downloadClients.pollIntervalSeconds,
  lastPolledAt: downloadClients.lastPolledAt,
} as const

// Store on globalThis to survive HMR in development.
// Without this, each hot-reload orphans the old cron job while creating a new one.
const g = globalThis as typeof globalThis & {
  __clientHeartbeatTask?: ScheduledTask | null
  __clientDeepPollTask?: ScheduledTask | null
}

let heartbeatInFlight = false
let deepPollInFlight = false
let lastPruneAt = 0
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

async function heartbeatClient(clientId: number, encryptionKey: Buffer): Promise<void> {
  const [client] = await db
    .select(HEARTBEAT_COLUMNS)
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!client?.enabled) return
  if (!client.encryptedUsername || !client.encryptedPassword) return

  try {
    const { username, password } = decryptClientCredentials(client, encryptionKey)

    const transfer = await withSessionRetry(
      client.host,
      client.port,
      client.useSsl,
      username,
      password,
      (baseUrl, sid) => getTransferInfo(baseUrl, sid)
    )

    pushSpeedSnapshot(clientId, transfer.up_info_speed, transfer.dl_info_speed)
    recordHeartbeat(clientId, true)

    await db
      .update(downloadClients)
      .set({ lastError: null, errorSince: null, updatedAt: new Date() })
      .where(eq(downloadClients.id, clientId))
  } catch (error) {
    recordHeartbeat(clientId, false)
    const raw = error instanceof Error ? error.message : "Unknown error"
    const message = sanitizeNetworkError(raw)
    await db
      .update(downloadClients)
      .set({
        lastError: message,
        errorSince: sql`COALESCE(${downloadClients.errorSince}, NOW())`,
        updatedAt: new Date(),
      })
      .where(eq(downloadClients.id, clientId))
    log.error(`Heartbeat failed for client ${clientId}: ${raw}`)
  }
}

async function heartbeatAllClients(encryptionKey: Buffer): Promise<void> {
  const allClients = await db
    .select({ id: downloadClients.id })
    .from(downloadClients)
    .where(eq(downloadClients.enabled, true))

  if (allClients.length === 0) return

  await Promise.allSettled(allClients.map((c) => heartbeatClient(c.id, encryptionKey)))
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
    const { username, password } = decryptClientCredentials(client, encryptionKey)

    const crossSeedTags = parseCrossSeedTags(client.crossSeedTags)
    const allTags = [...new Set([...trackerTags, ...crossSeedTags])]

    // Fetch delta from qBT's sync endpoint. First call (rid=0) returns everything;
    // subsequent calls return only fields that changed since the last rid.
    const { torrents, transfer } = await withSessionRetry(
      client.host,
      client.port,
      client.useSsl,
      username,
      password,
      async (baseUrl, sid) => {
        const rid = getStoreRevision(baseUrl)
        const [data, xfer] = await Promise.all([
          syncMaindata(baseUrl, sid, rid),
          getTransferInfo(baseUrl, sid),
        ])
        applyMaindataUpdate(baseUrl, data)

        const changedCount = Object.keys(data.torrents ?? {}).length
        const removedCount = data.torrents_removed?.length ?? 0
        if (data.full_update) {
          log.info(
            `[deep-poll] client=${clientId} → rid 0→${data.rid} (full sync, ${changedCount} torrents)`
          )
        } else {
          log.debug(
            `[deep-poll] client=${clientId} → rid ${rid}→${data.rid} (delta, ${changedCount} changed, ${removedCount} removed)`
          )
        }

        // Post-filter to only torrents carrying at least one app-tracked tag.
        // Uses parseTorrentTags from fleet.ts — the same function the aggregator uses.
        const tagSet = new Set(allTags.map((t) => t.toLowerCase()))
        const allStoredTorrents = getStoredTorrents(baseUrl)
        const relevant = allStoredTorrents.filter((t) => {
          if (!t.tags) return false
          return parseTorrentTags(t.tags).some((tag) => tagSet.has(tag))
        })

        return { torrents: relevant, transfer: xfer }
      }
    )

    log.debug(
      `[deep-poll] client=${clientId} → ${torrents.length} relevant torrents (${allTags.length} tags)`
    )

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

    const stats = aggregateByTag(torrents, trackerTags, crossSeedTags)

    // Cache the filtered torrent list for fallback when client is offline.
    const sanitizedTorrents = torrents.map(stripSensitiveTorrentFields)
    await db
      .update(downloadClients)
      .set({
        cachedTorrents: sanitizedTorrents,
        cachedTorrentsAt: new Date(),
      })
      .where(eq(downloadClients.id, clientId))

    await db.insert(clientSnapshots).values({
      clientId,
      polledAt: new Date(),
      totalSeedingCount: stats.totalSeedingCount,
      totalLeechingCount: stats.totalLeechingCount,
      uploadSpeedBytes: BigInt(transfer.up_info_speed),
      downloadSpeedBytes: BigInt(transfer.dl_info_speed),
      tagStats: JSON.stringify(stats.tagStats),
    })

    await db
      .update(downloadClients)
      .set({ lastPolledAt: new Date(), lastError: null, errorSince: null, updatedAt: new Date() })
      .where(eq(downloadClients.id, clientId))
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unknown error"
    const message = sanitizeNetworkError(raw)
    await db
      .update(downloadClients)
      .set({
        lastError: message,
        errorSince: sql`COALESCE(${downloadClients.errorSince}, NOW())`,
        updatedAt: new Date(),
      })
      .where(eq(downloadClients.id, clientId))
    log.error(`Deep poll failed for client ${clientId}: ${raw}`)
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
    if (heartbeatInFlight) return
    heartbeatInFlight = true
    try {
      await heartbeatAllClients(encryptionKey)
      await flushCompletedBuckets()
    } catch (error) {
      log.error(error, "Client heartbeat error")
    } finally {
      heartbeatInFlight = false
    }
  })
  setHeartbeatTask(hbTask)

  // Deep poll — 30s tick so per-client pollIntervalSeconds (min 60s) is honored
  const dpTask = cron.schedule("*/30 * * * * *", async () => {
    if (deepPollInFlight) return
    deepPollInFlight = true
    try {
      await deepPollAllClients(encryptionKey)
      // Prune client snapshots + uptime buckets at most once per hour
      const now = Date.now()
      if (now - lastPruneAt >= PRUNE_INTERVAL_MS) {
        const [settings] = await db
          .select({ retention: appSettings.snapshotRetentionDays })
          .from(appSettings)
          .limit(1)
        const retentionDays = settings?.retention ?? 90
        if (retentionDays > 0) {
          const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000)
          await db.delete(clientSnapshots).where(lt(clientSnapshots.polledAt, cutoff))
          await db.delete(clientUptimeBuckets).where(lt(clientUptimeBuckets.bucketTs, cutoff))
        }
        lastPruneAt = now
      }
    } catch (error) {
      log.error(error, "Client deep poll error")
    } finally {
      deepPollInFlight = false
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

  flushCompletedBuckets().catch(() => {})
  clearUptimeAccumulator()
}

/**
 * Restarts the client scheduler if it died (i.e, after server restart).
 * Called from ensureSchedulerRunning in scheduler.ts.
 */
export function ensureClientSchedulerRunning(encryptionKeyHex: string): void {
  if (getHeartbeatTask()) return
  const key = Buffer.from(encryptionKeyHex, "hex")
  startClientScheduler(key)
}
