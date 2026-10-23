// src/lib/today.ts
//
// Functions: computeTodayAtAGlance, backfillTrackerCheckpoints

import "server-only"

import { and, eq, gte, inArray, lt, sql } from "drizzle-orm"
import { compareBigIntDesc, isUnixTimestampOnDate } from "@/lib/data-transforms"
import { db } from "@/lib/db"
import {
  downloadClients,
  torrentDailyCheckpoints,
  trackerDailyCheckpoints,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { parseCachedTorrents } from "@/lib/download-clients"
import { localDateStr } from "@/lib/formatters"
import { log } from "@/lib/logger"
import { resolveTorrentTracker } from "@/lib/tracker-matching"
import type { TodayAtAGlance } from "@/types/api"

interface TrackerDelta {
  id: number
  name: string
  color: string | null
  uploadDelta: bigint
  downloadDelta: bigint
  bufferDelta: bigint
  ratioChange: number
  seedbonusChange: number
}

function zeroDelta(tracker: { id: number; name: string; color: string | null }): TrackerDelta {
  return {
    id: tracker.id,
    name: tracker.name,
    color: tracker.color ?? null,
    uploadDelta: 0n,
    downloadDelta: 0n,
    bufferDelta: 0n,
    ratioChange: 0,
    seedbonusChange: 0,
  }
}

/** The figures a day is measured between: two snapshots, or two daily checkpoints. */
interface Reading {
  uploaded: bigint
  downloaded: bigint
  buffer: bigint | null
  ratio: number | null
  seedbonus: number | null
}

/**
 * The calendar date `days` away from a YYYY-MM-DD date. Steps whole dates, so a
 * 23- or 25-hour day around a daylight-saving change cannot skip or repeat one.
 */
function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

interface TorrentMover {
  hash: string
  name: string
  qbtTag: string | null
  trackerColor: string | null
  clientName: string | null
  uploadedToday: bigint
  downloadedToday: bigint
}

function snapshotReading(snap: {
  uploadedBytes: bigint
  downloadedBytes: bigint
  bufferBytes: bigint | null
  ratio: number | null
  seedbonus: number | null
}): Reading {
  return {
    uploaded: snap.uploadedBytes,
    downloaded: snap.downloadedBytes,
    buffer: snap.bufferBytes,
    ratio: snap.ratio,
    seedbonus: snap.seedbonus,
  }
}

function checkpointReading(cp: {
  uploadedBytesEnd: bigint
  downloadedBytesEnd: bigint
  bufferBytesEnd: bigint | null
  ratioEnd: number | null
  seedbonusEnd: number | null
}): Reading {
  return {
    uploaded: cp.uploadedBytesEnd,
    downloaded: cp.downloadedBytesEnd,
    buffer: cp.bufferBytesEnd,
    ratio: cp.ratioEnd,
    seedbonus: cp.seedbonusEnd,
  }
}

/**
 * Computes the entire TodayAtAGlance payload for today, or for yesterday.
 * Fetches all required data in parallel where possible, then aggregates
 * fleet-level deltas, yesterday comparisons, torrent movers, and activity counts.
 */
export async function computeTodayAtAGlance(
  day: "today" | "yesterday" = "today"
): Promise<TodayAtAGlance> {
  // ── Date boundaries (local timezone) ──────────────────────────────────────
  const currentStr = localDateStr()
  // The day being summarised, and for yesterday the day after it
  const todayStr = day === "yesterday" ? shiftDate(currentStr, -1) : currentStr
  const nextDayStr = day === "yesterday" ? currentStr : null
  const todayStart = new Date(`${todayStr}T00:00:00`)
  const nextDayStart = nextDayStr ? new Date(`${nextDayStr}T00:00:00`) : null
  // The two days before it, for the comparison
  const yesterdayStr = shiftDate(todayStr, -1)
  const dayBeforeStr = shiftDate(todayStr, -2)

  // ── Parallel data fetches ─────────────────────────────────────────────────
  const [allTrackers, todaySnapshots, checkpointRows, torrentCps, clients] = await Promise.all([
    db
      .select({
        id: trackers.id,
        name: trackers.name,
        color: trackers.color,
        qbtTag: trackers.qbtTag,
        baseUrl: trackers.baseUrl,
      })
      .from(trackers)
      .where(eq(trackers.isActive, true)),

    db
      .select({
        trackerId: trackerSnapshots.trackerId,
        polledAt: trackerSnapshots.polledAt,
        uploadedBytes: trackerSnapshots.uploadedBytes,
        downloadedBytes: trackerSnapshots.downloadedBytes,
        bufferBytes: trackerSnapshots.bufferBytes,
        ratio: trackerSnapshots.ratio,
        seedbonus: trackerSnapshots.seedbonus,
      })
      .from(trackerSnapshots)
      .where(
        nextDayStart
          ? and(
              gte(trackerSnapshots.polledAt, todayStart),
              lt(trackerSnapshots.polledAt, nextDayStart)
            )
          : gte(trackerSnapshots.polledAt, todayStart)
      )
      .orderBy(trackerSnapshots.polledAt),

    db
      .select({
        trackerId: trackerDailyCheckpoints.trackerId,
        checkpointDate: trackerDailyCheckpoints.checkpointDate,
        uploadedBytesEnd: trackerDailyCheckpoints.uploadedBytesEnd,
        downloadedBytesEnd: trackerDailyCheckpoints.downloadedBytesEnd,
        bufferBytesEnd: trackerDailyCheckpoints.bufferBytesEnd,
        ratioEnd: trackerDailyCheckpoints.ratioEnd,
        seedbonusEnd: trackerDailyCheckpoints.seedbonusEnd,
      })
      .from(trackerDailyCheckpoints)
      .where(
        inArray(
          trackerDailyCheckpoints.checkpointDate,
          // A past day's own figures come from its checkpoint too
          nextDayStr ? [todayStr, yesterdayStr, dayBeforeStr] : [yesterdayStr, dayBeforeStr]
        )
      ),

    db
      .select({
        clientId: torrentDailyCheckpoints.clientId,
        hash: torrentDailyCheckpoints.hash,
        checkpointDate: torrentDailyCheckpoints.checkpointDate,
        uploadedStart: torrentDailyCheckpoints.uploadedStart,
        downloadedStart: torrentDailyCheckpoints.downloadedStart,
      })
      .from(torrentDailyCheckpoints)
      .where(
        nextDayStr
          ? inArray(torrentDailyCheckpoints.checkpointDate, [todayStr, nextDayStr])
          : eq(torrentDailyCheckpoints.checkpointDate, todayStr)
      ),

    db
      .select({
        id: downloadClients.id,
        name: downloadClients.name,
        cachedTorrents: downloadClients.cachedTorrents,
        cachedTorrentsAt: downloadClients.cachedTorrentsAt,
      })
      .from(downloadClients)
      .where(eq(downloadClients.enabled, true)),
  ])

  const yesterdayCheckpoints = checkpointRows.filter((r) => r.checkpointDate === yesterdayStr)
  const dayBeforeCheckpoints = checkpointRows.filter((r) => r.checkpointDate === dayBeforeStr)

  // ── Per-tracker deltas ─────────────────────────────────────────────────────

  // Today runs from the first snapshot to the latest. A past day runs from the
  // day before's checkpoint to its own, the same basis as its comparison.
  const spans = new Map<number, [Reading, Reading]>()
  if (nextDayStr) {
    const startByTracker = new Map(yesterdayCheckpoints.map((cp) => [cp.trackerId, cp]))
    for (const end of checkpointRows) {
      const start = startByTracker.get(end.trackerId)
      if (end.checkpointDate !== todayStr || !start) continue
      spans.set(end.trackerId, [checkpointReading(start), checkpointReading(end)])
    }
  } else {
    const snapshotsByTracker = new Map<number, (typeof todaySnapshots)[number][]>()
    for (const snap of todaySnapshots) {
      const bucket = snapshotsByTracker.get(snap.trackerId) ?? []
      bucket.push(snap)
      snapshotsByTracker.set(snap.trackerId, bucket)
    }
    for (const [trackerId, snaps] of snapshotsByTracker) {
      if (snaps.length < 2) continue
      spans.set(trackerId, [snapshotReading(snaps[0]), snapshotReading(snaps[snaps.length - 1])])
    }
  }

  const trackerDeltas: TrackerDelta[] = []

  for (const tracker of allTrackers) {
    const span = spans.get(tracker.id)

    if (!span) {
      trackerDeltas.push(zeroDelta(tracker))
      continue
    }

    const [earliest, latest] = span

    try {
      const uploadDelta = BigInt(latest.uploaded) - BigInt(earliest.uploaded)
      const downloadDelta = BigInt(latest.downloaded) - BigInt(earliest.downloaded)

      const latestBuffer = latest.buffer ?? 0n
      const earliestBuffer = earliest.buffer ?? 0n
      const bufferDelta = BigInt(latestBuffer) - BigInt(earliestBuffer)

      const ratioChange = (latest.ratio ?? 0) - (earliest.ratio ?? 0)
      // Only readings that carry a bonus count, so a tracker that starts
      // reporting one partway through the day does not book its whole balance.
      const bonuses = snaps.map((s) => s.seedbonus).filter((v): v is number => v != null)
      const seedbonusChange = bonuses.length >= 2 ? bonuses[bonuses.length - 1] - bonuses[0] : 0

      trackerDeltas.push({
        id: tracker.id,
        name: tracker.name,
        color: tracker.color ?? null,
        uploadDelta,
        downloadDelta,
        bufferDelta,
        ratioChange,
        seedbonusChange,
      })
    } catch (err) {
      log.warn(err, "BigInt conversion failed for tracker %d", tracker.id)
      trackerDeltas.push(zeroDelta(tracker))
    }
  }

  // ── Fleet aggregation ──────────────────────────────────────────────────────

  let fleetUploadDelta = 0n
  let fleetDownloadDelta = 0n
  let fleetBufferDelta = 0n
  let fleetSeedbonusChange = 0

  // Weighted average of ratio change: sum(ratioChange * uploadDelta) / sum(uploadDelta)
  let weightedRatioSum = 0
  let totalUploadWeight = 0n

  for (const delta of trackerDeltas) {
    fleetUploadDelta += delta.uploadDelta
    fleetDownloadDelta += delta.downloadDelta
    fleetBufferDelta += delta.bufferDelta
    fleetSeedbonusChange += delta.seedbonusChange

    // An account infinite at either end of the day has no finite ratio change,
    // and one NaN or Infinity would void the whole fleet figure.
    if (delta.uploadDelta > 0n && Number.isFinite(delta.ratioChange)) {
      // NOTE: Number(delta.uploadDelta) can lose precision when uploadDelta
      // exceeds Number.MAX_SAFE_INTEGER (~8 PiB). For realistic tracker upload
      // volumes this is unlikely, but a full bigint weighted-average refactor
      // would eliminate this limitation if ever needed.
      const weight = Number(delta.uploadDelta)
      weightedRatioSum += delta.ratioChange * weight
      totalUploadWeight += delta.uploadDelta
    }
  }

  const fleetRatioChange =
    totalUploadWeight > 0n ? weightedRatioSum / Number(totalUploadWeight) : null

  // ── Yesterday comparison from checkpoint tables ────────────────────────────

  const yesterdayByTracker = new Map(yesterdayCheckpoints.map((cp) => [cp.trackerId, cp]))
  const dayBeforeByTracker = new Map(dayBeforeCheckpoints.map((cp) => [cp.trackerId, cp]))

  let yesterdayFleetUpload: bigint | null = null
  let yesterdayFleetDownload: bigint | null = null
  let yesterdayFleetBuffer: bigint | null = null

  for (const tracker of allTrackers) {
    const yesterday = yesterdayByTracker.get(tracker.id)
    const dayBefore = dayBeforeByTracker.get(tracker.id)

    if (!yesterday || !dayBefore) continue

    try {
      const trackerUploadYesterday =
        BigInt(yesterday.uploadedBytesEnd) - BigInt(dayBefore.uploadedBytesEnd)
      const trackerDownloadYesterday =
        BigInt(yesterday.downloadedBytesEnd) - BigInt(dayBefore.downloadedBytesEnd)

      const yesterdayBuffer = yesterday.bufferBytesEnd ?? 0n
      const dayBeforeBuffer = dayBefore.bufferBytesEnd ?? 0n
      const trackerBufferYesterday = BigInt(yesterdayBuffer) - BigInt(dayBeforeBuffer)

      yesterdayFleetUpload = (yesterdayFleetUpload ?? 0n) + trackerUploadYesterday
      yesterdayFleetDownload = (yesterdayFleetDownload ?? 0n) + trackerDownloadYesterday
      yesterdayFleetBuffer = (yesterdayFleetBuffer ?? 0n) + trackerBufferYesterday
    } catch (err) {
      log.warn(err, "BigInt conversion failed for yesterday comparison, tracker %d", tracker.id)
    }
  }

  // ── Torrent movers ─────────────────────────────────────────────────────────

  // Build checkpoint lookups. A past day ends where the next day's checkpoint starts.
  const startCps = nextDayStr
    ? torrentCps.filter((cp) => cp.checkpointDate === todayStr)
    : torrentCps
  const cpByKey = new Map(startCps.map((cp) => [`${cp.clientId}:${cp.hash}`, cp]))
  const endByKey = new Map(
    torrentCps
      .filter((cp) => nextDayStr && cp.checkpointDate === nextDayStr)
      .map((cp) => [`${cp.clientId}:${cp.hash}`, cp])
  )

  const movers: TorrentMover[] = []
  let addedToday = 0
  let completedToday = 0
  // Torrents we saw but couldn't attribute to any tracker by tag or announce
  // URL. Reported so the UI can tell "no download client" apart from "client
  // connected but nothing matched". Identical otherwise (issue #157).
  let unmatchedTorrents = 0

  for (const client of clients) {
    const torrents = parseCachedTorrents(client.cachedTorrents)

    for (const torrent of torrents) {
      // Activity counts. addedAt and completedAt are unix timestamps (seconds)
      if (isUnixTimestampOnDate(torrent.addedAt, todayStr)) {
        addedToday++
      }
      if (torrent.completedAt !== -1 && isUnixTimestampOnDate(torrent.completedAt, todayStr)) {
        completedToday++
      }

      // Compare current uploaded/downloaded to today's checkpoint
      const key = `${client.id}:${torrent.hash}`
      const checkpoint = cpByKey.get(key)
      if (!checkpoint) continue
      const end = nextDayStr ? endByKey.get(key) : undefined
      if (nextDayStr && !end) continue

      let uploadedToday: bigint
      let downloadedToday: bigint
      try {
        uploadedToday =
          BigInt(end ? end.uploadedStart : torrent.uploaded) - BigInt(checkpoint.uploadedStart)
        downloadedToday =
          BigInt(end ? end.downloadedStart : torrent.downloaded) -
          BigInt(checkpoint.downloadedStart)
      } catch (err) {
        log.warn(err, "BigInt conversion failed for torrent %s", torrent.hash)
        continue
      }

      // Resolve by qBittorrent tag, falling back to the announce URL so users
      // who don't tag per-tracker still see their torrents (issue #152).
      const match = resolveTorrentTracker(torrent, allTrackers)
      if (!match) {
        unmatchedTorrents++
        continue
      }
      const matchedTag = match.matchedTag
      const matchedColor = match.tracker.color ?? null

      movers.push({
        hash: torrent.hash,
        name: torrent.name,
        qbtTag: matchedTag,
        trackerColor: matchedColor,
        clientName: client.name,
        uploadedToday,
        downloadedToday,
      })
    }
  }

  // Sort and take top 5 uploaders and downloaders
  const topUploaders = movers
    .filter((m) => m.uploadedToday > 0n)
    .sort((a, b) => compareBigIntDesc(a.uploadedToday, b.uploadedToday))
    .slice(0, 5)

  const topDownloaders = movers
    .filter((m) => m.downloadedToday > 0n)
    .sort((a, b) => compareBigIntDesc(a.downloadedToday, b.downloadedToday))
    .slice(0, 5)

  // ── Assemble and return ───────────────────────────────────────────────────

  const latestClientPoll = clients.reduce<Date | null>((latest, c) => {
    if (c.cachedTorrentsAt && (!latest || c.cachedTorrentsAt > latest)) return c.cachedTorrentsAt
    return latest
  }, null)

  return {
    fleet: {
      uploadDelta: fleetUploadDelta.toString(),
      downloadDelta: fleetDownloadDelta.toString(),
      bufferDelta: fleetBufferDelta.toString(),
      ratioChange: fleetRatioChange,
      seedbonusChange: fleetSeedbonusChange,
      uploadDeltaYesterday: yesterdayFleetUpload !== null ? yesterdayFleetUpload.toString() : null,
      downloadDeltaYesterday:
        yesterdayFleetDownload !== null ? yesterdayFleetDownload.toString() : null,
      bufferDeltaYesterday: yesterdayFleetBuffer !== null ? yesterdayFleetBuffer.toString() : null,
    },
    trackers: trackerDeltas.map((d) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      uploadDelta: d.uploadDelta.toString(),
      downloadDelta: d.downloadDelta.toString(),
      bufferDelta: d.bufferDelta.toString(),
    })),
    activity: {
      addedToday,
      completedToday,
    },
    movers: {
      clientCount: clients.length,
      unmatchedTorrents,
      topUploaders: topUploaders.map((t) => ({
        hash: t.hash,
        name: t.name,
        qbtTag: t.qbtTag,
        trackerColor: t.trackerColor,
        clientName: t.clientName,
        uploadedToday: t.uploadedToday.toString(),
      })),
      topDownloaders: topDownloaders.map((t) => ({
        hash: t.hash,
        name: t.name,
        qbtTag: t.qbtTag,
        trackerColor: t.trackerColor,
        clientName: t.clientName,
        downloadedToday: t.downloadedToday.toString(),
      })),
    },
    trackerLastUpdated:
      todaySnapshots.length > 0
        ? todaySnapshots[todaySnapshots.length - 1].polledAt.toISOString()
        : null,
    clientLastUpdated: nextDayStr ? null : (latestClientPoll?.toISOString() ?? null),
  }
}

