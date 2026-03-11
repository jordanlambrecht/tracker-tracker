// src/lib/qbt/aggregator.ts
//
// Functions: filterAndDedup, aggregateByTag

import { LEECHING_STATES, parseTorrentTags, SEEDING_STATES } from "@/lib/fleet"
import type { ClientStats, QbtTorrent, TagStats } from "./types"

export function filterAndDedup(allTorrents: QbtTorrent[], knownTags: string[]): QbtTorrent[] {
  const seen = new Set<string>()
  const result: QbtTorrent[] = []
  const tagSet = new Set(knownTags.map((t) => t.toLowerCase()))

  for (const torrent of allTorrents) {
    if (seen.has(torrent.hash)) continue
    const torrentTags = parseTorrentTags(torrent.tags)
    if (torrentTags.some((t) => tagSet.has(t))) {
      seen.add(torrent.hash)
      result.push(torrent)
    }
  }
  return result
}

export function aggregateByTag(
  torrents: QbtTorrent[],
  trackerTags: string[],
  crossSeedTags: string[]
): ClientStats {
  const knownTags = [...trackerTags, ...crossSeedTags]

  // Build a map of tag → accumulator
  const tagMap = new Map<string, TagStats>()
  for (const tag of knownTags) {
    tagMap.set(tag, {
      tag,
      seedingCount: 0,
      leechingCount: 0,
      uploadSpeed: 0,
      downloadSpeed: 0,
    })
  }

  // Accumulator for torrents with no matching known tag
  const untaggedBucket: TagStats = {
    tag: "untagged",
    seedingCount: 0,
    leechingCount: 0,
    uploadSpeed: 0,
    downloadSpeed: 0,
  }

  let totalSeedingCount = 0
  let totalLeechingCount = 0

  for (const torrent of torrents) {
    const torrentTags = parseTorrentTags(torrent.tags)
    const seeding = SEEDING_STATES.has(torrent.state)
    const leeching = LEECHING_STATES.has(torrent.state)

    if (seeding) {
      totalSeedingCount++
    } else if (leeching) {
      totalLeechingCount++
    }

    const matchedTags = torrentTags.filter((t) => tagMap.has(t))

    if (matchedTags.length === 0) {
      if (seeding) {
        untaggedBucket.seedingCount++
        untaggedBucket.uploadSpeed += torrent.upspeed
        untaggedBucket.downloadSpeed += torrent.dlspeed
      } else if (leeching) {
        untaggedBucket.leechingCount++
        untaggedBucket.uploadSpeed += torrent.upspeed
        untaggedBucket.downloadSpeed += torrent.dlspeed
      }
    } else {
      for (const matchedTag of matchedTags) {
        const bucket = tagMap.get(matchedTag)
        if (!bucket) continue
        if (seeding) {
          bucket.seedingCount++
          bucket.uploadSpeed += torrent.upspeed
          bucket.downloadSpeed += torrent.dlspeed
        } else if (leeching) {
          bucket.leechingCount++
          bucket.uploadSpeed += torrent.upspeed
          bucket.downloadSpeed += torrent.dlspeed
        }
      }
    }
  }

  const tagStats: TagStats[] = [...tagMap.values()]
  if (
    untaggedBucket.seedingCount > 0 ||
    untaggedBucket.leechingCount > 0
  ) {
    tagStats.push(untaggedBucket)
  }

  // Compute global speeds from transfer totals across all tags
  const uploadSpeedBytes = tagStats.reduce((sum, t) => sum + t.uploadSpeed, 0)
  const downloadSpeedBytes = tagStats.reduce((sum, t) => sum + t.downloadSpeed, 0)

  return {
    totalSeedingCount,
    totalLeechingCount,
    uploadSpeedBytes,
    downloadSpeedBytes,
    tagStats,
  }
}
