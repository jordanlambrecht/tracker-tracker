// src/lib/download-clients/merge.ts
//
// Functions: mergeTorrentLists, aggregateCrossSeedTags

/**
 * Minimal torrent shape the merge algorithm touches.
 * The full object passes through untouched.
 */
export interface RawTorrent {
  hash: string
  uploadSpeed: number
  downloadSpeed: number
  seedingTime: number
  progress: number
  seedCount: number
  swarmSeeders: number
  leechCount: number
  swarmLeechers: number
  uploaded: number
  downloaded: number
  ratio: number
}

/**
 * Merge torrent lists from multiple qBT clients, deduplicating by hash.
 *
 * Same hash across clients = same torrent seeded from multiple places.
 *   - Speeds are summed (different peers per client)
 *   - seedingTime takes the max (longest-running instance)
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

      existing.uploadSpeed += torrent.uploadSpeed
      existing.downloadSpeed += torrent.downloadSpeed
      existing.uploaded += torrent.uploaded
      existing.downloaded += torrent.downloaded
      existing.seedingTime = Math.max(existing.seedingTime, torrent.seedingTime)
      existing.progress = Math.max(existing.progress, torrent.progress)
      existing.seedCount = Math.max(existing.seedCount, torrent.seedCount)
      existing.swarmSeeders = Math.max(existing.swarmSeeders, torrent.swarmSeeders)
      existing.leechCount = Math.max(existing.leechCount, torrent.leechCount)
      existing.swarmLeechers = Math.max(existing.swarmLeechers, torrent.swarmLeechers)

      existing.ratio =
        existing.downloaded > 0
          ? existing.uploaded / existing.downloaded
          : Math.max(existing.ratio, torrent.ratio)
    }
  }

  return [...merged.values()]
}

/**
 * Build a hash → client name(s) lookup from per-client torrent lists,
 * then stamp each merged torrent with a `clientName` field.
 */
export function stampClientNames<T extends { hash: string }>(
  clientTorrents: { clientName: string; torrents: T[] }[],
  merged: T[]
): (T & { clientName: string })[] {
  const hashClients = new Map<string, string[]>()
  for (const { clientName, torrents } of clientTorrents) {
    for (const t of torrents) {
      const names = hashClients.get(t.hash) ?? []
      names.push(clientName)
      hashClients.set(t.hash, names)
    }
  }
  return merged.map((t) => ({
    ...t,
    clientName: (hashClients.get(t.hash) ?? []).join(", "),
  }))
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
