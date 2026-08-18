// src/lib/outages.ts
//
// Pure interval math for outage bands. The shaded regions drawn behind
// time-series charts explain a flat or empty stretch.
//
// This module has NO imports. Not the DB, not the logger, not uptime.ts (which
// pulls in the DB). Everything is epoch milliseconds, so no date-string handling
// and no timezone questions arise. That is what makes it exhaustively testable.
//
// The three-state rule
// A region of the chart is in exactly one of three states, and only two of them
// draw anything:
//
//   APP DOWN: a RECORDED coverage gap (app_coverage_gaps). Positive evidence.
//   QBT DOWN: a bucket with ok === 0 && fail > 0. Positive evidence, and
//             self-certifying (the app had to be alive to observe the failure).
//   UNKNOWN: everything else. NO band. Ever.
//
// Absence of evidence is UNKNOWN, never "healthy" and never "down". A missing
// uptime bucket does not mean qBittorrent was down. It means nothing observed
// it. Downtime is measured and written down; it is never reconstructed from
// missing rows. Gap-inference was evaluated and rejected: buckets cascade-delete
// with their client, do not exist before the uptime feature was instrumented, are
// absent entirely when no client is configured, and are lost on every clean stop
// by the un-awaited flush in stopClientScheduler. Every one of those would hatch
// a fake outage.
//
// Inside an app gap, qBittorrent's state is UNKNOWN. Not up, not down, because
// nothing was running that could look. qBT bands are therefore interval-SUBTRACTED
// against app gaps: where both would apply, only the app band survives. It
// means "no data was collected here", which is the honest single claim.
//
// Functions: computeOutageBands, bucketsToDownIntervals, mergeIntervals,
//            intersectIntervals, intersectAll, subtractIntervals, clampIntervals,
//            filterMinDuration, floorToBucketMs

/** Width of one client_uptime_buckets row. Mirrors BUCKET_MS in uptime.ts. */
export const BUCKET_MS = 5 * 60 * 1000

/**
 * Shortest outage worth drawing. Deliberately the same number as the shortest
 * gap worth recording (app-liveness.ts imports this as its record floor).
 * Owner's decision: "hide under ~5 minutes". A single fully-failed bucket is
 * exactly 5 minutes and therefore does draw.
 */
export const MIN_BAND_MS = 5 * 60 * 1000

/** A half-open [start, end) span in epoch milliseconds. */
export interface Interval {
  start: number
  end: number
}

/** One client_uptime_buckets row, with bucketTs already reduced to epoch ms. */
export interface UptimeBucket {
  bucketTs: number
  ok: number
  fail: number
}

export interface ClientBuckets {
  clientId: number
  buckets: UptimeBucket[]
}

export interface BandInput {
  /** The visible chart range. Bands are cropped to it as the very last step. */
  window: Interval
  /** Recorded app coverage gaps. Closed, already-ended outages only. */
  appGaps: Interval[]
  /**
   * Every ENABLED download client, including ones with zero buckets in range.
   * A client that was never observed must still force the fleet-wide
   * intersection empty rather than being silently skipped.
   */
  clients: ClientBuckets[]
  /**
   * [firstSeenAt, lastSeenAt] from app_liveness. The span over which the app
   * ledger can speak at all. null when the ledger has never been written, in
   * which case the whole range is UNKNOWN for app bands.
   */
  appCoverage: Interval | null
  /**
   * [max(firstSeenAt, earliest bucket), end of the last FLUSHED bucket]. The
   * span over which uptime buckets can speak. Excludes the in-flight bucket, so
   * the open present is never banded. null when nothing has been observed.
   */
  qbtCoverage: Interval | null
}

export interface ClientOutage {
  clientId: number
  intervals: Interval[]
}

export interface OutageBands {
  /** App-down bands. Drawn on every polled-history chart. */
  app: Interval[]
  /** Fleet-wide qBT-down bands: every enabled client down at once. */
  allDown: Interval[]
  /** Per-client qBT-down bands, same pipeline applied individually. */
  perClient: ClientOutage[]
  /** What each layer could observe. Outside it, the chart must render nothing. */
  coverage: {
    app: Interval | null
    qbt: Interval | null
  }
}

/** Floor an epoch-ms instant to its 5-minute bucket boundary. */
export function floorToBucketMs(ms: number): number {
  return ms - ((ms % BUCKET_MS) + BUCKET_MS) % BUCKET_MS
}

function isUsable(i: Interval): boolean {
  return (
    Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start
  )
}

/**
 * Sort, drop empty/invalid spans, and coalesce anything that overlaps or merely
 * touches. Adjacency counts as overlap: two consecutive 5-minute down buckets
 * are one 10-minute outage, not two.
 */
export function mergeIntervals(list: Interval[]): Interval[] {
  const usable = list.filter(isUsable).sort((a, b) => a.start - b.start)
  const out: Interval[] = []
  for (const cur of usable) {
    const last = out[out.length - 1]
    if (last && cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end
    } else {
      out.push({ start: cur.start, end: cur.end })
    }
  }
  return out
}

/** Overlapping portions of two interval lists. Both are merged first. */
export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const left = mergeIntervals(a)
  const right = mergeIntervals(b)
  const out: Interval[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    const start = Math.max(left[i].start, right[j].start)
    const end = Math.min(left[i].end, right[j].end)
    if (end > start) out.push({ start, end })
    if (left[i].end < right[j].end) i++
    else j++
  }
  return out
}

/**
 * Intersection across every list. An EMPTY outer list yields nothing rather than
 * everything: with zero enabled clients nothing was collecting, so nothing is
 * known, so nothing is drawn.
 */
