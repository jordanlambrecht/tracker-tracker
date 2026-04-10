// src/lib/download-clients/aggregator.ts

import { LEECHING_STATES, parseTorrentTags, SEEDING_STATES } from "@/lib/fleet"
import type { ClientStats, TagStats } from "./qbt/types"
import type { TorrentRecord } from "./types"

export function aggregateByTag(
  torrents: TorrentRecord[],
  trackerTags: string[],
  crossSeedTags: string[]
): ClientStats {
  const knownTags = [...trackerTags, ...crossSeedTags]

  const tagMap = new Map<string, TagStats>()
  for (const tag of knownTags) {
    tagMap.set(tag.toLowerCase(), {
      tag: tag.toLowerCase(),
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
        untaggedBucket.uploadSpeed += torrent.uploadSpeed
        untaggedBucket.downloadSpeed += torrent.downloadSpeed
      } else if (leeching) {
        untaggedBucket.leechingCount++
        untaggedBucket.uploadSpeed += torrent.uploadSpeed
        untaggedBucket.downloadSpeed += torrent.downloadSpeed
      }
    } else {
      for (const matchedTag of matchedTags) {
        const bucket = tagMap.get(matchedTag)
        if (!bucket) continue
        if (seeding) {
          bucket.seedingCount++
          bucket.uploadSpeed += torrent.uploadSpeed
          bucket.downloadSpeed += torrent.downloadSpeed
        } else if (leeching) {
          bucket.leechingCount++
          bucket.uploadSpeed += torrent.uploadSpeed
          bucket.downloadSpeed += torrent.downloadSpeed
        }
      }
    }
  }

  const tagStats: TagStats[] = [...tagMap.values()]
  if (untaggedBucket.seedingCount > 0 || untaggedBucket.leechingCount > 0) {
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
