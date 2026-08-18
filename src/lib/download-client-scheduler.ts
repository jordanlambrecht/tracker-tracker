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
//            startClientScheduler, stopClientScheduler, isClientSchedulerRunning,
//            ensureClientSchedulerRunning
//
// Side effects of deepPollClient:
//   - Writes torrent daily checkpoints (torrentDailyCheckpoints) for "Movers & Shakers".
//     Uses onConflictDoNothing so the first poll of the day wins; subsequent polls skip.
//   - Writes one clientSnapshots row per successful poll, and only per successful
//     poll. A snapshot is an observation: it is inserted before the
//     downloadClients status update, never alongside it, and never at all when
//     the sync store could not be proven initialised. A row of zeros from a
//     half-applied delta would be indistinguishable from a genuinely idle
//     client, which is worse than the gap it would fill.
//
// Retention: the hourly prune below deletes clientSnapshots and
// clientUptimeBuckets ONLY when app_settings.snapshot_retention_days holds a
// positive value. NULL means "keep forever" (see db/schema.ts) and must never
// be defaulted to a number here — doing so deleted five months of client
// history on an install that had never configured retention at all.
//
// Failure logging for both loops is gated by failure-log-gate.ts: a line is
// emitted on state changes only — outage onset, a changed cause, a periodic
// reminder, recovery — so a permanently down client no longer writes a line
// every 5s. Uptime recording is deliberately outside the gate: every attempt
// is still made and still recorded, so the 5-minute buckets are unaffected.

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
    authMethod: string
    encryptedUsername: string
    encryptedPassword: string
    encryptedApiKey: string
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
    const verdict = noteFailure(client.id, "heartbeat", raw)
    // `message` is deliberately lossy — it is what reaches the UI. Keep the
    // unsanitised cause in the server log too, or a missing DB column, a DNS
    // failure and a refused connection are all indistinguishable from the
    // "Connection failed" fallback. Safe to log: the host pattern forbids "@",
    // so a baseUrl can never carry credentials, and qBittorrent secrets travel
    // in headers and bodies rather than URLs.
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
          `Heartbeat still failing for client ${client.id} (${client.name}) — down ${Math.round(downForMs / 60_000)}m, ${verdict.failures} failed attempts, ${verdict.suppressed} log lines suppressed: ${message}`
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
  // This one line covers deletion, disable, and restore-from-backup, and it
  // sweeps deep-poll keys too — a disabled client should hold neither.
  retainFailureLogClients(new Set(allClients.map((c) => c.id)))

  if (allClients.length === 0) return

  await Promise.allSettled(allClients.map((c) => heartbeatClient(c, encryptionKey)))
}

