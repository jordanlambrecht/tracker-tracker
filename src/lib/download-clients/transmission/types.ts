// src/lib/download-clients/transmission/types.ts

/**
 * Fields requested from `torrent-get`. Transmission returns exactly what is
 * asked for and nothing else, so this list is the whole contract between the
 * transport and field-map — adding a field to TorrentRecord means adding it
 * here too, or the mapper silently reads undefined.
 */
export const TORRENT_FIELDS = [
  "hashString",
  "name",
  "status",
  "labels",
  "rateUpload",
  "rateDownload",
  "uploadedEver",
  "downloadedEver",
  "uploadRatio",
  "sizeWhenDone",
  "peersSendingToUs",
  "peersGettingFromUs",
  "addedDate",
  "doneDate",
  "activityDate",
  "secondsSeeding",
  "secondsDownloading",
  "leftUntilDone",
  "percentDone",
  "downloadDir",
  "isPrivate",
  // trackerStats rather than `trackers`: only trackerStats carries `host`, and
  // `host` is the passkey-free half of the announce URL. See the comment on
  // TransmissionTrackerStat.
  "trackerStats",
] as const

/**
 * One entry of a torrent's `trackerStats` array.
 *
 * Only the fields this adapter reads are declared. `announce` and `scrape` are
 * deliberately absent: on a private tracker both embed the account passkey, and
 * `host` (scheme-less `hostname:port`) carries everything matching needs
 * without it. Adding them here would put a passkey into every torrent record
 * the app holds in memory and caches to Postgres.
 */
export interface TransmissionTrackerStat {
  host: string // "tracker.example.org:443" — no path, no passkey
  sitename: string // "example" — Transmission's own second-level-domain key
  tier: number
  id: number
  isBackup: boolean
  seederCount: number // -1 when never scraped
  leecherCount: number // -1 when never scraped
  lastAnnounceSucceeded: boolean
}

/** From `torrent-get` with the field list above. */
export interface TransmissionTorrent {
  hashString: string
  name: string
  status: number // see TransmissionStatus
  labels: string[]
  rateUpload: number // bytes/sec
  rateDownload: number // bytes/sec
  uploadedEver: number
  downloadedEver: number
  uploadRatio: number // -1 when nothing has been downloaded yet
  sizeWhenDone: number // bytes of the selected files — the qBT `size` analogue
  peersSendingToUs: number
  peersGettingFromUs: number
  addedDate: number // unix seconds
  doneDate: number // unix seconds, 0 if never completed
  activityDate: number // unix seconds
  secondsSeeding: number
  secondsDownloading: number
  leftUntilDone: number // bytes
  percentDone: number // float 0-1
  downloadDir: string
  isPrivate: boolean
  trackerStats: TransmissionTrackerStat[]
}

/**
 * Transmission's numeric torrent status. Values are stable across 2.x-4.x and
 * are what `status` returns.
 */
export const TransmissionStatus = {
  STOPPED: 0,
  CHECK_WAIT: 1,
  CHECK: 2,
  DOWNLOAD_WAIT: 3,
  DOWNLOAD: 4,
  SEED_WAIT: 5,
  SEED: 6,
} as const

/** From `session-stats`. */
export interface TransmissionSessionStats {
  uploadSpeed: number // bytes/sec
  downloadSpeed: number // bytes/sec
}

/** The envelope every RPC method answers with. */
export interface TransmissionRpcResponse<T> {
  result: string // "success", or a human-readable failure
  arguments?: T
  tag?: number
}

/** Spot-checks a torrent-get payload before the mapper trusts it. */
export function isTransmissionTorrentList(value: unknown): value is { torrents: unknown[] } {
  if (!value || typeof value !== "object") return false
  return Array.isArray((value as { torrents?: unknown }).torrents)
}
