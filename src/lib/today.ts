// src/lib/today.ts
//
// Functions: computeTodayAtAGlance, backfillTrackerCheckpoints

import "server-only"

import { eq, gte, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  downloadClients,
  torrentDailyCheckpoints,
  trackerDailyCheckpoints,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { parseTorrentTags } from "@/lib/fleet"
import { localDateStr } from "@/lib/formatters"
import { compareBigIntDesc, isUnixTimestampOnDate } from "@/lib/helpers"
import { log } from "@/lib/logger"
import { parseCachedTorrents } from "@/lib/qbt/client"
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

interface TorrentMover {
  hash: string
  name: string
  qbtTag: string | null
  trackerColor: string | null
  clientName: string | null
  uploadedToday: bigint
  downloadedToday: bigint
}

/**
 * Computes the entire TodayAtAGlance payload in a single call.
 * Fetches all required data in parallel where possible, then aggregates
 * fleet-level deltas, yesterday comparisons, torrent movers, and activity counts.
 */
export async function computeTodayAtAGlance(): Promise<TodayAtAGlance> {
  // ── Date boundaries (local timezone) ──────────────────────────────────────
  const now = Date.now()
  const todayStr = localDateStr()
  // Start of today in local timezone for snapshot filtering
  const todayStart = new Date(`${todayStr}T00:00:00`)
  const yesterdayStr = localDateStr(now - 86400000)
  const dayBeforeStr = localDateStr(now - 172800000)

  // ── Parallel data fetches ─────────────────────────────────────────────────
  const [allTrackers, todaySnapshots, checkpointRows, torrentCps, clients] = await Promise.all([
    db
      .select({
        id: trackers.id,
        name: trackers.name,
        color: trackers.color,
        qbtTag: trackers.qbtTag,
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
      .where(gte(trackerSnapshots.polledAt, todayStart))
      .orderBy(trackerSnapshots.polledAt),

    db
      .select({
        trackerId: trackerDailyCheckpoints.trackerId,
        checkpointDate: trackerDailyCheckpoints.checkpointDate,
        uploadedBytesEnd: trackerDailyCheckpoints.uploadedBytesEnd,
        downloadedBytesEnd: trackerDailyCheckpoints.downloadedBytesEnd,
        bufferBytesEnd: trackerDailyCheckpoints.bufferBytesEnd,
      })
      .from(trackerDailyCheckpoints)
      .where(inArray(trackerDailyCheckpoints.checkpointDate, [yesterdayStr, dayBeforeStr])),

    db
      .select({
        clientId: torrentDailyCheckpoints.clientId,
        hash: torrentDailyCheckpoints.hash,
        uploadedStart: torrentDailyCheckpoints.uploadedStart,
        downloadedStart: torrentDailyCheckpoints.downloadedStart,
      })
      .from(torrentDailyCheckpoints)
      .where(eq(torrentDailyCheckpoints.checkpointDate, todayStr)),

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

  // ── Per-tracker deltas from today's snapshots ─────────────────────────────

  // Group snapshots by trackerId
  const snapshotsByTracker = new Map<number, (typeof todaySnapshots)[number][]>()
  for (const snap of todaySnapshots) {
    const bucket = snapshotsByTracker.get(snap.trackerId) ?? []
    bucket.push(snap)
    snapshotsByTracker.set(snap.trackerId, bucket)
  }

  const trackerDeltas: TrackerDelta[] = []

  for (const tracker of allTrackers) {
    const snaps = snapshotsByTracker.get(tracker.id)

    if (!snaps || snaps.length < 2) {
      trackerDeltas.push(zeroDelta(tracker))
      continue
    }

    const earliest = snaps[0]
    const latest = snaps[snaps.length - 1]

    try {
      const uploadDelta = BigInt(latest.uploadedBytes) - BigInt(earliest.uploadedBytes)
      const downloadDelta = BigInt(latest.downloadedBytes) - BigInt(earliest.downloadedBytes)

      const latestBuffer = latest.bufferBytes ?? 0n
      const earliestBuffer = earliest.bufferBytes ?? 0n
      const bufferDelta = BigInt(latestBuffer) - BigInt(earliestBuffer)

      const ratioChange = (latest.ratio ?? 0) - (earliest.ratio ?? 0)
      const seedbonusChange = (latest.seedbonus ?? 0) - (earliest.seedbonus ?? 0)

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

    if (delta.uploadDelta > 0n) {
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

  // Build checkpoint lookup
  const cpByKey = new Map(torrentCps.map((cp) => [`${cp.clientId}:${cp.hash}`, cp]))

  // Build tracker tag → color lookup for matching torrent tags
  const trackerTagToColor = new Map<string, string | null>()
  for (const tracker of allTrackers) {
    if (tracker.qbtTag) {
      trackerTagToColor.set(tracker.qbtTag.toLowerCase(), tracker.color ?? null)
    }
  }

  const movers: TorrentMover[] = []
  let addedToday = 0
  let completedToday = 0

  for (const client of clients) {
    const torrents = parseCachedTorrents(client.cachedTorrents)

    for (const torrent of torrents) {
      // Activity counts. added_on and completion_on are unix timestamps (seconds)
      if (isUnixTimestampOnDate(torrent.added_on, todayStr)) {
        addedToday++
      }
      if (torrent.completion_on !== -1 && isUnixTimestampOnDate(torrent.completion_on, todayStr)) {
        completedToday++
      }

      // Compare current uploaded/downloaded to today's checkpoint
      const key = `${client.id}:${torrent.hash}`
      const checkpoint = cpByKey.get(key)
      if (!checkpoint) continue

      let uploadedToday: bigint
      let downloadedToday: bigint
      try {
        uploadedToday = BigInt(torrent.uploaded) - BigInt(checkpoint.uploadedStart)
        downloadedToday = BigInt(torrent.downloaded) - BigInt(checkpoint.downloadedStart)
      } catch (err) {
        log.warn(err, "BigInt conversion failed for torrent %s", torrent.hash)
        continue
      }

      // Match first qbtTag found in the torrent's comma-separated tags field
      let matchedTag: string | null = null
      let matchedColor: string | null = null
      if (torrent.tags) {
        const torrentTags = parseTorrentTags(torrent.tags)
        for (const tag of torrentTags) {
          const tagLower = tag.toLowerCase()
          if (trackerTagToColor.has(tagLower)) {
            matchedTag = tag
            matchedColor = trackerTagToColor.get(tagLower) ?? null
            break
          }
        }
      }

      // Only include torrents that match a tracked tracker
      if (!matchedTag) continue

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
    clientLastUpdated: latestClientPoll?.toISOString() ?? null,
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
          // last snapshot per day — the actual count is not available without a
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
