// src/lib/download-clients/transmission/types.ts

/** The first torrent-get of a poll, which picks out the private torrents. */
export const INDEX_FIELDS = ["id", "isPrivate"] as const

/**
 * Fields requested from torrent-get. Transmission returns only these, so a
 * field the mapper reads has to be listed here or it arrives undefined.
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
  // For the tracker host. trackerStats would add swarm counts, but each entry
  // costs about 650 B against about 135 B here.
  "trackers",
] as const

/**
 * One trackers entry, declared as far as the mapper reads it. Transmission also
 * sends `scrape` and `sitename`. `announce` and `scrape` carry the passkey on a
 * private tracker, so the mapper keeps only the announce URL's host, and
 * neither URL reaches a TorrentRecord or the cache.
 */
export interface TransmissionTracker {
  announce: string
  tier: number
  id: number
}

/** From torrent-get with the field list above. */
export interface TransmissionTorrent {
  hashString: string
  name: string
  status: number // see TransmissionStatus
  labels: string[]
  rateUpload: number // bytes/sec
  rateDownload: number // bytes/sec
  uploadedEver: number
  downloadedEver: number
  uploadRatio: number // uploadedEver over sizeWhenDone; -1 for 0 over 0, -2 for an upload over 0
  sizeWhenDone: number // bytes of the selected files
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
  trackers: TransmissionTracker[]
}

/** Transmission's numeric torrent status, stable across 2.x to 4.x. */
export const TransmissionStatus = {
  STOPPED: 0,
  CHECK_WAIT: 1,
  CHECK: 2,
  DOWNLOAD_WAIT: 3,
  DOWNLOAD: 4,
  SEED_WAIT: 5,
  SEED: 6,
} as const

/** From session-stats. */
export interface TransmissionSessionStats {
  uploadSpeed: number // bytes/sec
  downloadSpeed: number // bytes/sec
}

/** The envelope every RPC method answers with. */
export interface TransmissionRpcResponse<T> {
  result: string // "success", or a failure the host words
  arguments?: T
  tag?: number
}

/** An INDEX_FIELDS entry for a private torrent. Anything else is not fetched. */
export function isPrivateIndexEntry(value: unknown): value is { id: number; isPrivate: true } {
  if (!value || typeof value !== "object") return false
  const t = value as Record<string, unknown>
  return Number.isInteger(t.id) && t.isPrivate === true
}

export function isTransmissionTorrentList(value: unknown): value is { torrents: unknown[] } {
  if (!value || typeof value !== "object") return false
  return Array.isArray((value as { torrents?: unknown }).torrents)
}

/**
 * The fields the mapper dereferences. A wrong one would throw and fail the
 * whole poll, or file the torrent under no hash. Numbers are left to the coerce
 * helpers, which default them.
 */
export function isTransmissionTorrent(value: unknown): value is TransmissionTorrent {
  if (!value || typeof value !== "object") return false
  const t = value as Record<string, unknown>
  return (
    typeof t.hashString === "string" &&
    t.hashString !== "" &&
    typeof t.name === "string" &&
    typeof t.downloadDir === "string" &&
    (t.labels === undefined || Array.isArray(t.labels)) &&
    (t.trackers === undefined ||
      (Array.isArray(t.trackers) && t.trackers.every((s) => s !== null && typeof s === "object")))
  )
}
