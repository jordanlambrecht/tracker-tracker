// src/lib/download-clients/transmission/field-map.ts
//
// Functions:
//   mapTransmissionState   - Transmission's numeric status in qBittorrent's state vocabulary
//   canonicalTrackerHost   - The announce-list head's host, never its announce URL
//   swarmMax               - Highest swarm count any tracker reported
//   mapTransmissionTorrent - One torrent-get entry as a validated TorrentRecord

import { coerceRequiredNumeric, coerceRequiredString } from "../field-map"
import type { TorrentRecord } from "../types"
import { TransmissionStatus, type TransmissionTorrent, type TransmissionTrackerStat } from "./types"

/** uploadRatio's sentinels: nothing over nothing, and an upload over nothing to seed. */
const RATIO_NOT_APPLICABLE = -1
const RATIO_INFINITE = -2

interface TransmissionStateInput {
  leftUntilDone: number
  rateUpload: number
  rateDownload: number
}

/**
 * The qBittorrent state names TorrentRecord speaks. The stalled split comes
 * from the transfer rate, because Transmission's own `isStalled` follows the
 * idle-seeding preference and is always false when that is off.
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

/**
 * The announce-list head, by (tier, id). It is the site's primary announce and
 * stays put when the site fails over, where the tracker currently working
 * would change. Returns `host`, so the passkey in `announce` is never copied.
 */
export function canonicalTrackerHost(stats: TransmissionTrackerStat[]): string {
  if (stats.length === 0) return ""
  let best = stats[0]
  for (const s of stats) {
    if (s.tier < best.tier || (s.tier === best.tier && s.id < best.id)) best = s
  }
  return best.host
}

/** Undefined when no tracker reported a count. -1 means never scraped, so it is skipped. */
function swarmMax(
  stats: TransmissionTrackerStat[],
  field: "seederCount" | "leecherCount"
): number | undefined {
  let max: number | undefined
  for (const s of stats) {
    const count = s[field]
    if (typeof count === "number" && count >= 0 && (max === undefined || count > max)) max = count
  }
  return max
}

export function mapTransmissionTorrent(t: TransmissionTorrent): TorrentRecord {
  const stats = t.trackerStats ?? []
  const result: Record<string, unknown> = {
    hash: t.hashString,
    name: t.name,
    state: mapTransmissionState(t.status, t),
    // parseTorrentTags splits this back apart.
    tags: (t.labels ?? []).join(", "),
    // Transmission has no categories. Bandwidth groups mean something else.
    category: "",
    uploadSpeed: t.rateUpload,
    downloadSpeed: t.rateDownload,
    uploaded: t.uploadedEver,
    downloaded: t.downloadedEver,
    ratio:
      t.uploadRatio === RATIO_INFINITE
        ? -1
        : t.uploadRatio === RATIO_NOT_APPLICABLE
          ? 0
          : t.uploadRatio,
    // The size of the selected files, which is what qBittorrent's `size` means.
    size: t.sizeWhenDone,
    seedCount: t.peersSendingToUs,
    leechCount: t.peersGettingFromUs,
    // No tracker reported a count, so fall back to peers transferring with us.
    // qBittorrent falls back to its peer list instead (torrentimpl.cpp:1428-1442),
    // which counts unconnected peers too, so this can read lower.
    swarmSeeders: swarmMax(stats, "seederCount") ?? t.peersSendingToUs,
    swarmLeechers: swarmMax(stats, "leecherCount") ?? t.peersGettingFromUs,
    tracker: canonicalTrackerHost(stats),
    addedAt: t.addedDate,
    // Transmission uses 0 for never completed, qBittorrent -1.
    completedAt: t.doneDate > 0 ? t.doneDate : -1,
    lastActivityAt: t.activityDate,
    seedingTime: t.secondsSeeding,
    // Summed only when both arrived: a missing one makes NaN, which passes the
    // numeric gate below as a number.
    activeTime:
      typeof t.secondsDownloading === "number" && typeof t.secondsSeeding === "number"
        ? t.secondsDownloading + t.secondsSeeding
        : undefined,
    // No equivalent of qBittorrent's seen_complete; 0 reads as never seen.
    lastSeenComplete: 0,
    // Transmission has no piece availability ratio; -1 is qBittorrent's not applicable.
    availability: -1,
    remaining: t.leftUntilDone,
    progress: t.percentDone,
    contentPath: `${t.downloadDir.replace(/\/$/, "")}/${t.name}`,
    savePath: t.downloadDir,
    isPrivate: typeof t.isPrivate === "boolean" ? t.isPrivate : undefined,
  }
  coerceRequiredNumeric(result)
  coerceRequiredString(result)
  return result as unknown as TorrentRecord
}
