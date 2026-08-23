// src/lib/download-clients/field-map.ts

import { log } from "@/lib/logger"
import type {
  TransmissionTorrent,
  TransmissionTrackerStat,
} from "./transmission/types"
import { TransmissionStatus } from "./transmission/types"
import type { TorrentRecord } from "./types"

const FIELD_MAP: Record<string, string> = {
  upspeed: "uploadSpeed",
  dlspeed: "downloadSpeed",
  num_seeds: "seedCount",
  num_leechs: "leechCount",
  num_complete: "swarmSeeders",
  num_incomplete: "swarmLeechers",
  added_on: "addedAt",
  completion_on: "completedAt",
  last_activity: "lastActivityAt",
  seeding_time: "seedingTime",
  time_active: "activeTime",
  seen_complete: "lastSeenComplete",
  amount_left: "remaining",
  content_path: "contentPath",
  save_path: "savePath",
  is_private: "isPrivate",
}

const REQUIRED_NUMERIC = ["uploadSpeed", "downloadSpeed", "size", "ratio", "uploaded", "downloaded"]

export function mapQbtTorrent(raw: Record<string, unknown>): TorrentRecord {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    result[FIELD_MAP[key] ?? key] = value
  }
  for (const field of REQUIRED_NUMERIC) {
    if (typeof result[field] !== "number") {
      log.warn(
        { hash: result.hash, field, value: result[field] },
        "mapQbtTorrent: missing or non-numeric field, defaulting to 0"
      )
      result[field] = 0
    }
  }
  return result as unknown as TorrentRecord
}

export function mapQbtDelta(partial: Record<string, unknown>): Partial<TorrentRecord> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(partial)) {
    result[FIELD_MAP[key] ?? key] = value
  }
  return result as Partial<TorrentRecord>
}

// ---------------------------------------------------------------------------
// Transmission
//
// Not a rename table like the qBittorrent map above. Transmission reports a
// numeric status, a label array, and a per-tracker stats array, none of which
// have a one-to-one counterpart in TorrentRecord, so the mapping is written out
// rather than driven by a key map.
// ---------------------------------------------------------------------------

/**
 * Transmission's numeric status, expressed in the qBittorrent state vocabulary
 * TorrentRecord already speaks (SEEDING_STATES / LEECHING_STATES in lib/fleet.ts
 * are the consumers).
 *
 * The uploading/stalledUP and downloading/stalledDL split is derived from the
 * transfer rate rather than from Transmission's own `isStalled`, because
 * `isStalled` is governed by the "stop seeding when idle" preference and is
 * always false when that preference is off — whereas qBittorrent's stalled
 * states mean exactly "no bytes are moving", which is what the rate says.
 */
export function mapTransmissionState(status: number, torrent: TransmissionStateInput): string {
  const done = torrent.leftUntilDone === 0
  switch (status) {
    case TransmissionStatus.STOPPED:
      return done ? "pausedUP" : "pausedDL"
    case TransmissionStatus.CHECK_WAIT:
    case TransmissionStatus.CHECK:
      return done ? "checkingUP" : "checkingDL"
    case TransmissionStatus.DOWNLOAD_WAIT:
      return "queuedDL"
    case TransmissionStatus.DOWNLOAD:
      return torrent.rateDownload > 0 ? "downloading" : "stalledDL"
    case TransmissionStatus.SEED_WAIT:
      return "queuedUP"
    case TransmissionStatus.SEED:
      return torrent.rateUpload > 0 ? "uploading" : "stalledUP"
    default:
      return done ? "stalledUP" : "stalledDL"
  }
}

interface TransmissionStateInput {
  leftUntilDone: number
  rateUpload: number
  rateDownload: number
}

