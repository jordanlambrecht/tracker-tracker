// src/lib/app-liveness.ts
//
// The app's own coverage ledger: the thing that lets a chart say "nothing was
// collected here" instead of drawing a flat line that looks like real zeroes.
//
// ── What this records ───────────────────────────────────────────────────────
// "The app was not collecting data" — NOT "the process was dead". Those differ:
// the scheduler also stops during a lockdown, a password change, and a restore,
// with the process very much alive. Both leave the same hole in the charts, so
// both are recorded.
//
// ── Why measured and not inferred ───────────────────────────────────────────
// Downtime is written down while it is observable and never reconstructed from
// missing rows. Gaps in client_uptime_buckets are NOT evidence of downtime: they
// cascade-delete with their client, do not exist before the uptime feature was
// instrumented, are absent entirely when no client is configured, and are lost on
// every clean stop by the un-awaited flush in stopClientScheduler. Inferring from
// them would hatch fake outages across all four cases.
//
// ── The catch-22, resolved ──────────────────────────────────────────────────
// You never log "I am down". The running app stamps `lastSeenAt` continuously,
// and the FIRST touch after a restart turns the distance from that stamp to now
// into a closed gap row. Detection also runs on EVERY touch, not just the first,
// so a stall inside a living process (lockdown, restore, host sleep) is caught
// too — boot is simply the first touch.
//
// Functions: touchAppLiveness, markAppStopped, getAppCoverage, getCoverageGaps,
//            pruneCoverageGaps, clearAppLivenessState