// ---------------------------------------------------------------------------
// Deep poll
// ---------------------------------------------------------------------------

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
  // a restore). Blank username/password is a valid configuration — qBittorrent
  // bypasses auth for localhost — so this checks for a missing *ciphertext*,
  // not a missing secret, and reads whichever column the auth mode uses.
  //
  // The skip stays, but it is no longer silent. heartbeatClient has no
  // equivalent guard, so such a client heartbeats green while its deep poll
  // vanishes — no log, no lastError, no snapshot. That is the one way a client
  // can stop recording history with nothing anywhere to say so, and it is
  // exactly the shape this investigation had to rule out by hand. The warning
  // goes through the same failure-log gate as a real outage, so a permanently
  // uncredentialled client costs one line plus a reminder every 15 minutes,
  // not one every 30 seconds.
  const missingCredentials =
    client.authMethod === "apikey"
      ? !client.encryptedApiKey
      : !client.encryptedUsername || !client.encryptedPassword
  if (missingCredentials) {
    const verdict = noteFailure(clientId, "deep-poll", "missing credential ciphertext")
    if (verdict.kind !== "silent") {
      log.warn(
        { clientId, clientName: client.name, authMethod: client.authMethod },
        `Deep poll skipped for client ${clientId} (${client.name}): stored credentials are empty — re-enter them for this client`
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
      applyMaindataUpdate(adapter.baseUrl, data)

      // The store can be wiped underneath this await: a heartbeat that takes a
      // 403 calls invalidateSession, which also calls resetStore — clearing the
      // torrent map and dropping `initialized` back to false. A delta then
      // merges into an empty map, applyMaindataUpdate only re-arms
      // `initialized` on a fullUpdate, and every subsequent read returns [].
      // The poll would then "succeed" and record a snapshot of zeros, which is
      // worse than recording nothing: nothing reads as a gap, zeros read as an
      // idle client. Re-sync from rid 0, and if the store still will not
      // initialise, fail the poll so no row is written at all.
      if (!isStoreInitialized(adapter.baseUrl)) {
        log.warn(
          { clientId, rid },
          `[deep-poll] client=${clientId} → sync store was reset mid-poll, re-syncing from rid 0 before recording a snapshot`
        )
        data = await adapter.getDeltaSync(0)
        applyMaindataUpdate(adapter.baseUrl, data)
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

    // Two post-filters, deliberately, and they must stay two.
    //
    // `torrents` is tag-only and feeds aggregateByTag and the daily
    // checkpoints. aggregator.ts derives totalSeedingCount and
    // totalLeechingCount from every torrent handed to it, so widening this list
    // would step both counts up on the first poll after an upgrade and put a
    // permanent discontinuity in a historical chart series nobody can repair.
    //
    // `cacheable` also keeps torrents matched by announce host, because that is
    // what the warm read in download-clients/coordinator.ts returns. While the
    // scheduler filtered on tags alone, an untagged torrent from a tracked site
    // was in a warm result and absent from the cached one, so a cold start
    // under-reported the fleet.
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

    // Cache the wider list for fallback when the client is offline — see the
    // two-list note above.
    const sanitizedTorrents = cacheable.map(slimTorrentForCache)
    const now = new Date()

    // Sequenced, not raced. The snapshot row IS the observation; the
    // downloadClients update is only the claim that an observation was made.
    // Run as one Promise.all, a rejected insert still let the update commit, so
    // lastPolledAt advanced and lastError cleared with nothing behind them —
    // the client read as "just polled, healthy" and was not overdue again for
    // a full interval, turning one failed write into a whole missing interval.
    // Insert first: if it throws, lastPolledAt stays put, the catch records the
    // error, and the next tick retries.
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
    const message = sanitizeNetworkError(raw)
    // Keyed on the clientId parameter, which is always defined — the row lookup
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
          `Deep poll still failing for client ${clientId} (${client?.name ?? "unknown"}) — down ${Math.round(downForMs / 60_000)}m, ${verdict.failures} failed attempts, ${verdict.suppressed} log lines suppressed: ${message}`
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

/** True only when BOTH loops are registered. Half-started is not running. */
export function isClientSchedulerRunning(): boolean {
  return getHeartbeatTask() !== null && getDeepPollTask() !== null
}

export function startClientScheduler(encryptionKey: Buffer): void {
  // Guarding on the heartbeat task alone made a half-started scheduler
  // permanent: the heartbeat is registered first, so anything that threw
  // before the deep-poll task was created left a live heartbeat, a dead deep
  // poll, and an idempotency check that returned early forever after. The
  // heartbeat kept the UI green while snapshots stopped entirely.
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
        // NULL retention means "keep forever" — see the snapshotRetentionDays
        // comment in db/schema.ts, and note it is also the never-configured
        // default. Defaulting it to SNAPSHOT_RETENTION_DEFAULT here turned an
        // unconfigured install into a rolling 90-day DELETE that ran on the
        // first tick after every boot and hourly thereafter, silently eating
        // client history nobody asked to lose. tracker-scheduler.ts guards the
        // identical delete with a truthiness check, which is why
        // tracker_snapshots kept months of rows over the same window while
        // client_snapshots kept only what fell inside the moving cutoff.
        // Do NOT reintroduce a default here: no configured value, no delete.
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
 * Returns a promise so a shutdown path can wait for the write. Every side
 * effect still happens synchronously, in the order it always did, before the
 * single trailing await — so the callers that ignore the promise (see below)
 * behave exactly as they did when this returned void. Nothing is deferred into
 * the promise except the wait itself.
 *
 * The promise NEVER rejects. Six call sites drop it on the floor, and an
 * unhandled rejection takes the process down in modern Node; the flush failure
 * is logged and swallowed here instead.
 *
 * Awaiting this is what actually saves the buckets, and today NO caller does:
 * scheduler.ts's `stopScheduler()` returns void and its SIGTERM handler calls
 * `process.exit(0)` on the next line, so on `docker stop` the flush is still
 * cut off mid-write. Making that path await is a two-line change in
 * scheduler.ts (forward the promise from stopScheduler, make the handler
 * `async` and await it before exiting) — until it lands, this signature is the
 * half of the fix that lives in this file.
 *
 * Note also what this does NOT recover: flushCompletedBuckets only drains
 * buckets strictly older than the current 5-minute window, so the in-progress
 * bucket is not written by the flush and is then dropped by
 * clearUptimeAccumulator. Saving it needs a flush-everything export from
 * uptime.ts; awaiting alone cannot do it.
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
  // insert, so wiping the globals below cannot steal rows already in flight —
  // and it leaves an empty queue behind, so a second stop cannot re-insert them.
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
