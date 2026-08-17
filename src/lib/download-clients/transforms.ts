// src/lib/download-clients/transforms.ts

import { trackerHostKey } from "@/lib/tracker-matching"
import type { TorrentRecord } from "./types"

/**
 * Maps a full TorrentRecord (normalized camelCase) to the 24-field shape stored in cachedTorrents JSONB.
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
    // The derived announce HOST, not the raw `tracker` announce URL — deliberately,
    // do not "simplify" this back to `t.tracker`.
    //
    // Attribution only ever needs the host: announceMatchesTracker reduces both the
    // torrent's announce URL and the tracker's baseUrl to a host key before comparing,
    // so the full URL is data this pipeline never reads. Storing the host is storing
    // what the code actually uses.
    //
    // It also happens to be the safe thing to store. cachedTorrents is a plaintext
    // jsonb column (and lands verbatim in unencrypted backup exports), and announce
    // URLs carry per-user passkeys. trackerHostKey parses via `new URL(...).hostname`,
    // which drops path, query string and userinfo, then reduces to the registrable
    // domain — so a passkey in any of those positions, or as a subdomain, is gone.
    //
    // trackerHostKey is idempotent (trackerHostKey("lst.gg") === "lst.gg"), so the
    // consumer side — fleet-aggregation's keyForAnnounce — works on this stored host
    // exactly as it would on a raw URL, with no branch for which one it received.
    tracker: trackerHostKey(t.tracker) ?? undefined,
  }
}
