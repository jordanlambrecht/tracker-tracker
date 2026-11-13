// src/lib/download-clients/rtorrent/field-map.ts
//
// Functions:
//   mapRtorrentState   - rTorrent's state flags in qBittorrent's state vocabulary
//   primaryTrackerHost - The host of the first enabled tracker in the lowest group
//   mapRtorrentTorrent - One rTorrent torrent as a validated TorrentRecord

import { announceHost } from "../announce"
import { coerceRequiredNumeric, coerceRequiredString } from "../field-map"
import type { TorrentRecord } from "../types"
import type { RtorrentTorrent, RtorrentTracker } from "./types"

/**
 * The qBittorrent 5 state names TorrentRecord speaks. A paused torrent (open,
 * not active) reads as stopped, as Transmission's does, so only started ones
 * count as seeding or leeching.
 * @internal
 */
export function mapRtorrentState(t: RtorrentTorrent): string {
  if (t.hashing > 0) return t.complete ? "checkingUP" : "checkingDL"
  if (t.state === 0 || !t.isActive) return t.complete ? "stoppedUP" : "stoppedDL"
  if (t.complete) return t.upRate > 0 ? "uploading" : "stalledUP"
  return t.downRate > 0 ? "downloading" : "stalledDL"
}

function enabledTrackers(trackers: RtorrentTracker[]): RtorrentTracker[] {
  return trackers.filter((t) => t.enabled)
}

/**
 * The site's primary announce: the first enabled tracker in the lowest group.
 * It stays put when the site fails over to a backup group.
 * @internal
 */
export function primaryTrackerHost(trackers: RtorrentTracker[]): string {
  let best: RtorrentTracker | undefined
  for (const t of enabledTrackers(trackers)) {
    if (!best || t.group < best.group) best = t
  }
  return best ? announceHost(best.url) : ""
}

/** ruTorrent stores labels percent-encoded. A malformed escape keeps the raw label. */
function decodeLabel(label: string): string {
  try {
    return decodeURIComponent(label)
  } catch {
    return label
  }
}

function parentDir(path: string): string {
  const trimmed = path.replace(/\/+$/, "")
  const i = trimmed.lastIndexOf("/")
  return i > 0 ? trimmed.slice(0, i) : i === 0 ? "/" : trimmed
}

export function mapRtorrentTorrent(t: RtorrentTorrent, nowSec: number): TorrentRecord {
  const trackers = enabledTrackers(t.trackers)
  const scrapeSeeders = Math.max(0, ...trackers.map((tr) => tr.scrapeComplete))
  const scrapeLeechers = Math.max(0, ...trackers.map((tr) => tr.scrapeIncomplete))
  const seedCount = t.peersComplete
  const leechCount = Math.max(0, t.peersAccounted - t.peersComplete)
  // A tracker that never answered a scrape reports 0, so connected peers stand in.
  const scraped = scrapeSeeders > 0 || scrapeLeechers > 0
  const directory = t.directory.replace(/\/+$/, "")

  const result: Record<string, unknown> = {
    hash: t.hash.toLowerCase(),
    name: t.name,
    state: mapRtorrentState(t),
    // The label is set per *arr app, which is what a qBittorrent category means.
    tags: "",
    category: decodeLabel(t.label),
    uploadSpeed: t.upRate,
    downloadSpeed: t.downRate,
    uploaded: t.upTotal,
    downloaded: t.downTotal,
    ratio: t.upTotal > 0 && t.completedBytes === 0 ? -1 : t.ratio / 1000,
    size: t.sizeBytes,
    seedCount,
    leechCount,
    swarmSeeders: scraped ? scrapeSeeders : seedCount,
    swarmLeechers: scraped ? scrapeLeechers : leechCount,
    tracker: primaryTrackerHost(t.trackers),
    addedAt: /^\d+$/.test(t.addTime) ? Number(t.addTime) : t.startedAt,
    completedAt: t.finishedAt > 0 ? t.finishedAt : -1,
    // rTorrent keeps no last-activity time, so only a transfer right now counts.
    lastActivityAt: t.upRate > 0 || t.downRate > 0 ? nowSec : 0,
    seedingTime: t.complete && t.isActive && t.finishedAt > 0 ? nowSec - t.finishedAt : 0,
    activeTime: 0,
    lastSeenComplete: 0,
    availability: -1,
    remaining: t.leftBytes,
    progress: t.sizeBytes > 0 ? t.completedBytes / t.sizeBytes : 0,
    // base_path is empty for a closed torrent, so the directory stands in.
    contentPath: t.basePath || (t.isMultiFile ? directory : `${directory}/${t.name}`),
    // A multi-file torrent's directory is its own folder; single files sit in theirs.
    savePath: t.isMultiFile ? parentDir(directory) : directory,
    isPrivate: t.isPrivate,
  }
  coerceRequiredNumeric(result)
  coerceRequiredString(result)
  return result as unknown as TorrentRecord
}
