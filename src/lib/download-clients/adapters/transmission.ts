// src/lib/download-clients/adapters/transmission.ts

import { parseTorrentTags } from "@/lib/fleet"
import { mapTransmissionTorrent } from "../transmission/field-map"
import {
  getSessionStats,
  invalidateSessionId,
  testSession,
  getTorrents as trGetTorrents,
} from "../transmission/transport"
import { buildBaseUrl, clearAuthBlocks } from "../transport"
import type { ClientAdapter, ClientCredentials, TorrentRecord, TransferStats } from "../types"

/**
 * Transmission adapter. It has no delta sync, so the scheduler takes its
 * full-fetch path, and torrent-get cannot select by label, so tag filtering
 * happens here against the mapped records.
 */
export class TransmissionClientAdapter implements ClientAdapter {
  readonly type = "transmission" as const
  readonly baseUrl: string

  constructor(
    host: string,
    port: number,
    ssl: boolean,
    private readonly creds: ClientCredentials
  ) {
    this.baseUrl = buildBaseUrl(host, port, ssl, creds.urlPath)
  }

  async testConnection(): Promise<void> {
    // An explicit test always reaches the network: the fix may have been a
    // daemon restart or a settings change no credential comparison can see.
    invalidateSessionId(this.baseUrl)
    clearAuthBlocks(this.baseUrl)
    await testSession(this.baseUrl, this.creds)
  }

  async getTorrents(options?: {
    tag?: string
    filter?: string
    signal?: AbortSignal
  }): Promise<TorrentRecord[]> {
    // "active" means bytes are moving now, the way qBittorrent's filter does.
    // recently-active narrows the request to torrents that moved data in the
    // last minute, a superset, and the rate check below keeps the moving ones.
    const active = options?.filter === "active"
    const raw = await trGetTorrents(this.baseUrl, this.creds, {
      recentlyActive: active,
      signal: options?.signal,
    })
    let torrents = raw.map(mapTransmissionTorrent)

    if (options?.tag) {
      const wanted = options.tag.trim().toLowerCase()
      torrents = torrents.filter((t) => parseTorrentTags(t.tags).includes(wanted))
    }
    if (active) {
      torrents = torrents.filter((t) => t.uploadSpeed > 0 || t.downloadSpeed > 0)
    }
    return torrents
  }

  async getTransferInfo(): Promise<TransferStats> {
    return getSessionStats(this.baseUrl, this.creds)
  }

  dispose(): void {
    invalidateSessionId(this.baseUrl)
    clearAuthBlocks(this.baseUrl)
  }
}