export function intersectAll(lists: Interval[][]): Interval[] {
  if (lists.length === 0) return []
  let acc = mergeIntervals(lists[0])
  for (let k = 1; k < lists.length; k++) {
    if (acc.length === 0) return []
    acc = intersectIntervals(acc, lists[k])
  }
  return acc
}

/** base minus cut. Used to remove app gaps from qBT evidence. */
export function subtractIntervals(base: Interval[], cut: Interval[]): Interval[] {
  const holes = mergeIntervals(cut)
  const out: Interval[] = []
  for (const span of mergeIntervals(base)) {
    let cursor = span.start
    for (const hole of holes) {
      if (hole.end <= cursor) continue
      if (hole.start >= span.end) break
      if (hole.start > cursor) out.push({ start: cursor, end: hole.start })
      cursor = Math.max(cursor, hole.end)
      if (cursor >= span.end) break
    }
    if (cursor < span.end) out.push({ start: cursor, end: span.end })
  }
  return out
}

/** Crop every interval to `bound`, dropping anything wholly outside it. */
export function clampIntervals(list: Interval[], bound: Interval): Interval[] {
  const out: Interval[] = []
  for (const i of mergeIntervals(list)) {
    const start = Math.max(i.start, bound.start)
    const end = Math.min(i.end, bound.end)
    if (end > start) out.push({ start, end })
  }
  return out
}

/** Drop bands shorter than `minMs`. */
export function filterMinDuration(list: Interval[], minMs: number): Interval[] {
  return list.filter((i) => i.end - i.start >= minMs)
}

/**
 * Down spans implied by a client's buckets. POSITIVE EVIDENCE ONLY.
 *
 *   ok === 0 && fail > 0: down for that whole bucket
 *   ok > 0 && fail > 0: degraded, NOT down. No band.
 *   ok > 0 && fail === 0: up
 *   no bucket at all: UNKNOWN. No band, ever.
 */
export function bucketsToDownIntervals(buckets: UptimeBucket[]): Interval[] {
  const down: Interval[] = []
  for (const b of buckets) {
    if (b.ok === 0 && b.fail > 0) {
      down.push({ start: b.bucketTs, end: b.bucketTs + BUCKET_MS })
    }
  }
  return mergeIntervals(down)
}

/**
 * Shared tail of every band pipeline. The ORDER is load-bearing:
 *
 *   1. clamp to coverage. Beyond what we could observe, we say nothing.
 *   2. filter by minimum duration. "Is this outage worth drawing?" is decided
 *      on the outage's TRUE length, before the window crops it.
 *   3. crop to the visible window. Visibility only.
 *
 * Filtering after the window crop would silently swallow a multi-hour outage
 * whose visible sliver happens to be four minutes wide, which is precisely the
 * region a user scrolls to when asking "why is this flat?".
 */
function finishBands(
  raw: Interval[],
  coverage: Interval | null,
  window: Interval
): Interval[] {
  if (!coverage || !isUsable(coverage)) return []
  const covered = clampIntervals(raw, coverage)
  const worthDrawing = filterMinDuration(covered, MIN_BAND_MS)
  return clampIntervals(worthDrawing, window)
}

/**
 * Turn recorded evidence into the bands a chart should draw.
 *
 * Deterministic and side-effect free: every clamp bound is an input, so the
 * retention/coverage POLICY lives in the caller and only the MATH lives here.
 */
export function computeOutageBands(input: BandInput): OutageBands {
  const { window, appGaps, clients, appCoverage, qbtCoverage } = input

  if (!isUsable(window)) {
    return { app: [], allDown: [], perClient: [], coverage: { app: null, qbt: null } }
  }

  // App gaps are already positive evidence; merge and clamp to what the ledger
  // can speak for. Note they are NOT gated on bucket existence. An install with
  // no download client still has tracker charts, and they still deserve bands.
  const appMerged = mergeIntervals(appGaps)
  const app = finishBands(appMerged, appCoverage, window)

  // The three-state rule. Subtract BEFORE clamping/filtering so an app gap that
  // swallows a qBT outage removes it entirely rather than leaving a sliver.
  const perClientRaw = clients.map((c) => ({
    clientId: c.clientId,
    down: subtractIntervals(bucketsToDownIntervals(c.buckets), appMerged),
  }))

  const perClient: ClientOutage[] = perClientRaw.map((c) => ({
    clientId: c.clientId,
    intervals: finishBands(c.down, qbtCoverage, window),
  }))

  // Fleet-wide bands mean "nothing was collecting", so this is the INTERSECTION
  // across enabled clients, never the union. One of two clients being down still
  // collected half the data; banding that would hatch data that does exist.
  const allDown = finishBands(
    intersectAll(perClientRaw.map((c) => c.down)),
    qbtCoverage,
    window
  )

  return {
    app,
    allDown,
    perClient,
    coverage: {
      app: appCoverage && isUsable(appCoverage) ? clipCoverage(appCoverage, window) : null,
      qbt: qbtCoverage && isUsable(qbtCoverage) ? clipCoverage(qbtCoverage, window) : null,
    },
  }
}

/**
 * The observed span as it applies to this window. null when the window lies
 * entirely outside it. The chart then renders that whole range as UNKNOWN
 * (blank) rather than assuming health.
 */
function clipCoverage(coverage: Interval, window: Interval): Interval | null {
  const start = Math.max(coverage.start, window.start)
  const end = Math.min(coverage.end, window.end)
  return end > start ? { start, end } : null
}
