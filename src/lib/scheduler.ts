// src/lib/scheduler.ts
//
// Functions: pollTracker, pollAllTrackers, pruneOldSnapshots, startScheduler, stopScheduler, ensureSchedulerRunning, POLL_FAILURE_THRESHOLD
import type { Agent as HttpAgent } from "node:http"

import { desc, eq, lt, sql } from "drizzle-orm"
import cron, { type ScheduledTask } from "node-cron"
import { findRegistryEntry } from "@/data/tracker-registry"
import { getAdapter } from "@/lib/adapters"
import { pruneDismissedAlerts } from "@/lib/alert-pruning"
import { startBackupScheduler, stopBackupScheduler } from "@/lib/backup-scheduler"
import {
  ensureClientSchedulerRunning,
  startClientScheduler,
  stopClientScheduler,
} from "@/lib/client-scheduler"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, notificationTargets, trackerSnapshots, trackers } from "@/lib/db/schema"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { dispatchNotifications } from "@/lib/notifications/dispatch"
import { maskUsername } from "@/lib/privacy"
import { buildProxyAgentFromSettings } from "@/lib/proxy"

// Store on globalThis to survive HMR in development.
// Without this, each hot-reload orphans the old cron job (it keeps firing)
// while creating a new one — causing duplicate polls that hammer tracker APIs.
const g = globalThis as typeof globalThis & {
  __schedulerTask?: ScheduledTask | null
  __schedulerKey?: Buffer | null
  __pollInFlight?: boolean
}

function getSchedulerTask(): ScheduledTask | null {
  return g.__schedulerTask ?? null
}
function setSchedulerTask(task: ScheduledTask | null) {
  g.__schedulerTask = task
}
function getSchedulerKey(): Buffer | null {
  return g.__schedulerKey ?? null
}
function setSchedulerKey(key: Buffer | null) {
  g.__schedulerKey = key
}

function getPollInFlight(): boolean {
  return g.__pollInFlight ?? false
}
function setPollInFlight(v: boolean) {
  g.__pollInFlight = v
}

/** After this many consecutive poll failures, auto-pause the tracker. */
export const POLL_FAILURE_THRESHOLD = 4

