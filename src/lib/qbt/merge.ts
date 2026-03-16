// src/lib/qbt/merge.ts
//
// Functions: mergeTorrentLists, aggregateCrossSeedTags

/**
 * Raw torrent shape returned by the qBT API (snake_case).
 * Intentionally minimal — only fields the merge logic touches.
 * The full object passes through untouched.
 */
export interface RawTorrent {
  hash: string
  upspeed: number
  dlspeed: number
  seeding_time: number
  progress: number
  num_seeds: number
  num_complete: number
  num_leechs: number
  num_incomplete: number
  uploaded: number
  downloaded: number
  ratio: number
}

/**
 * Merge torrent lists from multiple qBT clients, deduplicating by hash.
 *
 * Same hash across clients = same torrent seeded from multiple places.
 *   - Speeds are summed (different peers per client)
 *   - seeding_time takes the max (longest-running instance)
 *   - progress takes the max (most complete instance)
 *   - Swarm counts take the max (best visibility)
 *   - uploaded/downloaded are summed (total contribution across clients)
 *   - All other fields kept from the first occurrence
 */
export function mergeTorrentLists<T extends RawTorrent>(lists: T[][]): T[] {
  const merged = new Map<string, T>()

  for (const list of lists) {
    for (const torrent of list) {
      const existing = merged.get(torrent.hash)
      if (!existing) {
        merged.set(torrent.hash, { ...torrent })
        continue
      }

      // Sum speeds — each client contributes to different peers
      existing.upspeed += torrent.upspeed
      existing.dlspeed += torrent.dlspeed

      // Sum total transfer — cumulative contribution
      existing.uploaded += torrent.uploaded
      existing.downloaded += torrent.downloaded

      // Take best values
      existing.seeding_time = Math.max(existing.seeding_time, torrent.seeding_time)
      existing.progress = Math.max(existing.progress, torrent.progress)
      existing.num_seeds = Math.max(existing.num_seeds, torrent.num_seeds)
      existing.num_complete = Math.max(existing.num_complete, torrent.num_complete)
      existing.num_leechs = Math.max(existing.num_leechs, torrent.num_leechs)
      existing.num_incomplete = Math.max(existing.num_incomplete, torrent.num_incomplete)

      // Recalculate ratio from summed transfer totals
      existing.ratio =
        existing.downloaded > 0
          ? existing.uploaded / existing.downloaded
          : Math.max(existing.ratio, torrent.ratio)
    }
  }

  return [...merged.values()]
}

/**
 * Union cross-seed tags from all clients into a single deduplicated array.
 */
export function aggregateCrossSeedTags(clients: { crossSeedTags: string[] }[]): string[] {
  const tagSet = new Set<string>()
  for (const client of clients) {
    for (const tag of client.crossSeedTags) {
      tagSet.add(tag)
    }
  }
  return [...tagSet]
}
