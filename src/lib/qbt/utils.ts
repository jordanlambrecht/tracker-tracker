// src/lib/qbt/utils.ts
//
// Functions: parseCrossSeedTags, stripSensitiveTorrentFields

import type { QbtTorrent } from "./types"

/**
 * Parses the crossSeedTags JSON column. The column is notNull with default "[]",
 * but the stored value could be malformed. Falls back to [] on any parse error.
 */
export function parseCrossSeedTags(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

/**
 * Strips tracker announce URL, content_path, and save_path from a torrent object.
 * These fields may contain passkeys or expose server filesystem paths.
 */
export function stripSensitiveTorrentFields<T extends Pick<QbtTorrent, "tracker" | "content_path" | "save_path">>(
  torrent: T
): Omit<T, "tracker" | "content_path" | "save_path"> {
  const { tracker: _t, content_path: _cp, save_path: _sp, ...rest } = torrent
  return rest
}
