// src/lib/tracker-scheduler.ts
//
// Functions: pollTracker, pollAllTrackers, pruneOldSnapshots, pruneOldCheckpoints,
// startTrackerPolling, stopTrackerPolling, isTrackerPollingRunning
// Constants: POLL_TRACKER_COLUMNS
import type { Agent as HttpAgent } from "node:http"

import { and, desc, eq, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm"
import cron, { type ScheduledTask } from "node-cron"
import { registryHostname, trackerSiteFor } from "@/data/tracker-registry"
import { pruneDismissedAlerts } from "@/lib/alert-pruning"
import { pruneCoverageGaps } from "@/lib/app-liveness"
import { decrypt } from "@/lib/crypto"
import { withCycleDeadline } from "@/lib/cycle-deadline"
import { db } from "@/lib/db"
import type { NotificationTargetRow } from "@/lib/db/schema"
import {
  appSettings,
  notificationTargets,
  torrentDailyCheckpoints,
  trackerDailyCheckpoints,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { errMsg, isDecryptionError, sanitizeNetworkError } from "@/lib/error-utils"
import { flareSolverrFor } from "@/lib/flaresolverr-config"
import { localDateStr, trackerDateStr } from "@/lib/formatters"
import {
  POLL_BATCH_TOLERANCE_MS,
  POLL_CYCLE_DEADLINE_MS,
  POLL_FAILURE_THRESHOLD,
  POLL_INTERVAL_DEFAULT,
  POLL_TICK_MINUTES,
} from "@/lib/limits"
import { log } from "@/lib/logger"
import { isOutboundDisabled } from "@/lib/network"
import { dispatchNotifications } from "@/lib/notifications/dispatch"
import { maskUsername } from "@/lib/privacy"
import { recordDatabaseSize } from "@/lib/server-data"
import { pruneTrackerOutages, recordTrackerPollFailure } from "@/lib/tracker-outages"
import { buildFetchOptions, getAdapter } from "@/lib/tracker-platforms"
import {
  getPauseState,
  isRetryablePollError,
  isRetryingPause,
  pauseRetryPickupAt,
  resolveRequiredRatio,
} from "@/lib/tracker-status"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"
import type {
  AvistazPlatformMeta,
  C411PlatformMeta,
  DigitalCorePlatformMeta,
  HawkePlatformMeta,
  MamPlatformMeta,
} from "@/types/tracker-stats"

// Platforms whose only platform alert is download-revoked, read from
// platformMeta.canDownload.
const DOWNLOAD_ALERT_ONLY_PLATFORMS = new Set(["c411", "hawke"])
// Platforms whose download-revoked alert compares this poll's meta with the last.
const DOWNLOAD_ALERT_PLATFORMS = new Set([
  "avistaz",
  "digitalcore",
  ...DOWNLOAD_ALERT_ONLY_PLATFORMS,
])

// Store on globalThis to survive HMR in development.
// Without this, each hot-reload orphans the old cron job (it keeps firing)
// while creating a new one which causes duplicate polls that hammer tracker APIs.
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

/** Columns needed for poll cycle. Excludes avatarData (~5MB), avatarMimeType, avatarCachedAt, color, qbtTag, etc. */
const POLL_TRACKER_COLUMNS = {
  id: trackers.id,
  name: trackers.name,
  isActive: trackers.isActive,
  encryptedApiToken: trackers.encryptedApiToken,
  registrySlug: trackers.registrySlug,
  baseUrl: trackers.baseUrl,
  useProxy: trackers.useProxy,
  useFlaresolverr: trackers.useFlaresolverr,
  remoteUserId: trackers.remoteUserId,
  platformMeta: trackers.platformMeta,
  joinedAt: trackers.joinedAt,
  lastPolledAt: trackers.lastPolledAt,
  lastError: trackers.lastError,
  lastErrorAt: trackers.lastErrorAt,
  consecutiveFailures: trackers.consecutiveFailures,
  pausedAt: trackers.pausedAt,
  userPausedAt: trackers.userPausedAt,
  updatedAt: trackers.updatedAt,
} as const

/**
 * Pauses a row the tracker list does not carry, naming the host it was set up
 * for. A row already paused keeps its own reason, and the isNull claim keeps two
 * overlapping polls from writing it twice.
 */
async function pauseUnlinked(tracker: {
  id: number
  name: string
  baseUrl: string
  pausedAt: Date | null
}): Promise<void> {
  if (tracker.pausedAt) return
  const host = registryHostname(tracker.baseUrl)
  const lastError = host
    ? `Not in the tracker list, so it isn't polled. It was set up for ${host}`
    : "Not in the tracker list, so it isn't polled"
  const now = new Date()
  const [paused] = await db
    .update(trackers)
    .set({ pausedAt: now, lastError, lastErrorAt: now, updatedAt: now })
    .where(and(eq(trackers.id, tracker.id), isNull(trackers.pausedAt)))
    .returning({ id: trackers.id })
  if (paused) {
    log.warn(
      { trackerId: tracker.id, trackerName: tracker.name, host },
      "Paused a tracker that is not in the tracker list"
    )
  }
}

export async function pollTracker(
  trackerId: number,
  encryptionKey: Buffer,
  privacyMode: boolean,
  // Undefined means the proxy is off, and a row set to use it polls directly.
  proxyAgent: HttpAgent | undefined,
  batchTimestamp?: Date,
  enabledTargets?: NotificationTargetRow[],
  isManual = false
): Promise<boolean> {
  const [tracker] = await db
    .select(POLL_TRACKER_COLUMNS)
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker?.isActive) return false
  // The token only ever goes to an address from the tracker list.
  const site = trackerSiteFor(tracker)
  if (!site) {
    await pauseUnlinked(tracker)
    return false
  }
  if (site.entry.defunct) return false

  const timestamp = batchTimestamp ?? new Date()

  try {
    let apiToken: string
    try {
      apiToken = decrypt(tracker.encryptedApiToken, encryptionKey)
    } catch (err) {
      const cause = errMsg(err)
      if (isDecryptionError(err)) {
        throw new Error(`Unreadable stored credential for tracker "${tracker.name}": ${cause}`)
      }
      throw new Error(`API key is missing or invalid for tracker "${tracker.name}": ${cause}`)
    }
    // An empty token decrypts cleanly but can never authenticate, so fail here
    // with an actionable error rather than spend a request on the tracker's 401.
    if (!apiToken) {
      throw new Error(`API key is missing or invalid for tracker "${tracker.name}": token is empty`)
    }
    const adapter = getAdapter(site.platform)
    const flaresolverr = await flareSolverrFor(tracker)
    // With the proxy off there is no agent, so a row set to use it polls directly.
    // A proxy that is on but unusable hands over an agent that refuses everything.
    const fetchOptions = buildFetchOptions({
      entry: site.entry,
      proxyAgent: tracker.useProxy ? proxyAgent : undefined,
      remoteUserId: tracker.remoteUserId ?? undefined,
      flaresolverr,
    })
    const stats = await adapter.fetchStats(site.url, apiToken, site.apiPath, fetchOptions)

    // Snapshot the previous platformMeta before writing the current poll's metadata to DB.
    // dispatchNotifications uses this for change detection (i.e. canDownload transition).
    let previousPlatformMeta: Record<string, unknown> | null = null
    if (DOWNLOAD_ALERT_PLATFORMS.has(site.platform) && tracker.platformMeta) {
      try {
        previousPlatformMeta = JSON.parse(tracker.platformMeta) as Record<string, unknown>
      } catch (err) {
        log.warn(
          { trackerId: tracker.id, error: err instanceof Error ? err.message : "unknown" },
          "failed to parse previous platformMeta"
        )
      }
    }

    // Cache metadata from poll (remoteUserId saves an API call, joinedDate/platformMeta enrich the UI)
    const metaUpdates: Record<string, unknown> = {}
    if (stats.remoteUserId && stats.remoteUserId !== tracker.remoteUserId) {
      metaUpdates.remoteUserId = stats.remoteUserId
    }
    if (stats.joinedDate && !tracker.joinedAt) {
      const joined = trackerDateStr(stats.joinedDate)
      if (joined) metaUpdates.joinedAt = joined
    }
    if (stats.lastAccessDate) {
      const lastAccess = trackerDateStr(stats.lastAccessDate)
      if (lastAccess) metaUpdates.lastAccessAt = lastAccess
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

    // Fetch previous snapshot before inserting the new one (used for change detection in notifications)
    const [previousSnapshot] = await db
      .select({
        ratio: trackerSnapshots.ratio,
        hitAndRuns: trackerSnapshots.hitAndRuns,
        bufferBytes: trackerSnapshots.bufferBytes,
        warned: trackerSnapshots.warned,
        group: trackerSnapshots.group,
        seedingCount: trackerSnapshots.seedingCount,
        seedbonus: trackerSnapshots.seedbonus,
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
      isManual,
    })

    try {
      // Upsert daily checkpoint for "Today At A Glance" comparisons
      const checkpointDate = localDateStr(timestamp)
      await db
        .insert(trackerDailyCheckpoints)
        .values({
          trackerId: tracker.id,
          checkpointDate,
          uploadedBytesEnd: stats.uploadedBytes !== null ? BigInt(stats.uploadedBytes) : 0n,
          downloadedBytesEnd: stats.downloadedBytes !== null ? BigInt(stats.downloadedBytes) : 0n,
          bufferBytesEnd: stats.bufferBytes !== null ? BigInt(stats.bufferBytes) : null,
          ratioEnd: stats.ratio,
          seedbonusEnd: stats.seedbonus,
          snapshotCount: 1,
        })
        .onConflictDoUpdate({
          target: [trackerDailyCheckpoints.trackerId, trackerDailyCheckpoints.checkpointDate],
          set: {
            uploadedBytesEnd: stats.uploadedBytes !== null ? BigInt(stats.uploadedBytes) : 0n,
            downloadedBytesEnd: stats.downloadedBytes !== null ? BigInt(stats.downloadedBytes) : 0n,
            bufferBytesEnd: stats.bufferBytes !== null ? BigInt(stats.bufferBytes) : null,
            ratioEnd: stats.ratio,
            seedbonusEnd: stats.seedbonus,
            snapshotCount: sql`${trackerDailyCheckpoints.snapshotCount} + 1`,
          },
        })
    } catch (checkpointErr) {
      log.warn(
        `Daily checkpoint upsert failed for tracker ${tracker.id}: ${checkpointErr instanceof Error ? checkpointErr.message : "Unknown"}`
      )
    }

    try {
      const mamMeta =
        site.platform === "mam" ? (stats.platformMeta as MamPlatformMeta | undefined) : undefined

      const avistazMeta =
        site.platform === "avistaz"
          ? (stats.platformMeta as AvistazPlatformMeta | undefined)
          : undefined

      const dcMeta =
        site.platform === "digitalcore"
          ? (stats.platformMeta as DigitalCorePlatformMeta | undefined)
          : undefined

      const canDownloadMeta = DOWNLOAD_ALERT_ONLY_PLATFORMS.has(site.platform)
        ? (stats.platformMeta as C411PlatformMeta | HawkePlatformMeta | undefined)
        : undefined

      await dispatchNotifications(
        {
          trackerId: tracker.id,
          trackerName: tracker.name,
          storeUsernames: privacyMode === false,
          currentRatio: stats.ratio,
          previousRatio: previousSnapshot?.ratio ?? null,
          currentHnrs: stats.hitAndRuns,
          previousHnrs: previousSnapshot?.hitAndRuns ?? null,
          currentBufferBytes: stats.bufferBytes,
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
          minimumRatio: resolveRequiredRatio(stats.requiredRatio, tracker) ?? undefined,
          platformContext:
            site.platform === "mam"
              ? {
                  currentSeedbonus: stats.seedbonus ?? null,
                  previousSeedbonus: previousSnapshot?.seedbonus ?? null,
                  vipUntil: mamMeta?.vipUntil ?? null,
                  unsatisfiedCount: mamMeta?.unsatisfiedCount ?? null,
                  unsatisfiedLimit: mamMeta?.unsatisfiedLimit ?? null,
                  inactiveHnrCount: stats.hitAndRuns ?? null,
                  previousInactiveHnrCount: previousSnapshot?.hitAndRuns ?? null,
                  canDownload: null,
                  previousCanDownload: null,
                }
              : site.platform === "avistaz"
                ? {
                    // The 99,999 bonus cap these feed is MAM's.
                    currentSeedbonus: null,
                    previousSeedbonus: null,
                    vipUntil: avistazMeta?.vipExpiry ?? null,
                    unsatisfiedCount: null,
                    unsatisfiedLimit: null,
                    inactiveHnrCount: null,
                    previousInactiveHnrCount: null,
                    canDownload: avistazMeta?.canDownload ?? null,
                    previousCanDownload:
                      (previousPlatformMeta?.canDownload as boolean | null) ?? null,
                  }
                : site.platform === "digitalcore"
                  ? {
                      // The 99,999 bonus cap these feed is MAM's.
                      currentSeedbonus: null,
                      previousSeedbonus: null,
                      vipUntil: null,
                      unsatisfiedCount: null,
                      unsatisfiedLimit: null,
                      inactiveHnrCount: null,
                      previousInactiveHnrCount: null,
                      canDownload:
                        dcMeta?.downloadBan === true
                          ? false
                          : dcMeta?.downloadBan === false
                            ? true
                            : null,
                      previousCanDownload:
                        previousPlatformMeta?.downloadBan === true
                          ? false
                          : previousPlatformMeta?.downloadBan === false
                            ? true
                            : null,
                    }
                  : DOWNLOAD_ALERT_ONLY_PLATFORMS.has(site.platform)
                    ? {
                        currentSeedbonus: null,
                        previousSeedbonus: null,
                        vipUntil: null,
                        unsatisfiedCount: null,
                        unsatisfiedLimit: null,
                        inactiveHnrCount: null,
                        previousInactiveHnrCount: null,
                        canDownload: canDownloadMeta?.canDownload ?? null,
                        previousCanDownload:
                          (previousPlatformMeta?.canDownload as boolean | null) ?? null,
                      }
                    : undefined,
        },
        encryptionKey,
        enabledTargets
      )
    } catch (err) {
      log.error(
        `Notification dispatch failed for ${tracker.name}: ${err instanceof Error ? err.message : "Unknown"}`
      )
    }

    const wasPaused = !!tracker.pausedAt
    const hadFailures = tracker.consecutiveFailures > 0

    await db
      .update(trackers)
      .set({
        lastPolledAt: timestamp,
        lastError: null,
        lastErrorAt: null,
        consecutiveFailures: 0,
        pausedAt: null,
        updatedAt: timestamp,
      })
      .where(eq(trackers.id, tracker.id))

    if (wasPaused || hadFailures) {
      log.info(
        {
          trackerId: tracker.id,
          trackerName: tracker.name,
          previousFailures: tracker.consecutiveFailures,
          wasPaused,
          source: isManual ? "manual" : "scheduled",
        },
        "circuit breaker reset by successful poll"
      )
    }
    return true
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unknown error"
    const message = sanitizeNetworkError(raw, "Poll failed")
    log.error(
      {
        trackerId,
        trackerName: tracker?.name,
        source: isManual ? "manual" : "scheduled",
        previousFailures: tracker?.consecutiveFailures ?? "unknown",
        // `message` is what the UI stores and is deliberately lossy. Keep the
        // raw cause in the server log too, or an adapter choking on a changed
        // payload is indistinguishable from a dead host (issue #214). Adapters
        // name the hostname in their errors, never the URL, so a query-string
        // api_token cannot ride along; the one thing to drop is the bound
        // params of a drizzle "Failed query" error, which for the snapshot
        // insert include the username when privacy mode is off.
        cause: raw.split("\nparams:")[0],
      },
      `Poll failed for tracker ${trackerId}: ${message}`
    )

    try {
      const now = new Date()
      const [updated] = await db
        .update(trackers)
        .set({
          lastError: message,
          lastErrorAt: now,
          consecutiveFailures: sql`${trackers.consecutiveFailures} + 1`,
          // A pause keeps the time it began through every failed retry.
          pausedAt: sql`COALESCE(${trackers.pausedAt}, CASE WHEN ${trackers.consecutiveFailures} + 1 >= ${POLL_FAILURE_THRESHOLD} THEN ${now.toISOString()}::timestamp END)`,
          updatedAt: now,
        })
        .where(eq(trackers.id, trackerId))
        .returning({
          consecutiveFailures: trackers.consecutiveFailures,
          pausedAt: trackers.pausedAt,
        })

      if (updated?.pausedAt && !tracker.pausedAt) {
        log.warn(
          {
            trackerId,
            trackerName: tracker?.name,
            consecutiveFailures: updated.consecutiveFailures,
            threshold: POLL_FAILURE_THRESHOLD,
            lastError: message,
          },
          `Tracker ${trackerId} auto-paused after ${updated.consecutiveFailures} consecutive failures`
        )
      } else if (updated?.pausedAt) {
        log.info(
          {
            trackerId,
            consecutiveFailures: updated.consecutiveFailures,
            source: isManual ? "manual" : "scheduled",
            lastError: message,
          },
          `Paused tracker ${trackerId} failed again`
        )
      } else if (updated) {
        log.info(
          {
            trackerId,
            consecutiveFailures: updated.consecutiveFailures,
            threshold: POLL_FAILURE_THRESHOLD,
          },
          `Poll failure ${updated.consecutiveFailures}/${POLL_FAILURE_THRESHOLD} for tracker ${trackerId}`
        )
      }
    } catch (dbError) {
      log.error(dbError, `Failed to record poll failure for tracker ${trackerId}`)
    }

    // Write the failure into the connectability ledger that backs this tracker's
    // outage bands. Separate from the columns updated above, which are current
    // state and are wiped by the next success. See the header of
    // tracker-outages.ts. Recording is failure-only and every row is written
    // closed, so there is deliberately no matching call on the success path.
    // recordTrackerPollFailure never throws, so this needs no guard of its own.
    await recordTrackerPollFailure(trackerId, isManual ? "manual" : "poll")

    // A paused tracker's failures send nothing, except the retry that turns the
    // pause hard: the tracker answered, so waiting will not fix it.
    const notify = !tracker.pausedAt || (isRetryingPause(tracker) && !isRetryablePollError(message))
    if (!notify) return false

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
          platformContext: undefined,
        },
        encryptionKey,
        enabledTargets
      )
    } catch (err) {
      log.warn(
        {
          trackerId: tracker?.id ?? trackerId,
          error: errMsg(err),
        },
        "Error-path notification dispatch failed"
      )
    }
    return false
  }
}

