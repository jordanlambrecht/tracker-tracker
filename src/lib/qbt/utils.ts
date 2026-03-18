// src/lib/qbt/utils.ts
//
// Functions: parseCrossSeedTags, stripSensitiveTorrentFields

import type { QbtTorrent } from "./types"

/**
 * Normalizes the crossSeedTags column value. The column is a native text[]
 * array, so Drizzle returns string[] | null. Returns [] for null.
 */
export function parseCrossSeedTags(raw: string[] | null): string[] {
  return raw ?? []
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
