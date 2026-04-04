// src/lib/qbt/utils.ts

import type { QbtTorrent } from "./types"

/**
 * Normalizes the crossSeedTags column value
 */
export function parseCrossSeedTags(raw: string[] | null): string[] {
  return raw ?? []
}

/**
 * Maps a full QbtTorrent (54 fields) to the 23-field shape stored in cachedTorrents JSONB.
 * The resulting shape matches TorrentRaw from fleet.ts sans client_name (stamped at query time).
 */
export type SlimTorrent = ReturnType<typeof slimTorrentForCache>

export function slimTorrentForCache(t: QbtTorrent) {
  return {
    hash: t.hash,
    name: t.name,
    state: t.state,
    tags: t.tags,
    category: t.category,
    uploaded: t.uploaded,
    downloaded: t.downloaded,
    ratio: t.ratio,
    size: t.size,
    seeding_time: t.seeding_time,
    time_active: t.time_active,
    added_on: t.added_on,
    completion_on: t.completion_on,
    last_activity: t.last_activity,
    amount_left: t.amount_left,
    num_seeds: t.num_seeds,
    num_leechs: t.num_leechs,
    num_complete: t.num_complete,
    num_incomplete: t.num_incomplete,
    upspeed: t.upspeed,
    dlspeed: t.dlspeed,
    availability: t.availability,
    progress: t.progress,
  }
}

/**
 * Strips tracker announce URL, content_path, and save_path from a torrent object.
 * These fields may contain passkeys or expose server filesystem paths.
 */
export function stripSensitiveTorrentFields<
  T extends Pick<QbtTorrent, "tracker" | "content_path" | "save_path">,
>(torrent: T): Omit<T, "tracker" | "content_path" | "save_path"> {
  const { tracker: _t, content_path: _cp, save_path: _sp, ...rest } = torrent
  return rest
}