/**
 * The torrent's canonical announce host — the one tracker matching should use.
 *
 * Picked by (tier, id) ascending, which is announce-list order: Transmission
 * assigns tracker ids in the order it read them out of the .torrent, so the
 * first entry is the announce the file was published with, and any failover
 * mirror the site added is appended after it.
 *
 * That is deliberately NOT "the tracker that is currently working", which is
 * what qBittorrent's `tracker` field reports. The two disagree whenever a site
 * runs its failover on a different registrable domain, and the working one is
 * then the wrong answer for matching: measured across 59 TorrentLeech torrents
 * on a live client, the active announce was `tleechreload.org` on 58 of them
 * while the registry — and the user — knows the site as `torrentleech.org`.
 * Announce-list order gave `torrentleech.org` on all 59.
 *
 * Returns `host` (hostname:port), never `announce`: on a private tracker the
 * announce URL embeds the account passkey, and trackerHostKey() only ever reads
 * the hostname out of it anyway.
 */
export function canonicalTrackerHost(stats: TransmissionTrackerStat[]): string {
  if (stats.length === 0) return ""
  let best = stats[0]
  for (const s of stats) {
    if (s.tier < best.tier || (s.tier === best.tier && s.id < best.id)) best = s
  }
  return best.host
}

/** Highest swarm count reported by any of the torrent's trackers, ignoring
 *  the -1 Transmission uses for "never scraped". */
function swarmMax(stats: TransmissionTrackerStat[], field: "seederCount" | "leecherCount"): number {
  let max = 0
  for (const s of stats) {
    if (s[field] > max) max = s[field]
  }
  return max
}

export function mapTransmissionTorrent(t: TransmissionTorrent): TorrentRecord {
  const stats = t.trackerStats ?? []
  return {
    hash: t.hashString,
    name: t.name,
    state: mapTransmissionState(t.status, t),
    // Transmission labels are an array; TorrentRecord carries the qBittorrent
    // comma-separated string, which parseTorrentTags() splits back apart.
    tags: (t.labels ?? []).join(", "),
    // Transmission has no category concept. Bandwidth groups are the nearest
    // thing and mean something different, so this stays empty rather than
    // inventing a value the fleet aggregation would then group by.
    category: "",
    uploadSpeed: t.rateUpload,
    downloadSpeed: t.rateDownload,
    uploaded: t.uploadedEver,
    downloaded: t.downloadedEver,
    // Transmission reports -1 for a torrent that has downloaded nothing (a
    // cross-seed added at 100%, say). qBittorrent reports 0, and every consumer
    // here treats ratio as non-negative.
    ratio: t.uploadRatio < 0 ? 0 : t.uploadRatio,
    // sizeWhenDone, not totalSize: qBittorrent's `size` is the size of the
    // files selected for download, which is what sizeWhenDone means.
    size: t.sizeWhenDone,
    seedCount: t.peersSendingToUs,
    leechCount: t.peersGettingFromUs,
    swarmSeeders: swarmMax(stats, "seederCount"),
    swarmLeechers: swarmMax(stats, "leecherCount"),
    tracker: canonicalTrackerHost(stats),
    addedAt: t.addedDate,
    // qBittorrent uses -1 for "never completed"; Transmission uses 0.
    completedAt: t.doneDate > 0 ? t.doneDate : -1,
    lastActivityAt: t.activityDate,
    seedingTime: t.secondsSeeding,
    activeTime: t.secondsDownloading + t.secondsSeeding,
    // No Transmission equivalent of qBittorrent's seen_complete. 0 rather than
    // a fabricated timestamp: the staleness charts read it as "never seen".
    lastSeenComplete: 0,
    // qBittorrent reports -1 when availability is not applicable, which is what
    // this is: Transmission exposes desiredAvailable in bytes, not the piece
    // availability ratio the field is documented to hold.
    availability: -1,
    remaining: t.leftUntilDone,
    progress: t.percentDone,
    contentPath: `${t.downloadDir.replace(/\/$/, "")}/${t.name}`,
    savePath: t.downloadDir,
    isPrivate: t.isPrivate,
  }
}