/** @internal Used by tests. */
export async function pruneOldSnapshots(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(trackerSnapshots)
    .where(
      and(
        lt(trackerSnapshots.polledAt, cutoff),
        notInArray(
          trackerSnapshots.trackerId,
          db.select({ id: trackers.id }).from(trackers).where(isNotNull(trackers.userPausedAt))
        )
      )
    )
    .returning({ id: trackerSnapshots.id })
  return deleted.length
}

async function pruneOldCheckpoints(retentionDays: number): Promise<number> {
  const cutoffDate = localDateStr(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const [deletedTracker, deletedTorrent] = await Promise.all([
    db
      .delete(trackerDailyCheckpoints)
      .where(lt(trackerDailyCheckpoints.checkpointDate, cutoffDate))
      .returning({ id: trackerDailyCheckpoints.id }),
    db
      .delete(torrentDailyCheckpoints)
      .where(lt(torrentDailyCheckpoints.checkpointDate, cutoffDate))
      .returning({ id: torrentDailyCheckpoints.id }),
  ])

  return deletedTracker.length + deletedTorrent.length
}

/** @internal Used by tests. */
export async function pollAllTrackers(encryptionKey: Buffer): Promise<void> {
  // Query settings first; global interval is needed for overdue filtering
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

  const intervalMinutes = settings?.trackerPollIntervalMinutes ?? POLL_INTERVAL_DEFAULT
  const globalIntervalMs = intervalMinutes * 60 * 1000

  const allTrackers = await db
    .select(POLL_TRACKER_COLUMNS)
    .from(trackers)
    .where(eq(trackers.isActive, true))

  const now = Date.now()

  const overdue = allTrackers.filter((tracker) => {
    const pause = getPauseState(tracker)
    if (pause.isPaused) {
      const pickupAt = isRetryingPause(tracker)
        ? pauseRetryPickupAt(tracker, intervalMinutes)
        : null
      if (pickupAt && now >= pickupAt.getTime()) {
        log.info(
          {
            tracker: tracker.name,
            consecutiveFailures: tracker.consecutiveFailures,
            lastError: tracker.lastError,
          },
          "retrying a tracker paused while unreachable"
        )
        return true
      }
      log.debug(
        {
          tracker: tracker.name,
          reason: pause.reason,
          consecutiveFailures: tracker.consecutiveFailures,
          pausedAt: tracker.pausedAt?.toISOString() ?? null,
          userPausedAt: tracker.userPausedAt?.toISOString() ?? null,
        },
        "skipping paused tracker"
      )
      return false
    }
    const lastPoll = tracker.lastPolledAt?.getTime() ?? 0
    return now - lastPoll >= globalIntervalMs - POLL_BATCH_TOLERANCE_MS
  })

  if (overdue.length === 0) return

  const privacyMode = settings ? !settings.storeUsernames : false

  // Build proxy agent once for all trackers that need it
  const proxyAgent = settings ? buildProxyAgentFromSettings(settings, encryptionKey) : undefined

  // Fetch notification targets once for the entire poll cycle (avoids N identical queries)
  let enabledNotificationTargets: NotificationTargetRow[] = []
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
  // cycle share the same polledAt value, simplifying time-series queries
  const batchTimestamp = new Date()

  // Poll all overdue trackers in parallel so one slow tracker won't block the rest
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

  // Prune old snapshots if retention is configured in app settings
  if (settings?.snapshotRetentionDays && settings.snapshotRetentionDays > 0) {
    try {
      const pruned = await pruneOldSnapshots(settings.snapshotRetentionDays)
      if (pruned > 0) {
        log.info(`Pruned ${pruned} snapshots older than ${settings.snapshotRetentionDays} days`)
      }
    } catch (error) {
      log.error(error, "Snapshot pruning failed")
    }

    try {
      const prunedCheckpoints = await pruneOldCheckpoints(settings.snapshotRetentionDays)
      if (prunedCheckpoints > 0) {
        log.info(
          `Pruned ${prunedCheckpoints} checkpoint rows older than ${settings.snapshotRetentionDays} days`
        )
      }
    } catch (error) {
      log.error(error, "Checkpoint pruning failed")
    }

    // Coverage gaps expire on the same schedule and the same horizon as the
    // snapshots they explain. This coupling is deliberate and load-bearing: if
    // gaps were pruned on a different horizon, charts would outlive their own
    // explanations and a region with no gap record would be indistinguishable from
    // a healthy one. This same retention asymmetry makes inferring downtime from
    // missing rows a lie. Keep this call inside this guard, sharing this retention
    // value. Never prune gaps more aggressively than snapshots (pruneCoverageGaps
    // keys on endedAt for exactly that reason).
    try {
      const prunedGaps = await pruneCoverageGaps(settings.snapshotRetentionDays)
      if (prunedGaps > 0) {
        log.info(
          `Pruned ${prunedGaps} app coverage gaps older than ${settings.snapshotRetentionDays} days`
        )
      }
    } catch (error) {
      log.error(error, "Coverage gap pruning failed")
    }

    // Tracker outages expire on the same horizon, for the same reason and inside
    // the same guard. A tracker chart that outlives its own outage records would
    // show an unexplained flat stretch, which is the exact failure this ledger
    // exists to prevent.
    try {
      const prunedOutages = await pruneTrackerOutages(settings.snapshotRetentionDays)
      if (prunedOutages > 0) {
        log.info(
          `Pruned ${prunedOutages} tracker outages older than ${settings.snapshotRetentionDays} days`
        )
      }
    } catch (error) {
      log.error(error, "Tracker outage pruning failed")
    }
  }

  // Record daily database size for storage chart
  try {
    await recordDatabaseSize()
  } catch (error) {
    log.error(error, "Database size recording failed")
  }

  // Prune expired dismissed alerts (stale-data and zero-seeding types expire after 24h)
  try {
    await pruneDismissedAlerts()
  } catch (error) {
    log.error(error, "Dismissed alerts pruning failed")
  }
}

export function startTrackerPolling(encryptionKey: Buffer): void {
  if (isOutboundDisabled()) return
  if (getSchedulerTask()) return

  setSchedulerKey(encryptionKey)

  // Poll immediately on start, don't wait for first 5-minute tick
  pollAllTrackers(encryptionKey).catch((error) => {
    log.error(error, "Initial poll error")
  })

  // Then check every 5 minutes for overdue trackers. The latch below is only
  // released by the finally, so the await is bounded: a cycle whose promise
  // never settles must not lock every later tick out.
  const task = cron.schedule(`*/${POLL_TICK_MINUTES} * * * *`, async () => {
    if (getPollInFlight()) return
    setPollInFlight(true)
    try {
      await withCycleDeadline(pollAllTrackers(encryptionKey), POLL_CYCLE_DEADLINE_MS, "poll cycle")
    } catch (error) {
      log.error(error, "Scheduler error")
    } finally {
      setPollInFlight(false)
    }
  })
  setSchedulerTask(task)

  log.info("Tracker polling started (checking every 5 minutes)")
}

export function stopTrackerPolling(): void {
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
}

export function isTrackerPollingRunning(): boolean {
  return getSchedulerTask() !== null
}

/**
 * Exposed for testing. Returns the raw schedulerKey buffer reference.
 * @internal
 */
export function _getSchedulerKeyForTest(): Buffer | null {
  return getSchedulerKey()
}
