// src/lib/download-clients/adapters/qbt.ts

import { mapQbtDelta, mapQbtTorrent } from "../field-map"
import {
  buildBaseUrl,
  invalidateSession,
  login,
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

  async testConnection(): Promise<void> {
    if (this.creds.authMethod === "apikey") {
      await qbtGetTransferInfo(this.baseUrl, { mode: "apikey", key: this.creds.apiKey })
      return
    }
    invalidateSession(this.baseUrl)
    const sid = await login(this.host, this.port, this.ssl, this.creds.username, this.creds.password)
    await qbtGetTransferInfo(this.baseUrl, { mode: "session", sid })
  }

  async getTorrents(options?: { tag?: string; filter?: string }): Promise<TorrentRecord[]> {
    const raw =
      this.creds.authMethod === "apikey"
        ? await qbtGetTorrents(
            this.baseUrl,
            { mode: "apikey", key: this.creds.apiKey },
            options?.tag,
            options?.filter
          )
        : await withSessionRetry(
            this.host,
            this.port,
            this.ssl,
            this.creds.username,
            this.creds.password,
            (baseUrl, sid) =>
              qbtGetTorrents(baseUrl, { mode: "session", sid }, options?.tag, options?.filter)
          )
    return raw.map((t) => mapQbtTorrent(t as unknown as Record<string, unknown>))
  }

  async getTransferInfo(): Promise<TransferStats> {
    const info =
      this.creds.authMethod === "apikey"
        ? await qbtGetTransferInfo(this.baseUrl, { mode: "apikey", key: this.creds.apiKey })
        : await withSessionRetry(
            this.host,
            this.port,
            this.ssl,
            this.creds.username,
            this.creds.password,
            (baseUrl, sid) => qbtGetTransferInfo(baseUrl, { mode: "session", sid })
          )
    return { uploadSpeed: info.up_info_speed, downloadSpeed: info.dl_info_speed }
  }

  async getDeltaSync(rid: number): Promise<DeltaSyncResponse> {
    const raw =
      this.creds.authMethod === "apikey"
        ? await syncMaindata(this.baseUrl, { mode: "apikey", key: this.creds.apiKey }, rid)
        : await withSessionRetry(
            this.host,
            this.port,
            this.ssl,
            this.creds.username,
            this.creds.password,
            (baseUrl, sid) => syncMaindata(baseUrl, { mode: "session", sid }, rid)
          )
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
    if (this.creds.authMethod === "password") invalidateSession(this.baseUrl)
  }
}
