// src/lib/download-clients/types.ts

export const VALID_CLIENT_TYPES = ["qbittorrent", "transmission"] as const

export type ClientType = (typeof VALID_CLIENT_TYPES)[number]

/** The port each client's web API listens on out of the box. */
export const DEFAULT_CLIENT_PORTS: Record<ClientType, number> = {
  qbittorrent: 8080,
  transmission: 9091,
}

/** Transmission's RPC takes HTTP Basic and nothing else. */
export function clientSupportsApiKey(type: string): boolean {
  return type === "qbittorrent"
}

export const VALID_AUTH_METHODS = ["password", "apikey"] as const

export type AuthMethod = (typeof VALID_AUTH_METHODS)[number]

/** Global transfer speed stats. */
export interface TransferStats {
  uploadSpeed: number // bytes/sec
  downloadSpeed: number // bytes/sec
}

/** Normalized torrent shape. All field names are camelCase regardless of client origin. */
export interface TorrentRecord {
  hash: string
  name: string
  state: string // "uploading", "stalledUP", "downloading", "stalledDL", "stoppedUP", "stoppedDL", etc.
  tags: string // comma-separated, i.e "aither, cross-seed"
  category: string
  uploadSpeed: number // bytes/sec
  downloadSpeed: number // bytes/sec
  uploaded: number // total bytes uploaded
  downloaded: number // total bytes downloaded
  // -1 means infinite: uploaded with nothing downloaded and no pieces held.
  // Adapters map their own infinity to -1 and any not-applicable value to 0.
  ratio: number
  size: number // bytes
  seedCount: number // connected seeds
  leechCount: number // connected leechers
  swarmSeeders: number // total seeders in swarm; connected ones only for Transmission
  swarmLeechers: number // total leechers in swarm; connected ones only for Transmission
  tracker: string // announce URL (qBittorrent) or announce host (Transmission)
  addedAt: number // unix timestamp. When torrent was added
  completedAt: number // unix timestamp. When download completed (-1 if incomplete)
  lastActivityAt: number // unix timestamp. Last transfer activity
  seedingTime: number // seconds spent seeding
  activeTime: number // seconds total active time
  lastSeenComplete: number // unix timestamp. Last time a complete copy was seen in swarm
  availability: number // float 0-1, piece availability
  remaining: number // bytes remaining to download
  progress: number // float 0-1, download progress
  contentPath: string // full path to content
  savePath: string // save directory
  isPrivate?: boolean
}

/** Normalized delta sync response. torrents values use TorrentRecord field names. */
export interface DeltaSyncResponse {
  rid: number
  fullUpdate?: boolean
  torrents?: Record<string, Partial<TorrentRecord>>
  torrentsRemoved?: string[]
  serverState?: Partial<TransferStats>
  tags?: string[]
  tagsRemoved?: string[]
  categories?: Record<string, { name: string; savePath: string }>
  categoriesRemoved?: string[]
}

/** Minimal DB row shape needed to construct a ClientAdapter. */
export interface DownloadClientRow {
  name: string
  host: string
  port: number
  useSsl: boolean
  authMethod: string
  encryptedUsername: string
  encryptedPassword: string
  encryptedApiKey: string
  encryptedUrlPath: string
  crossSeedTags: string[] | null
  type: string
}

export function assertClientType(type: string): ClientType {
  if (!(VALID_CLIENT_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Unsupported client type: "${type}"`)
  }
  return type as ClientType
}

export function assertAuthMethod(authMethod: string): AuthMethod {
  if (!(VALID_AUTH_METHODS as readonly string[]).includes(authMethod)) {
    throw new Error(`Unsupported auth method: "${authMethod}"`)
  }
  return authMethod as AuthMethod
}

/**
 * Decrypted client credentials, shaped by auth method. Modelling this as a
 * union rather than a bag of optional fields means the mode and the secret it
 * describes can never disagree: reading `apiKey` off a password client, or
 * `password` off a key client, is a compile error.
 *
 * `credentialKey` names the saved credential without holding the secret. It is
 * built from the stored ciphertext, which changes on every save, and keys the
 * auth blocks and qBittorrent's session cache.
 */
export type ClientCredentials =
  | {
      authMethod: "password"
      username: string
      password: string
      urlPath: string
      credentialKey: string
    }
  | { authMethod: "apikey"; apiKey: string; urlPath: string; credentialKey: string }

/**
 * Download client adapter interface. Adapters produce TorrentRecord-shaped
 * output so downstream code (charts, aggregation, merge) is client-agnostic.
 *
 * Session management is internal to each adapter. Callers don't manage sessions.
 */
export interface ClientAdapter {
  /** Client type identifier. */
  readonly type: ClientType

  /** Test that the client is reachable and credentials are valid. Throws on failure. */
  testConnection(): Promise<void>

  /**
   * Fetch torrents, optionally filtered by tag or activity state. Single tag
   * only; multi-tag fan-out is the caller's job.
   *
   * `signal` is the caller's own deadline. Without it, a client past its
   * deadline is abandoned rather than cancelled and holds its socket open until
   * the transport timeout.
   */
  getTorrents(options?: {
    tag?: string
    filter?: string
    signal?: AbortSignal
  }): Promise<TorrentRecord[]>

  /** Fetch global upload/download speeds. */
  getTransferInfo(): Promise<TransferStats>

  /**
   * Get incremental changes since the given revision ID.
   * Only implemented by clients that support delta sync (i.e. qBittorrent maindata).
   * Callers check method existence: `if (adapter.getDeltaSync) { ... }`
   * Returns a normalized DeltaSyncResponse with TorrentRecord field names.
   */
  getDeltaSync?(rid: number): Promise<DeltaSyncResponse>

  /** Base URL for this client (used as sync store key). */
  readonly baseUrl: string

  /**
   * Drop everything cached under this client's URL. Called when the client's
   * address changes or the client is deleted. Stopping the scheduler clears
   * every client at once instead.
   */
  dispose(): void
}