export async function pollTracker(
  trackerId: number,
  encryptionKey: Buffer,
  privacyMode: boolean,
  proxyAgent?: HttpAgent,
  batchTimestamp?: Date,
  enabledTargets?: (typeof notificationTargets.$inferSelect)[]
): Promise<void> {
  const [tracker] = await db.select().from(trackers).where(eq(trackers.id, trackerId)).limit(1)

  if (!tracker || !tracker.isActive) return

  const timestamp = batchTimestamp ?? new Date()

  try {
    let apiToken: string
    try {
      apiToken = decrypt(tracker.encryptedApiToken, encryptionKey)
    } catch (_err) {
      throw new Error(`API key is missing or invalid for tracker "${tracker.name}"`)
    }
    const adapter = getAdapter(tracker.platformType)
    const fetchOptions: {
      proxyAgent?: typeof proxyAgent
      remoteUserId?: number
      authStyle?: "token" | "raw"
      enrich?: boolean
    } = {}
    if (tracker.useProxy) {
      if (!proxyAgent)
        throw new Error(
          "Proxy required but not available — refusing to leak IP via direct connection"
        )
      fetchOptions.proxyAgent = proxyAgent
    }
    if (tracker.remoteUserId) fetchOptions.remoteUserId = tracker.remoteUserId
    const registryEntry = findRegistryEntry(tracker.baseUrl)
    if (registryEntry?.gazelleAuthStyle) fetchOptions.authStyle = registryEntry.gazelleAuthStyle
    if (registryEntry?.gazelleEnrich) fetchOptions.enrich = true
    const stats = await adapter.fetchStats(tracker.baseUrl, apiToken, tracker.apiPath, fetchOptions)

    // Cache metadata from poll (remoteUserId saves an API call, joinedDate/platformMeta enrich the UI)
    const metaUpdates: Record<string, unknown> = {}
    if (stats.remoteUserId && stats.remoteUserId !== tracker.remoteUserId) {
      metaUpdates.remoteUserId = stats.remoteUserId
    }
    if (stats.joinedDate && !tracker.joinedAt) {
      const parsed = new Date(stats.joinedDate)
      if (!Number.isNaN(parsed.getTime())) {
        metaUpdates.joinedAt = parsed.toISOString().split("T")[0]
      }
    }
    if (stats.lastAccessDate) {
      const parsed = new Date(stats.lastAccessDate)
      if (!Number.isNaN(parsed.getTime())) {
        metaUpdates.lastAccessAt = parsed.toISOString().split("T")[0]
      }
    }
    if (stats.platformMeta) {
      metaUpdates.platformMeta = JSON.stringify(stats.platformMeta)
    }
    if (stats.avatarUrl) {
      metaUpdates.avatarRemoteUrl = stats.avatarUrl
    }
    if (Object.keys(metaUpdates).length > 0) {
      await db.update(trackers).set(metaUpdates).where(eq(trackers.id, tracker.id))
    }

    // Fetch previous snapshot BEFORE inserting the new one — used for change detection in notifications
    const [previousSnapshot] = await db
      .select({
        ratio: trackerSnapshots.ratio,
        hitAndRuns: trackerSnapshots.hitAndRuns,
        bufferBytes: trackerSnapshots.bufferBytes,
        warned: trackerSnapshots.warned,
        group: trackerSnapshots.group,
        seedingCount: trackerSnapshots.seedingCount,
      })
      .from(trackerSnapshots)
      .where(eq(trackerSnapshots.trackerId, tracker.id))
      .orderBy(desc(trackerSnapshots.polledAt))
      .limit(1)

    await db.insert(trackerSnapshots).values({
      trackerId: tracker.id,
      polledAt: timestamp,
      uploadedBytes: stats.uploadedBytes,
      downloadedBytes: stats.downloadedBytes,
      ratio: stats.ratio,
      bufferBytes: stats.bufferBytes,
      seedingCount: stats.seedingCount,
      leechingCount: stats.leechingCount,
      seedbonus: stats.seedbonus,
      hitAndRuns: stats.hitAndRuns,
      requiredRatio: stats.requiredRatio,
      warned: stats.warned,
      freeleechTokens: stats.freeleechTokens,
      shareScore: stats.shareScore ?? null,
      username: privacyMode ? maskUsername(stats.username) : stats.username,
      group: privacyMode ? maskUsername(stats.group) : stats.group,
    })

    try {
      await dispatchNotifications(
        {
          trackerId: tracker.id,
          trackerName: tracker.name,
          storeUsernames: privacyMode === false,
          currentRatio: stats.ratio,
          previousRatio: previousSnapshot?.ratio ?? null,
          currentHnrs: stats.hitAndRuns,
          previousHnrs: previousSnapshot?.hitAndRuns ?? null,
          currentBufferBytes: stats.bufferBytes !== null ? stats.bufferBytes : null,
          previousBufferBytes: previousSnapshot?.bufferBytes ?? null,
          trackerDown: false,
          trackerError: null,
          currentWarned: stats.warned ?? null,
          previousWarned: previousSnapshot?.warned ?? null,
          currentSeedingCount: stats.seedingCount ?? null,
          currentGroup: stats.group ?? null,
          previousGroup: previousSnapshot?.group ?? null,
          trackerIsActive: tracker.isActive,
          trackerPausedAt: null,
          trackerJoinedAt: tracker.joinedAt ?? null,
          minimumRatio: registryEntry?.rules?.minimumRatio,
        },
        encryptionKey,
        enabledTargets
      )
    } catch (err) {
      log.error(
        `Notification dispatch failed for ${tracker.name}: ${err instanceof Error ? err.message : "Unknown"}`
      )
    }

    await db
      .update(trackers)
      .set({
        lastPolledAt: timestamp,
        lastError: null,
        consecutiveFailures: 0,
        pausedAt: null,
        updatedAt: timestamp,
      })
      .where(eq(trackers.id, tracker.id))
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unknown error"
    const message = sanitizeNetworkError(raw, "Poll failed")
    log.error(`Poll failed for tracker ${trackerId}: ${raw}`)

    try {
      const now = new Date()
      const [updated] = await db
        .update(trackers)
        .set({
          lastError: message,
          consecutiveFailures: sql`${trackers.consecutiveFailures} + 1`,
          pausedAt: sql`CASE WHEN ${trackers.consecutiveFailures} + 1 >= ${POLL_FAILURE_THRESHOLD} THEN ${now.toISOString()}::timestamp ELSE ${trackers.pausedAt} END`,
          updatedAt: now,
        })
        .where(eq(trackers.id, trackerId))
        .returning({
          consecutiveFailures: trackers.consecutiveFailures,
          pausedAt: trackers.pausedAt,
        })

      if (updated?.pausedAt) {
        log.warn(
          `Tracker ${trackerId} auto-paused after ${updated.consecutiveFailures} consecutive failures`
        )
      }
    } catch (dbError) {
      log.error(dbError, `Failed to record poll failure for tracker ${trackerId}`)
    }

    try {
      await dispatchNotifications(
        {
          trackerId: tracker?.id ?? trackerId,
          trackerName: tracker?.name ?? String(trackerId),
          storeUsernames: false,
          currentRatio: null,
          previousRatio: null,
          currentHnrs: null,
          previousHnrs: null,
          currentBufferBytes: null,
          previousBufferBytes: null,
          trackerDown: true,
          trackerError: message,
          currentWarned: null,
          previousWarned: null,
          currentSeedingCount: null,
          currentGroup: null,
          previousGroup: null,
          trackerIsActive: tracker?.isActive ?? true,
          trackerPausedAt: tracker?.pausedAt?.toISOString() ?? null,
          trackerJoinedAt: tracker?.joinedAt ?? null,
          minimumRatio: undefined,
        },
        encryptionKey,
        enabledTargets
      )
    } catch {
      // security-audit-ignore: notification dispatch is non-critical — errors logged inside dispatchNotifications
    }
  }
}

