// src/lib/download-clients/transforms.ts

import type { TorrentRecord } from "./types"

/**
 * Maps a full TorrentRecord (normalized camelCase) to the 23-field shape stored in cachedTorrents JSONB.
 * The resulting shape matches TorrentRaw from fleet.ts sans clientName (stamped at query time).
 */
export type SlimTorrent = ReturnType<typeof slimTorrentForCache>

export function slimTorrentForCache(t: TorrentRecord) {
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
    seedingTime: t.seedingTime,
    activeTime: t.activeTime,
    addedAt: t.addedAt,
    completedAt: t.completedAt,
    lastActivityAt: t.lastActivityAt,
    remaining: t.remaining,
    seedCount: t.seedCount,
    leechCount: t.leechCount,
    swarmSeeders: t.swarmSeeders,
    swarmLeechers: t.swarmLeechers,
    uploadSpeed: t.uploadSpeed,
    downloadSpeed: t.downloadSpeed,
    availability: t.availability,
    progress: t.progress,
  }
}
