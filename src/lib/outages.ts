// src/lib/outages.ts
//
// Math for outage bands
//
// A region of the chart is in one of three states, and only two of them
// draw anything:
//
//   APP DOWN: a RECORDED coverage gap (app_coverage_gaps). Positive evidence.
//   QBT DOWN: a bucket with ok === 0 && fail > 0. Positive evidence, and
//             self-certifying (the app had to be alive to observe the failure).
//   TRACKER DOWN: a RECORDED tracker_outages row for the tracker this chart is
//             about. Positive evidence, and self-certifying for the same reason
//             — the poller had to run to observe the failure. Requested only by
//             a single-tracker page, because a full-height band on a chart of
//             many trackers would claim all of them were down.
//   UNKNOWN: everything else (no band)
//
// Absence of evidence is UNKNOWN, never "healthy" and never "down". A missing
// uptime bucket does not mean qBittorrent was down Downtime is measured and written down; it is never reconstructed from missing rows.
//
// Inside an app gap, qBittorrent's state is UNKNOWN. Not up, not down, because
// nothing was running that could look. qBT bands are therefore interval-SUBTRACTED
// against app gaps: where both would apply, only the app band survives. It
// means "no data was collected here", which is the honest single claim.
//
// A tracker's state inside an app gap is UNKNOWN for exactly the same reason, so
// tracker bands are subtracted against app gaps by the same operation. This is
// what "app outage always wins" means mechanically: not a z-order or a colour
// precedence, but the narrower claim being removed from the range where nothing
// could observe it.
//
// Functions: computeOutageBands, bucketsToDownIntervals, mergeIntervals,
//            intersectIntervals, intersectAll, subtractIntervals, clampIntervals,
//            filterMinDuration, floorToBucketMs

export const BUCKET_MS = 5 * 60 * 1000

// Shortest outage worth drawing

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
   * Recorded outages for the ONE tracker this chart is about, or [] on any chart
   * that is not scoped to a single tracker. Already-ended, positive evidence
   * only — see the header of tracker-outages.ts for why these are never widened
   * toward the surrounding successful polls.
   */
  trackerOutages: Interval[]
  /**
   * [firstSeenAt, lastSeenAt] from app_liveness. The span over which the app
   * ledger can speak at all. null when the ledger has never been written, in
   * which case the whole range is unknwown for app bands.
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
  /** Bands for the single tracker the request was scoped to. Empty otherwise. */
  tracker: Interval[]
  /** Per-client qBT-down bands, same pipeline applied individually. */
  perClient: ClientOutage[]
  /** What each layer could observe. Outside it, the chart must render nothing. */
  coverage: {
    app: Interval | null
    qbt: Interval | null
  }
}

/** Floor an epoch-ms instant to 5-minutes */
export function floorToBucketMs(ms: number): number {
  return ms - (((ms % BUCKET_MS) + BUCKET_MS) % BUCKET_MS)
}

function isUsable(i: Interval): boolean {
  return Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start
}

/**
 * Sort, drop empty/invalid spans, and coalesce anything that overlaps
 * touches
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
 * Intersection across every list. An empty outer list yields nothing rather than
 * everything, so with zero enabled clients nothing was collecting, so nothing is
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

/** Used to remove app gaps from qBT evidence. */
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

/** Crop every interval to `bound`, dropping anything outside it. */
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
 * Down spans implied by a client's buckets
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
 * Shared tail of every band pipeline
 *
 *   1. clamp to coverage to what is observable
 *   2. Decide if it's worth it to record it
 *   3. crop to the visible window
 *
 * Filtering after the window crop would silently swallow a multi-hour outage
 * whose visible sliver happens to be four minutes wide, which is precisely the
 * region a user scrolls to when asking "why is this flat?".
 */
function finishBands(raw: Interval[], coverage: Interval | null, window: Interval): Interval[] {
  if (!coverage || !isUsable(coverage)) return []
  const covered = clampIntervals(raw, coverage)
  const worthDrawing = filterMinDuration(covered, MIN_BAND_MS)
  return clampIntervals(worthDrawing, window)
}

/**
 * Turn recorded evidence into the bands a chart should draw.

 */
export function computeOutageBands(input: BandInput): OutageBands {
  const { window, appGaps, clients, trackerOutages, appCoverage, qbtCoverage } = input

  if (!isUsable(window)) {
    return {
      app: [],
      allDown: [],
      tracker: [],
      perClient: [],
      coverage: { app: null, qbt: null },
    }
  }

  // An install with no download client still has tracker charts, and they still deserve bands
  const appMerged = mergeIntervals(appGaps)
  const app = finishBands(appMerged, appCoverage, window)

  // Tracker bands run the SAME pipeline as qBT bands and for the same reason:
  // inside an app gap nothing was polling, so the tracker's reachability was not
  // observed and the narrower claim must give way. Subtracting before the clamp
  // and the minimum-duration filter means an app gap that swallows a tracker
  // outage removes it entirely instead of leaving an unexplained sliver.
  //
  // Clamped to appCoverage, not to a coverage span of its own: the app's poller
  // is the only thing that ever observed this tracker, so what the app ledger can
  // speak for is exactly what these rows can speak for.
  const tracker = finishBands(subtractIntervals(trackerOutages, appMerged), appCoverage, window)

  // Subtract before clamping/filtering
  const perClientRaw = clients.map((c) => ({
    clientId: c.clientId,
    down: subtractIntervals(bucketsToDownIntervals(c.buckets), appMerged),
  }))

  const perClient: ClientOutage[] = perClientRaw.map((c) => ({
    clientId: c.clientId,
    intervals: finishBands(c.down, qbtCoverage, window),
  }))

  // Fleet-wide bands mean "nothing was collecting", so this is the intersection
  // across enabled clients.
  const allDown = finishBands(intersectAll(perClientRaw.map((c) => c.down)), qbtCoverage, window)

  return {
    app,
    allDown,
    tracker,
    perClient,
    coverage: {
      app: appCoverage && isUsable(appCoverage) ? clipCoverage(appCoverage, window) : null,
      qbt: qbtCoverage && isUsable(qbtCoverage) ? clipCoverage(qbtCoverage, window) : null,
    },
  }
}

/**
 * The observed span as it applies to this window
 */
function clipCoverage(coverage: Interval, window: Interval): Interval | null {
  const start = Math.max(coverage.start, window.start)
  const end = Math.min(coverage.end, window.end)
  return end > start ? { start, end } : null
}
