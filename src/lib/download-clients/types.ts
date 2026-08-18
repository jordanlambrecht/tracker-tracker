// src/lib/download-clients/types.ts

export const VALID_CLIENT_TYPES = ["qbittorrent"] as const

export type ClientType = (typeof VALID_CLIENT_TYPES)[number]

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
  state: string // "uploading", "stalledUP", "downloading", "stalledDL", "pausedUP", "pausedDL", etc.
  tags: string // comma-separated, i.e "aither, cross-seed"
  category: string
  uploadSpeed: number // bytes/sec
  downloadSpeed: number // bytes/sec
  uploaded: number // total bytes uploaded
  downloaded: number // total bytes downloaded
  ratio: number
  size: number // bytes
  seedCount: number // connected seeds
  leechCount: number // connected leechers
  swarmSeeders: number // total seeders in swarm
  swarmLeechers: number // total leechers in swarm
  tracker: string // primary tracker URL
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
 */
export type ClientCredentials =
  | { authMethod: "password"; username: string; password: string }
  | { authMethod: "apikey"; apiKey: string }

/**
 * Download client adapter interface. Each supported client type (qBittorrent,
 * rTorrent) implements this contract. Adapters produce TorrentRecord-shaped
 * output so downstream code (charts, aggregation, merge) is client-agnostic.
 *
 * Session management is internal to each adapter. qBT uses SID cookies,
 * rTorrent uses Basic Auth per request. Callers don't manage sessions.
 */
export interface ClientAdapter {
  /** Client type identifier. */
  readonly type: ClientType

  /** Test that the client is reachable and credentials are valid. Throws on failure. */
  testConnection(): Promise<void>

  /** Fetch torrents, optionally filtered by tag or activity state.
   *  Note: only handles single-tag filtering. Multi-tag fan-out is the caller's job. */
  getTorrents(options?: { tag?: string; filter?: string }): Promise<TorrentRecord[]>

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

  /** Clean up cached sessions. Called on logout or scheduler stop. */
  dispose(): void
}
