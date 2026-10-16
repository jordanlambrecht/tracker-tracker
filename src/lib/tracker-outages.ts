// src/lib/tracker-outages.ts
//
// The per-tracker connectability ledger
//
// Functions: recordTrackerPollFailure, getTrackerOutages, pruneTrackerOutages,
//            trackerOutageStitchWindowMs

import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { appSettings, trackerOutages } from "@/lib/db/schema"
import { POLL_INTERVAL_DEFAULT } from "@/lib/limits"
import { log } from "@/lib/logger"

/** Values of tracker_outages.reason. Diagnostic only, all draw identically. */
export type TrackerOutageReason = "poll" | "manual"

export interface TrackerOutage {
  start: number
  end: number
  reason: string
}

/**
 * How many poll intervals may separate two failures before they count as
 * seperate outages
 */
export const OUTAGE_STITCH_INTERVALS = 2
export const OUTAGE_STITCH_TOLERANCE_MS = 60_000

/** Longest silence between two failures that still counts as one outage. */
export function trackerOutageStitchWindowMs(pollIntervalMinutes: number): number {
  return pollIntervalMinutes * 60_000 * OUTAGE_STITCH_INTERVALS + OUTAGE_STITCH_TOLERANCE_MS
}

async function readPollIntervalMinutes(): Promise<number> {
  const [row] = await db
    .select({ trackerPollIntervalMinutes: appSettings.trackerPollIntervalMinutes })
    .from(appSettings)
    .limit(1)
  const configured = row?.trackerPollIntervalMinutes
  return typeof configured === "number" && configured > 0 ? configured : POLL_INTERVAL_DEFAULT
}

async function runRecord(
  trackerId: number,
  reason: TrackerOutageReason,
  nowMs: number
): Promise<void> {
  const stitchMs = trackerOutageStitchWindowMs(await readPollIntervalMinutes())

  // Ignoring rows that claim to end in the future makes the newest usable row
  // the stitch candidate, so recording resumes on the very next failure.
  const [latest] = await db
    .select({ id: trackerOutages.id, endedAt: trackerOutages.endedAt })
    .from(trackerOutages)
    .where(
      and(eq(trackerOutages.trackerId, trackerId), lte(trackerOutages.endedAt, new Date(nowMs)))
    )
    .orderBy(desc(trackerOutages.endedAt))
    .limit(1)

  if (latest) {
    const endMs = latest.endedAt.getTime()
    const sinceMs = nowMs - endMs
    // The query above already guarantees sinceMs >= 0; this keeps that true at
    // the point of use, so removing the clamp can never silently reintroduce a
    // backwards endedAt.
    if (sinceMs >= 0 && sinceMs <= stitchMs) {
      await db
        .update(trackerOutages)
        .set({ endedAt: new Date(nowMs) })
        .where(eq(trackerOutages.id, latest.id))
      return
    }
  }

  // A brand-new outage is zero-length. The next failure inside the stitch window extends it,
  // and anything still shorter than MIN_BAND_MS is dropped at render time
  await db.insert(trackerOutages).values({
    trackerId,
    startedAt: new Date(nowMs),
    endedAt: new Date(nowMs),
    reason,
  })
  log.info({ trackerId, reason }, "Opened tracker outage")
}

/**
 * Record one observed poll failure for `trackerId`, extending the tracker's
 * current outage or opening a new one.
 *
 * @param nowMs injectable clock for tests; defaults to Date.now().
 */
export async function recordTrackerPollFailure(
  trackerId: number,
  reason: TrackerOutageReason,
  nowMs: number = Date.now()
): Promise<void> {
  try {
    await runRecord(trackerId, reason, nowMs)
  } catch (err) {
    log.warn({ trackerId, err }, "Failed to record tracker outage")
  }
}

/** Recorded outages for one tracker overlapping  */
export async function getTrackerOutages(
  trackerId: number,
  fromMs: number,
  toMs: number
): Promise<TrackerOutage[]> {
  const rows = await db
    .select({
      startedAt: trackerOutages.startedAt,
      endedAt: trackerOutages.endedAt,
      reason: trackerOutages.reason,
    })
    .from(trackerOutages)
    .where(
      and(
        eq(trackerOutages.trackerId, trackerId),
        gte(trackerOutages.endedAt, new Date(fromMs)),
        lte(trackerOutages.startedAt, new Date(toMs))
      )
    )
    .orderBy(asc(trackerOutages.startedAt))

  return rows.map((r) => ({
    start: r.startedAt.getTime(),
    end: r.endedAt.getTime(),
    reason: r.reason,
  }))
}

/**
 * Expire tracker outages on the same snapshots
 *
 */
export async function pruneTrackerOutages(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(trackerOutages)
    .where(lt(trackerOutages.endedAt, cutoff))
    .returning({ id: trackerOutages.id })
  return deleted.length
}