import { and, asc, eq, gte, lt, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { appCoverageGaps, appLiveness } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { MIN_BAND_MS } from "@/lib/outages"

/**
 * Minimum spacing between `lastSeenAt` UPDATEs. The heartbeat cron fires every
 * 5 seconds; writing on each tick would be 17k pointless UPDATEs a day.
 *
 * The cost is precision: a recorded gap can begin up to this much EARLIER than
 * the real outage did, which widens the band slightly rather than hiding any of
 * it. Erring wide is the safe direction — a band that starts 30s early still
 * explains the flat region; one that starts 30s late leaves a sliver of chart
 * unexplained.
 *
 * This throttle applies ONLY to the write. Gap DETECTION runs on every touch.
 */
export const LIVENESS_WRITE_THROTTLE_MS = 30 * 1000

/**
 * Shortest gap worth storing. Deliberately the SAME constant the renderer drops
 * bands below, imported rather than redeclared: a gap this module recorded but
 * the chart refuses to draw is an invisible row, and a threshold that drifts
 * between the two is a silent behaviour change.
 */
export const MIN_GAP_RECORD_MS = MIN_BAND_MS

/** Values of app_coverage_gaps.reason. Diagnostic only — all draw identically. */
export type CoverageGapReason = "shutdown" | "unclean" | "stalled"

export interface CoverageGap {
  start: number
  end: number
  reason: string
}

interface LivenessState {
  /** Set once the single app_liveness row has been read (or created). */
  reconciled: boolean
  /** id of that row, so writes never touch more than the one. */
  rowId: number | null
  /** Epoch ms of the last touch IN THIS PROCESS. Drives gap detection. */
  lastTouchMs: number | null
  /** Epoch ms of the last lastSeenAt UPDATE. Drives the throttle, nothing else. */
  lastWriteMs: number | null
  /** Coalesces concurrent callers so a boot never inserts two rows. */
  inFlight: Promise<void> | null
}

// Module-level singleton on globalThis so an HMR reload in dev does not reset
// `reconciled` and re-run the boot path against a still-live process.
const g = globalThis as typeof globalThis & { __appLivenessState?: LivenessState }

function getState(): LivenessState {
  if (!g.__appLivenessState) {
    g.__appLivenessState = {
      reconciled: false,
      rowId: null,
      lastTouchMs: null,
      lastWriteMs: null,
      inFlight: null,
    }
  }
  return g.__appLivenessState
}

/** Reset in-memory state. Tests and HMR only — never touches the database. */
export function clearAppLivenessState(): void {
  g.__appLivenessState = undefined
}

async function insertGap(startMs: number, endMs: number, reason: CoverageGapReason): Promise<void> {
  await db.insert(appCoverageGaps).values({
    startedAt: new Date(startMs),
    endedAt: new Date(endMs),
    reason,
  })
  const minutes = Math.round((endMs - startMs) / 60000)
  log.info(
    { startedAt: new Date(startMs).toISOString(), minutes, reason },
    "Recorded app coverage gap"
  )
}

async function writeLastSeen(state: LivenessState, nowMs: number): Promise<void> {
  const values = { lastSeenAt: new Date(nowMs), stoppedAt: null }
  if (state.rowId === null) {
    await db.update(appLiveness).set(values)
  } else {
    await db.update(appLiveness).set(values).where(eq(appLiveness.id, state.rowId))
  }
  state.lastWriteMs = nowMs
}

/**
 * First touch of this process: read the ledger and close the books on whatever
 * happened while we were not running.
 */
async function reconcile(state: LivenessState, nowMs: number): Promise<void> {
  const [row] = await db
    .select({
      id: appLiveness.id,
      firstSeenAt: appLiveness.firstSeenAt,
      lastSeenAt: appLiveness.lastSeenAt,
      stoppedAt: appLiveness.stoppedAt,
    })
    .from(appLiveness)
    .orderBy(asc(appLiveness.id))
    .limit(1)

  if (!row) {
    // First boot ever. This establishes the floor: with no prior observation
    // there is no outage to record, and inventing one would band every chart
    // back to the epoch.
    const [inserted] = await db
      .insert(appLiveness)
      .values({ firstSeenAt: new Date(nowMs), lastSeenAt: new Date(nowMs), stoppedAt: null })
      .returning({ id: appLiveness.id })
    state.rowId = inserted?.id ?? null
    state.reconciled = true
    state.lastWriteMs = nowMs
    log.info("App liveness ledger initialised — no gap recorded for first boot")
    return
  }

  state.rowId = row.id
  state.reconciled = true

  // The last instant we know data was being collected. A clean shutdown gives a
  // sharper answer than the throttled heartbeat stamp, so prefer it when it is
  // both newer than that stamp and not in the future.
  const lastSeenMs = row.lastSeenAt.getTime()
  const stoppedMs = row.stoppedAt?.getTime() ?? null
  const useStopped = stoppedMs !== null && stoppedMs >= lastSeenMs && stoppedMs <= nowMs
  const anchorMs = useStopped && stoppedMs !== null ? stoppedMs : lastSeenMs
  const reason: CoverageGapReason = useStopped ? "shutdown" : "unclean"

  const deltaMs = nowMs - anchorMs
  if (deltaMs < 0) {
    // The clock moved backwards (container restart plus an NTP correction is the
    // usual cause). A negative-length outage is not a thing; re-anchor silently.
    log.warn(
      { lastSeenAt: row.lastSeenAt.toISOString(), now: new Date(nowMs).toISOString() },
      "App liveness stamp is in the future — clock jumped backwards, no gap recorded"
    )
  } else if (deltaMs >= MIN_GAP_RECORD_MS) {
    await insertGap(anchorMs, nowMs, reason)
  }

  await writeLastSeen(state, nowMs)
}

async function runTouch(state: LivenessState, nowMs: number): Promise<void> {
  if (!state.reconciled) {
    await reconcile(state, nowMs)
    state.lastTouchMs = nowMs
    return
  }

  const prevTouchMs = state.lastTouchMs
  if (prevTouchMs === null) {
    await writeLastSeen(state, nowMs)
    state.lastTouchMs = nowMs
    return
  }

  const deltaMs = nowMs - prevTouchMs
  if (deltaMs < 0) {
    // Clock jumped backwards mid-process. Re-anchor, record nothing.
    state.lastTouchMs = nowMs
    return
  }

  if (deltaMs >= MIN_GAP_RECORD_MS) {
    // The process survived but stopped collecting for a while — a lockdown, a
    // restore, a suspended host. The chart hole is identical to a crash's, so it
    // gets a gap too.
    await insertGap(prevTouchMs, nowMs, "stalled")
    await writeLastSeen(state, nowMs)
  } else if (nowMs - (state.lastWriteMs ?? 0) >= LIVENESS_WRITE_THROTTLE_MS) {
    await writeLastSeen(state, nowMs)
  }

  state.lastTouchMs = nowMs
}

/**
 * Stamp "the app is collecting right now", and record any gap since the previous
 * stamp. Safe to call on every 5-second heartbeat tick: DB writes are throttled
 * internally and concurrent calls are coalesced.
 *
 * CALL SITE: the existing 5-second heartbeat cron in download-client-scheduler.ts,
 * immediately after `await flushCompletedBuckets()`. Without that one line this
 * ledger is never written and every app-downtime band silently fails to appear.
 *
 * @param nowMs injectable clock for tests; defaults to Date.now().
 */
export async function touchAppLiveness(nowMs: number = Date.now()): Promise<void> {
  const state = getState()
  if (state.inFlight) return state.inFlight

  const run = runTouch(state, nowMs)
    .catch((err) => {
      // Never let ledger bookkeeping break the heartbeat that carries it. A
      // failed touch means the next one records a slightly wider gap, which is
      // the safe direction.
      log.warn(err, "Failed to update app liveness ledger")
    })
    .finally(() => {
      state.inFlight = null
    })

  state.inFlight = run
  return run
}

/**
 * Mark a clean shutdown, so the gap that follows starts at the real stop instant
 * rather than up to LIVENESS_WRITE_THROTTLE_MS earlier, and is labelled
 * "shutdown" rather than "unclean".
 *
 * Entirely optional — reconciliation is correct without it. Intended for
 * stopClientScheduler(), which also runs on lockdown/password-change/restore, so
 * a later touch in the same process correctly records those as "stalled".
 */
export async function markAppStopped(nowMs: number = Date.now()): Promise<void> {
  const state = getState()
  try {
    const values = { lastSeenAt: new Date(nowMs), stoppedAt: new Date(nowMs) }
    if (state.rowId === null) {
      await db.update(appLiveness).set(values)
    } else {
      await db.update(appLiveness).set(values).where(eq(appLiveness.id, state.rowId))
    }
    state.lastTouchMs = nowMs
    // Force the next touch to write, so a stop that turns out not to be a
    // shutdown (lockdown, restore) clears the marker promptly.
    state.lastWriteMs = null
  } catch (err) {
    log.warn(err, "Failed to mark app stop in liveness ledger")
  }
}

/**
 * [firstSeenAt, lastSeenAt]: the span the ledger can speak for at all. null
 * when it has never been written, in which case the caller must treat the entire
 * range as UNKNOWN and draw nothing.
 */
export async function getAppCoverage(): Promise<{ start: number; end: number } | null> {
  const [row] = await db
    .select({ firstSeenAt: appLiveness.firstSeenAt, lastSeenAt: appLiveness.lastSeenAt })
    .from(appLiveness)
    .orderBy(asc(appLiveness.id))
    .limit(1)
  if (!row) return null
  return { start: row.firstSeenAt.getTime(), end: row.lastSeenAt.getTime() }
}

/** Recorded gaps overlapping [fromMs, toMs], oldest first. */
export async function getCoverageGaps(fromMs: number, toMs: number): Promise<CoverageGap[]> {
  const rows = await db
    .select({
      startedAt: appCoverageGaps.startedAt,
      endedAt: appCoverageGaps.endedAt,
      reason: appCoverageGaps.reason,
    })
    .from(appCoverageGaps)
    .where(
      and(
        gte(appCoverageGaps.endedAt, new Date(fromMs)),
        lte(appCoverageGaps.startedAt, new Date(toMs))
      )
    )
    .orderBy(asc(appCoverageGaps.startedAt))

  return rows.map((r) => ({
    start: r.startedAt.getTime(),
    end: r.endedAt.getTime(),
    reason: r.reason,
  }))
}

/**
 * Expire coverage gaps on the SAME horizon as the snapshots they explain.
 *
 * Takes `retentionDays` rather than a cutoff so it matches pruneOldSnapshots /
 * pruneOldCheckpoints exactly — same argument, same arithmetic, same call site.
 * See the comment at that call site in tracker-scheduler.ts for why the coupling
 * is load-bearing.
 *
 * The predicate is `endedAt < cutoff`, NOT `startedAt < cutoff`: a gap that
 * began before the horizon but ended inside it still explains chart data that
 * survives, and deleting it would prune explanations more aggressively than the
 * snapshots they belong to — the exact drift this coupling exists to prevent.
 */
export async function pruneCoverageGaps(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(appCoverageGaps)
    .where(lt(appCoverageGaps.endedAt, cutoff))
    .returning({ id: appCoverageGaps.id })
  return deleted.length
}
