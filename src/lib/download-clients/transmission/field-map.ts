// src/lib/download-clients/transmission/field-map.ts
//
// Functions:
//   mapTransmissionState   - Transmission's numeric status in qBittorrent's state vocabulary
//   announceHost           - An announce URL's host and port, its path, query and userinfo dropped
//   canonicalTrackerHost   - The announce-list head's host, never its announce URL
//   mapTransmissionTorrent - One torrent-get entry as a validated TorrentRecord

import { coerceRequiredNumeric, coerceRequiredString } from "../field-map"
import type { TorrentRecord } from "../types"
import { TransmissionStatus, type TransmissionTorrent, type TransmissionTracker } from "./types"

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
 * Host and port as `new URL` gives them, "tracker.example.org:6969", with no
 * port when it is the scheme's default. It drops the path, query and userinfo,
 * which is where a passkey sits, and keeps a udp:// tracker's host. "" for
 * anything it cannot parse.
 */
export function announceHost(announce: unknown): string {
  if (typeof announce !== "string") return ""
  try {
    return new URL(announce).host
  } catch {
    return ""
  }
}

/**
 * The announce-list head, by (tier, id). It is the site's primary announce and
 * stays put when the site fails over, where the tracker currently working
 * would change.
 */
export function canonicalTrackerHost(trackers: TransmissionTracker[]): string {
  if (trackers.length === 0) return ""
  let best = trackers[0]
  for (const t of trackers) {
    if (t.tier < best.tier || (t.tier === best.tier && t.id < best.id)) best = t
  }
  return announceHost(best.announce)
}

export function mapTransmissionTorrent(t: TransmissionTorrent): TorrentRecord {
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
    // `trackers` has no swarm counts (see TORRENT_FIELDS), so these are the
    // peers transferring with us, and read lower than a tracker's swarm.
    swarmSeeders: t.peersSendingToUs,
    swarmLeechers: t.peersGettingFromUs,
    tracker: canonicalTrackerHost(t.trackers ?? []),
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