// ── Backfill ───────────────────────────────────────────────────

/**
 * One-time backfill: populates trackerDailyCheckpoints from existing trackerSnapshots.
 * Should be called once when the checkpoint table is empty but snapshot data exists.
 */
export async function backfillTrackerCheckpoints(): Promise<number> {
  // Check if backfill is needed
  const [existing] = await db
    .select({ id: trackerDailyCheckpoints.id })
    .from(trackerDailyCheckpoints)
    .limit(1)

  if (existing) return 0 // Already has data, skip

  // Check if there are snapshots to backfill from
  const [hasSnapshots] = await db
    .select({ id: trackerSnapshots.id })
    .from(trackerSnapshots)
    .limit(1)

  if (!hasSnapshots) return 0 // No snapshots, nothing to backfill

  const polledDate = sql<string>`DATE(${trackerSnapshots.polledAt})`

  const rows = await db
    .selectDistinctOn([trackerSnapshots.trackerId, polledDate], {
      trackerId: trackerSnapshots.trackerId,
      checkpointDate: polledDate.as("checkpoint_date"),
      uploadedBytesEnd: trackerSnapshots.uploadedBytes,
      downloadedBytesEnd: trackerSnapshots.downloadedBytes,
      bufferBytesEnd: trackerSnapshots.bufferBytes,
      ratioEnd: trackerSnapshots.ratio,
      seedbonusEnd: trackerSnapshots.seedbonus,
    })
    .from(trackerSnapshots)
    .orderBy(trackerSnapshots.trackerId, polledDate, sql`${trackerSnapshots.polledAt} DESC`)

  if (rows.length === 0) return 0

  const CHUNK_SIZE = 500
  let inserted = 0

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    await db
      .insert(trackerDailyCheckpoints)
      .values(
        chunk.map((row) => ({
          trackerId: row.trackerId,
          checkpointDate: row.checkpointDate,
          uploadedBytesEnd: row.uploadedBytesEnd,
          downloadedBytesEnd: row.downloadedBytesEnd,
          bufferBytesEnd: row.bufferBytesEnd,
          ratioEnd: row.ratioEnd != null ? Number(row.ratioEnd) : null,
          seedbonusEnd: row.seedbonusEnd != null ? Number(row.seedbonusEnd) : null,
          // snapshotCount is hard-coded to 1 because backfill selects only the
          // last snapshot per day. The actual count is not available without a
          // separate COUNT query per (trackerId, date) pair. Acceptable for backfill.
          snapshotCount: 1,
        }))
      )
      .onConflictDoNothing()
    // NOTE: inserted tracks chunk.length rather than actual DB rows written.
    // onConflictDoNothing() silently skips duplicate rows, so this count may
    // overstate the number of rows inserted. The return value is informational
    // only (used for a log.info call) and does not affect correctness.
    inserted += chunk.length
  }

  return inserted
}