export async function pruneOldSnapshots(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(trackerSnapshots)
    .where(lt(trackerSnapshots.polledAt, cutoff))
    .returning({ id: trackerSnapshots.id })
  return deleted.length
}

export async function pollAllTrackers(encryptionKey: Buffer): Promise<void> {
  // Query settings first — global interval is needed for overdue filtering
  const [settings] = await db
    .select({
      storeUsernames: appSettings.storeUsernames,
      snapshotRetentionDays: appSettings.snapshotRetentionDays,
      trackerPollIntervalMinutes: appSettings.trackerPollIntervalMinutes,
      proxyEnabled: appSettings.proxyEnabled,
      proxyType: appSettings.proxyType,
      proxyHost: appSettings.proxyHost,
      proxyPort: appSettings.proxyPort,
      proxyUsername: appSettings.proxyUsername,
      encryptedProxyPassword: appSettings.encryptedProxyPassword,
    })
    .from(appSettings)
    .limit(1)

  const globalIntervalMs = (settings?.trackerPollIntervalMinutes ?? 60) * 60 * 1000

  const allTrackers = await db.select().from(trackers).where(eq(trackers.isActive, true))

  const now = Date.now()

  const overdue = allTrackers.filter((tracker) => {
    if (tracker.pausedAt) return false
    const lastPoll = tracker.lastPolledAt?.getTime() ?? 0
    return now - lastPoll >= globalIntervalMs
  })

  if (overdue.length === 0) return

  const privacyMode = settings ? !settings.storeUsernames : false

  // Build proxy agent once for all trackers that need it
  const proxyAgent = settings ? buildProxyAgentFromSettings(settings, encryptionKey) : undefined

  // Fetch notification targets once for the entire poll cycle — avoids N identical queries
  let enabledNotificationTargets: (typeof notificationTargets.$inferSelect)[] = []
  try {
    enabledNotificationTargets = await db
      .select()
      .from(notificationTargets)
      .where(eq(notificationTargets.enabled, true))
  } catch (err) {
    log.error(
      `pollAllTrackers: failed to fetch notification targets: ${err instanceof Error ? err.message : "Unknown"}`
    )
  }

  // Capture a single timestamp for the whole batch so all snapshots in one
  // cycle share the same polledAt value — simplifies time-series queries
  const batchTimestamp = new Date()

  // Poll all overdue trackers in parallel — one slow tracker won't block the rest
  await Promise.allSettled(
    overdue.map((tracker) =>
      pollTracker(
        tracker.id,
        encryptionKey,
        privacyMode,
        proxyAgent,
        batchTimestamp,
        enabledNotificationTargets
      )
    )
  )

  // Prune old snapshots if retention is configured
  if (settings?.snapshotRetentionDays && settings.snapshotRetentionDays > 0) {
    try {
      const pruned = await pruneOldSnapshots(settings.snapshotRetentionDays)
      if (pruned > 0) {
        log.info(`Pruned ${pruned} snapshots older than ${settings.snapshotRetentionDays} days`)
      }
    } catch (error) {
      log.error(error, "Snapshot pruning failed")
    }
  }

  // Prune expired dismissed alerts (stale-data and zero-seeding types expire after 24h)
  try {
    await pruneDismissedAlerts()
  } catch (error) {
    log.error(error, "Dismissed alerts pruning failed")
  }
}

export function startScheduler(encryptionKey: Buffer): void {
  if (getSchedulerTask()) return

  setSchedulerKey(encryptionKey)

  // Poll immediately on start — don't wait for first 5-minute tick
  pollAllTrackers(encryptionKey).catch((error) => {
    log.error(error, "Initial poll error")
  })

  // Then check every 5 minutes for overdue trackers
  const task = cron.schedule("*/5 * * * *", async () => {
    if (getPollInFlight()) return
    setPollInFlight(true)
    try {
      await pollAllTrackers(encryptionKey)
    } catch (error) {
      log.error(error, "Scheduler error")
    } finally {
      setPollInFlight(false)
    }
  })
  setSchedulerTask(task)

  log.info("Polling scheduler started (checking every 5 minutes)")

  startClientScheduler(encryptionKey)
  startBackupScheduler(encryptionKey)
}

export function stopScheduler(): void {
  const task = getSchedulerTask()
  if (task) {
    task.stop()
    setSchedulerTask(null)
  }
  // Zero-fill the encryption key buffer to prevent it from lingering in memory
  const key = getSchedulerKey()
  if (key) {
    key.fill(0)
    setSchedulerKey(null)
  }

  stopClientScheduler()
  stopBackupScheduler()
}

/** Exposed for testing — returns the raw schedulerKey buffer reference. */
export function _getSchedulerKeyForTest(): Buffer | null {
  return getSchedulerKey()
}

/**
 * Restarts the scheduler if it died (i.e, after server restart).
 * Called from the auth layout on every authenticated page load.
 */
export function ensureSchedulerRunning(encryptionKeyHex: string): void {
  if (getSchedulerTask()) return
  const key = Buffer.from(encryptionKeyHex, "hex")
  startScheduler(key)
  ensureClientSchedulerRunning(encryptionKeyHex)
}
