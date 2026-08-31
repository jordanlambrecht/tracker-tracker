// src/lib/download-clients/adapters/qbt.ts

import { mapQbtDelta, mapQbtTorrent } from "../field-map"
import {
  buildBaseUrl,
  clearAuthBlocks,
  invalidateSession,
  login,
  type QbtAuth,
  getTorrents as qbtGetTorrents,
  getTransferInfo as qbtGetTransferInfo,
  syncMaindata,
  withSessionRetry,
} from "../qbt/transport"
import type {
  ClientAdapter,
  ClientCredentials,
  DeltaSyncResponse,
  TorrentRecord,
  TransferStats,
} from "../types"

/**
 * qBittorrent adapter. Wraps the existing transport layer, managing SID
 * session cookies internally via withSessionRetry. Returns normalized
 * TorrentRecord/DeltaSyncResponse shapes (camelCase) rather than raw qBT types.
 *
 * API-key clients (qBittorrent 5.2.0+) skip the session machinery entirely,
 * a Bearer key is stateless, so there is nothing to log in for, cache, or
 * retry on expiry. withAuth() is the single place that distinction is made.
 */
export class QbtClientAdapter implements ClientAdapter {
  readonly type = "qbittorrent" as const
  readonly baseUrl: string

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly ssl: boolean,
    private readonly creds: ClientCredentials
  ) {
    this.baseUrl = buildBaseUrl(host, port, ssl)
  }

  /**
   * Resolve credentials to a QbtAuth and run `op` with it. Password clients go
   * through withSessionRetry so an expired SID is refreshed once; key clients
   * call straight through.
   */
  private withAuth<T>(op: (baseUrl: string, auth: QbtAuth) => Promise<T>): Promise<T> {
    if (this.creds.authMethod === "apikey") {
      return op(this.baseUrl, { mode: "apikey", key: this.creds.apiKey })
    }
    const { username, password } = this.creds
    return withSessionRetry(this.host, this.port, this.ssl, username, password, (baseUrl, sid) =>
      op(baseUrl, { mode: "session", sid })
    )
  }

  async testConnection(): Promise<void> {
    invalidateSession(this.baseUrl)
    // An explicit user-initiated test must always reach the network: the fix
    // may have been on the qBittorrent side (enabling localhost bypass, a ban
    // expiring, or a key being re-issued), which no amount of credential
    // comparison can detect. Clears password and API-key blocks alike.
    clearAuthBlocks(this.baseUrl)

    if (this.creds.authMethod === "apikey") {
      await qbtGetTransferInfo(this.baseUrl, { mode: "apikey", key: this.creds.apiKey })
      return
    }
    const { username, password } = this.creds
    const sid = await login(this.host, this.port, this.ssl, username, password)
    await qbtGetTransferInfo(this.baseUrl, { mode: "session", sid })
  }

  async getTorrents(options?: { tag?: string; filter?: string }): Promise<TorrentRecord[]> {
    const raw = await this.withAuth((baseUrl, auth) =>
      qbtGetTorrents(baseUrl, auth, options?.tag, options?.filter)
    )
    return raw.map((t) => mapQbtTorrent(t as unknown as Record<string, unknown>))
  }

  async getTransferInfo(): Promise<TransferStats> {
    const info = await this.withAuth((baseUrl, auth) => qbtGetTransferInfo(baseUrl, auth))
    return { uploadSpeed: info.up_info_speed, downloadSpeed: info.dl_info_speed }
  }

  async getDeltaSync(rid: number): Promise<DeltaSyncResponse> {
    const raw = await this.withAuth((baseUrl, auth) => syncMaindata(baseUrl, auth, rid))
    return {
      rid: raw.rid,
      fullUpdate: raw.full_update,
      torrents: raw.torrents
        ? Object.fromEntries(
            Object.entries(raw.torrents).map(([hash, partial]) => [
              hash,
              mapQbtDelta(partial as Record<string, unknown>),
            ])
          )
        : undefined,
      torrentsRemoved: raw.torrents_removed,
      serverState: raw.server_state
        ? {
            uploadSpeed: (raw.server_state as Record<string, number>).up_info_speed ?? 0,
            downloadSpeed: (raw.server_state as Record<string, number>).dl_info_speed ?? 0,
          }
        : undefined,
      tags: raw.tags,
      tagsRemoved: raw.tags_removed,
      categories: raw.categories,
      categoriesRemoved: raw.categories_removed,
    }
  }

  dispose(): void {
    invalidateSession(this.baseUrl)
  }
}
