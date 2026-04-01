// src/lib/adapters/types.ts

import type { Agent as HttpAgent } from "node:http"

export interface TrackerStats {
  username: string
  group: string
  uploadedBytes: bigint
  downloadedBytes: bigint
  ratio: number
  bufferBytes: bigint
  seedingCount: number
  leechingCount: number
  seedbonus: number | null
  hitAndRuns: number | null
  requiredRatio: number | null
  warned: boolean | null
  freeleechTokens: number | null
  remoteUserId?: number
  joinedDate?: string
  lastAccessDate?: string
  shareScore?: number
  avatarUrl?: string
  platformMeta?:
    | GGnPlatformMeta
    | GazellePlatformMeta
    | NebulancePlatformMeta
    | MamPlatformMeta
    | AvistazPlatformMeta
}

export interface GGnPlatformMeta {
  achievements?: {
    userLevel: string
    nextLevel: string
    totalPoints: number
    pointsToNextLvl: number
  }
  buffs?: Record<string, number>
  donor?: boolean
  parked?: boolean
  enabled?: boolean
  invites?: number
  onIRC?: boolean
  hourlyGold?: number
  snatched?: number
  uniqueSnatched?: number
}

export interface GazelleRanks {
  uploaded: number
  downloaded: number
  uploads: number
  requests: number
  bounty: number
  posts: number
  artists: number
  overall: number
}

export interface GazelleCommunity {
  posts: number
  torrentComments: number
  artistComments: number
  collageComments: number
  requestComments: number
  collagesStarted: number
  collagesContrib: number
  requestsFilled: number
  requestsVoted: number
  perfectFlacs: number
  uploaded: number
  groups: number
  snatched: number
  invited: number
  bountyEarned: number | null
  bountySpent: number | null
}

export interface GazellePlatformMeta {
  donor?: boolean
  enabled?: boolean
  paranoia?: number
  paranoiaText?: string
  ranks?: GazelleRanks
  community?: GazelleCommunity
  notifications?: {
    messages: number
    notifications: number
    newAnnouncement: boolean
    newBlog: boolean
  }
  giftTokens?: number
  meritTokens?: number
}

export interface NebulancePlatformMeta {
  snatched?: number
  grabbed?: number
  forumPosts?: number
  invites?: number
}

export interface MamPlatformMeta {
  vipUntil?: string
  connectable?: string
  unsatisfiedCount?: number
  unsatisfiedLimit?: number
  inactiveSatisfiedCount?: number
  seedingHnrCount?: number
  inactiveUnsatisfiedCount?: number
  trackerErrorCount?: number
  recentlyDeleted?: number
  unreadPMs?: number
  openTickets?: number
  pendingRequests?: number
  unreadTopics?: number
}

export interface AvistazPlatformMeta {
  donor?: boolean
  vipExpiry?: string | null
  invites?: number
  canDownload?: boolean
  canUpload?: boolean
  totalUploads?: number
  totalDownloads?: number
  reseedRequests?: number
  twoFactorEnabled?: boolean
  bonusPerHour?: number
  bonusBreakdown?: {
    totalTorrents: { count: number; points: number }
    oldTorrents: { count: number; points: number }
    bigTorrents: { count: number; points: number }
    hugeTorrents: { count: number; points: number }
  }
}

/** Union of all platform-specific metadata types */
export type PlatformMeta =
  | GGnPlatformMeta
  | GazellePlatformMeta
  | NebulancePlatformMeta
  | MamPlatformMeta
  | AvistazPlatformMeta

/** Maps platformType string → the corresponding PlatformMeta variant */
export interface PlatformMetaMap {
  ggn: GGnPlatformMeta
  gazelle: GazellePlatformMeta
  nebulance: NebulancePlatformMeta
  mam: MamPlatformMeta
  avistaz: AvistazPlatformMeta
}

/**
 * Type-safe narrowing of PlatformMeta using the existing platformType discriminant.
 * Returns the narrowed meta if `ctx.tracker.platformType` matches, otherwise `null`.
 */
export function metaFor<P extends keyof PlatformMetaMap>(
  ctx: { tracker: { platformType: string }; meta: PlatformMeta | null },
  platform: P
): PlatformMetaMap[P] | null {
  if (!ctx.meta || ctx.tracker.platformType !== platform) return null
  return ctx.meta as PlatformMetaMap[P]
}

export type GazelleAuthStyle = "token" | "raw"
export type Unit3dAuthStyle = "bearer" | "query"

export interface FetchOptions {
  proxyAgent?: HttpAgent
  remoteUserId?: number
  authStyle?: GazelleAuthStyle
  unit3dAuthStyle?: Unit3dAuthStyle
  enrich?: boolean
}

export interface DebugApiCall {
  label: string
  endpoint: string
  data: unknown | null
  error: string | null
}

export interface TrackerAdapter {
  fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats>
  fetchRaw?(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]>
}
