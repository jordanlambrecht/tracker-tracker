// src/lib/download-clients/adapters/transmission.ts

import { mapTransmissionTorrent } from "../field-map"
// buildBaseUrl is client-agnostic despite living under qbt/ — fetch.ts imports
// it from there for the same reason.
import { buildBaseUrl } from "../qbt/transport"
import {
  getSessionStats,
  invalidateSessionId,
  testSession,
  getTorrents as trGetTorrents,
} from "../transmission/transport"
import type { ClientAdapter, ClientCredentials, TorrentRecord, TransferStats } from "../types"

/**
 * Transmission adapter.
 *
 * Two things set it apart from the qBittorrent adapter it sits beside:
 *
 *  1. **No delta sync.** Transmission has no `sync/maindata` equivalent, so
 *     getDeltaSync is not implemented and the scheduler takes its existing
 *     full-fetch path (`if (adapter.getDeltaSync)`). One `torrent-get` returns
 *     every torrent with every field, which is cheap enough that the delta
 *     would buy little: a library of several hundred torrents measures well
 *     inside the fetch timeout.
 *
 *  2. **Filtering is local.** Transmission's `ids` argument selects by id or
 *     hash only — there is no server-side label or activity filter — so `tag`
 *     and `filter` are applied here, against the mapped records.
 *
 * Session handling is the CSRF `X-Transmission-Session-Id` handshake, and lives
 * entirely in the transport. It is not an authenticator, so unlike the qBT
 * adapter there is no login step and nothing to retry on credential expiry.
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
    this.baseUrl = buildBaseUrl(host, port, ssl)
  }

  async testConnection(): Promise<void> {
    // Drop the cached CSRF id first. An explicit user-initiated test must reach
    // the network, and a stale id is one of the few things a restart of the
    // daemon can leave behind that a test should clear.
    invalidateSessionId(this.baseUrl)
    await testSession(this.baseUrl, this.creds)
  }

  async getTorrents(options?: { tag?: string; filter?: string }): Promise<TorrentRecord[]> {
    const raw = await trGetTorrents(this.baseUrl, this.creds)
    let torrents = raw.map(mapTransmissionTorrent)

    if (options?.tag) {
      // Case-insensitive on both sides, matching parseTorrentTags() and the
      // warm-store path in fetch.ts. qBittorrent's server-side tag filter is
      // case-sensitive; agreeing with the rest of this codebase matters more
      // than reproducing that.
      const wanted = options.tag.trim().toLowerCase()
      torrents = torrents.filter((t) =>
        t.tags
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .includes(wanted)
      )
    }

    // The only filter any caller passes. qBittorrent's "active" means bytes are
    // moving in either direction, which is what this reproduces.
    if (options?.filter === "active") {
      torrents = torrents.filter((t) => t.uploadSpeed > 0 || t.downloadSpeed > 0)
    }

    return torrents
  }

  async getTransferInfo(): Promise<TransferStats> {
    return getSessionStats(this.baseUrl, this.creds)
  }

  dispose(): void {
    invalidateSessionId(this.baseUrl)
  }
}
