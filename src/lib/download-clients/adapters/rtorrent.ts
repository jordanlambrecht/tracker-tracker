// src/lib/download-clients/adapters/rtorrent.ts

import { mapRtorrentTorrent } from "../rtorrent/field-map"
import { clearClient, getTorrents, getTransferStats, testClient } from "../rtorrent/transport"
import { buildBaseUrl, clearAuthBlocks } from "../transport"
import type { ClientAdapter, ClientCredentials, TorrentRecord, TransferStats } from "../types"

/**
 * rTorrent adapter over HTTP XML-RPC. It has no delta sync, so the scheduler
 * takes its full-fetch path. Its single label maps to a category, so no
 * torrent carries a tag and a tag filter matches nothing.
 */
export class RtorrentClientAdapter implements ClientAdapter {
  readonly type = "rtorrent" as const
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
    // password change no credential comparison can see.
    clearAuthBlocks(this.baseUrl)
    await testClient(this.baseUrl, this.creds)
  }

  async getTorrents(options?: {
    tag?: string
    filter?: string
    signal?: AbortSignal
  }): Promise<TorrentRecord[]> {
    if (options?.tag) return []
    const raw = await getTorrents(this.baseUrl, this.creds, { signal: options?.signal })
    const now = Math.floor(Date.now() / 1000)
    const torrents = raw.map((t) => mapRtorrentTorrent(t, now))
    // "active" means bytes are moving now, the way qBittorrent's filter does.
    if (options?.filter === "active") {
      return torrents.filter((t) => t.uploadSpeed > 0 || t.downloadSpeed > 0)
    }
    return torrents
  }

  async getTransferInfo(): Promise<TransferStats> {
    return getTransferStats(this.baseUrl, this.creds)
  }

  dispose(): void {
    clearClient(this.baseUrl)
    clearAuthBlocks(this.baseUrl)
  }
}
