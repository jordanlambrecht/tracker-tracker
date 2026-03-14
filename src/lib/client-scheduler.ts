// src/lib/client-scheduler.ts
//
// Two polling loops with different cadences:
//   heartbeat  — lightweight: login + getTransferInfo (2 requests). Runs every 30s.
//                Stores upload/download speed in memory cache. Updates connection status.
//   deep poll  — heavy: login + getTorrents (all) + filter/dedup + aggregation.
//                Runs on each client's configured pollIntervalSeconds.
//                Stores full tagStats alongside speed data.
//
// Functions: heartbeatClient, heartbeatAllClients, deepPollClient, deepPollAllClients,
//            startClientScheduler, stopClientScheduler, isClientSchedulerRunning, ensureClientSchedulerRunning

import { eq, isNotNull, lt } from "drizzle-orm"
import cron, { type ScheduledTask } from "node-cron"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { clientSnapshots, downloadClients, trackers } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import type { QbtTorrent } from "@/lib/qbt"
import {
  aggregateByTag,
  clearAllSessions,
  clearSpeedCache,
  filterAndDedup,
  getTorrents,
  getTransferInfo,
  pushSpeedSnapshot,
  withSessionRetry,
} from "@/lib/qbt"

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
    let username: string
    let password: string
    try {
      username = decrypt(client.encryptedUsername, encryptionKey)
      password = decrypt(client.encryptedPassword, encryptionKey)
    } catch (_err) {
      throw new Error(`Credentials are missing or invalid for client "${client.name}"`)
    }

    const transfer = await withSessionRetry(
      client.host,
      client.port,
      client.useSsl,
      username,
      password,
      (baseUrl, sid) => getTransferInfo(baseUrl, sid)
    )

    pushSpeedSnapshot(clientId, transfer.up_info_speed, transfer.dl_info_speed)

    await db
      .update(downloadClients)
      .set({ lastPolledAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(downloadClients.id, clientId))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await db
      .update(downloadClients)
      .set({ lastError: message, updatedAt: new Date() })
      .where(eq(downloadClients.id, clientId))
    log.error(`Heartbeat failed for client ${clientId}: ${message}`)
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
    let username: string
    let password: string
    try {
      username = decrypt(client.encryptedUsername, encryptionKey)
      password = decrypt(client.encryptedPassword, encryptionKey)
    } catch (_err) {
      throw new Error(`Credentials are missing or invalid for client "${client.name}"`)
    }

    // Collect known tags
    const trackerTagRows = await db
      .select({ qbtTag: trackers.qbtTag })
      .from(trackers)
      .where(isNotNull(trackers.qbtTag))

    const trackerTags = trackerTagRows.map((r) => r.qbtTag as string)
    let crossSeedTags: string[] = []
    try {
      crossSeedTags = JSON.parse(client.crossSeedTags) as string[]
    } catch { // security-audit-ignore: malformed JSON falls back to empty array
    }
    const allTags = [...new Set([...trackerTags, ...crossSeedTags])]

    const { allTorrents: rawTorrents, transfer } = await withSessionRetry(
      client.host,
      client.port,
      client.useSsl,
      username,
      password,
      async (baseUrl, sid) => {
        const [raw, xfer] = await Promise.all([
          getTorrents(baseUrl, sid),
          getTransferInfo(baseUrl, sid),
        ])
        return { allTorrents: raw as QbtTorrent[], transfer: xfer }
      }
    )
    const torrents = filterAndDedup(rawTorrents, allTags)

    log.debug(
      `[deep-poll] client=${clientId} → ${torrents.length} relevant torrents (${allTags.length} tags)`
    )

    const stats = aggregateByTag(torrents, trackerTags, crossSeedTags)

    // Cache the filtered torrent list for fallback when client is offline
    await db
      .update(downloadClients)
      .set({
        cachedTorrents: JSON.stringify(torrents),
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
      .set({ lastPolledAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(downloadClients.id, clientId))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await db
      .update(downloadClients)
      .set({ lastError: message, updatedAt: new Date() })
      .where(eq(downloadClients.id, clientId))
    log.error(`Deep poll failed for client ${clientId}: ${message}`)
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

  // Prune client snapshots older than 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await db.delete(clientSnapshots).where(lt(clientSnapshots.polledAt, cutoff))
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

  // Heartbeat: every 10 seconds — lightweight speed + connection check
  const hbTask = cron.schedule("*/10 * * * * *", async () => {
    if (heartbeatInFlight) return
    heartbeatInFlight = true
    try {
      await heartbeatAllClients(encryptionKey)
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
    } catch (error) {
      log.error(error, "Client deep poll error")
    } finally {
      deepPollInFlight = false
    }
  })
  setDeepPollTask(dpTask)

  log.info("Client scheduler started (heartbeat: 10s, deep poll: 5m)")
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
}

export function isClientSchedulerRunning(): boolean {
  return getHeartbeatTask() !== null
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
