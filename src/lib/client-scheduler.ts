// src/lib/client-scheduler.ts
//
// Two polling loops with different cadences:
//   heartbeat  — lightweight: login + getTransferInfo (2 requests). Runs every 5s.
//                Stores upload/download speed in memory cache. Updates connection status.
//                Records success/failure in uptime accumulator (5-min buckets).
//   deep poll  — heavy: login + getTorrents (all) + filter/dedup + aggregation.
//                Runs on each client's configured pollIntervalSeconds.
//                Stores full tagStats alongside speed data.
//
// Functions: heartbeatClient, heartbeatAllClients, deepPollClient, deepPollAllClients,
//            startClientScheduler, stopClientScheduler, ensureClientSchedulerRunning

import { eq, isNotNull, lt, sql } from "drizzle-orm"
import cron, { type ScheduledTask } from "node-cron"
import { decryptClientCredentials } from "@/lib/client-decrypt"
import { db } from "@/lib/db"
import {
  appSettings,
  clientSnapshots,
  clientUptimeBuckets,
  downloadClients,
  trackers,
} from "@/lib/db/schema"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import type { QbtTorrent } from "@/lib/qbt"
import {
  aggregateByTag,
  clearAllSessions,
  clearSpeedCache,
  getTorrents,
  getTransferInfo,
  parseCrossSeedTags,
  pushSpeedSnapshot,
  stripSensitiveTorrentFields,
  withSessionRetry,
} from "@/lib/qbt"
import { clearUptimeAccumulator, flushCompletedBuckets, recordHeartbeat } from "@/lib/uptime"

// Store on globalThis to survive HMR in development.
// Without this, each hot-reload orphans the old cron job while creating a new one.
const g = globalThis as typeof globalThis & {
  __clientHeartbeatTask?: ScheduledTask | null
  __clientDeepPollTask?: ScheduledTask | null
}

let heartbeatInFlight = false
let deepPollInFlight = false

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
// Heartbeat — lightweight speed + connection check
// ---------------------------------------------------------------------------

async function heartbeatClient(clientId: number, encryptionKey: Buffer): Promise<void> {
  const [client] = await db
    .select()
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!client || !client.enabled) return

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
      .set({ lastPolledAt: new Date(), lastError: null, errorSince: null, updatedAt: new Date() })
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
    .select()
    .from(downloadClients)
    .where(eq(downloadClients.enabled, true))

  if (allClients.length === 0) return

  await Promise.allSettled(allClients.map((c) => heartbeatClient(c.id, encryptionKey)))
}

// ---------------------------------------------------------------------------
// Deep poll — full torrent list + per-tag aggregation
// ---------------------------------------------------------------------------

export async function deepPollClient(clientId: number, encryptionKey: Buffer): Promise<void> {
  const [client] = await db
    .select()
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!client || !client.enabled) return

  try {
    const { username, password } = decryptClientCredentials(client, encryptionKey)

    // Collect known tags
    const trackerTagRows = await db
      .select({ qbtTag: trackers.qbtTag })
      .from(trackers)
      .where(isNotNull(trackers.qbtTag))

    const trackerTags = trackerTagRows.map((r) => r.qbtTag as string)
    const crossSeedTags = parseCrossSeedTags(client.crossSeedTags)
    const allTags = [...new Set([...trackerTags, ...crossSeedTags])]

    // Fetch torrents per-tag in parallel (avoids downloading the full unfiltered
    // torrent list). Each request returns only torrents matching that tag.
    // Dedup by hash in case a torrent has multiple known tags.
    const { torrents, transfer } = await withSessionRetry(
      client.host,
      client.port,
      client.useSsl,
      username,
      password,
      async (baseUrl, sid) => {
        const [tagSettled, xfer] = await Promise.all([
          Promise.allSettled(allTags.map((tag) => getTorrents(baseUrl, sid, tag))),
          getTransferInfo(baseUrl, sid),
        ])
        const seen = new Set<string>()
        const deduped: QbtTorrent[] = []
        for (const result of tagSettled) {
          if (result.status !== "fulfilled") continue
          for (const t of result.value) {
            if (!t.isPrivate || seen.has(t.hash)) continue
            seen.add(t.hash)
            deduped.push(t)
          }
        }
        return { torrents: deduped, transfer: xfer }
      }
    )

    log.debug(
      `[deep-poll] client=${clientId} → ${torrents.length} relevant torrents (${allTags.length} tags)`
    )

    const stats = aggregateByTag(torrents, trackerTags, crossSeedTags)

    // Cache the filtered torrent list for fallback when client is offline.
    const sanitizedTorrents = torrents.map(stripSensitiveTorrentFields)
    await db
      .update(downloadClients)
      .set({
        cachedTorrents: JSON.stringify(sanitizedTorrents),
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
    .select()
    .from(downloadClients)
    .where(eq(downloadClients.enabled, true))

  const now = Date.now()

  const overdue = allClients.filter((client) => {
    const intervalMs = client.pollIntervalSeconds * 1000
    const lastPoll = client.lastPolledAt?.getTime() ?? 0
    return now - lastPoll >= intervalMs
  })

  if (overdue.length === 0) return

  await Promise.allSettled(overdue.map((c) => deepPollClient(c.id, encryptionKey)))
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

  // Heartbeat: every 5 seconds — lightweight speed + connection check
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

  // Deep poll: every 5 minutes — full torrent list + tag aggregation
  const dpTask = cron.schedule("*/5 * * * *", async () => {
    if (deepPollInFlight) return
    deepPollInFlight = true
    try {
      await deepPollAllClients(encryptionKey)
      // Prune client snapshots + uptime buckets using snapshotRetentionDays
      const [settings] = await db
        .select({ retention: appSettings.snapshotRetentionDays })
        .from(appSettings)
        .limit(1)
      const retentionDays = settings?.retention ?? 90
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
      await db.delete(clientSnapshots).where(lt(clientSnapshots.polledAt, cutoff))
      await db.delete(clientUptimeBuckets).where(lt(clientUptimeBuckets.bucketTs, cutoff))
    } catch (error) {
      log.error(error, "Client deep poll error")
    } finally {
      deepPollInFlight = false
    }
  })
  setDeepPollTask(dpTask)

  log.info("Client scheduler started (heartbeat: 5s, deep poll: 5m)")
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
  // Best-effort flush of any completed uptime buckets before clearing
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
