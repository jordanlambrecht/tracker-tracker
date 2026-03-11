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
  seedbonus: number
  hitAndRuns: number
  requiredRatio: number | null
  warned: boolean | null
  freeleechTokens: number | null
  remoteUserId?: number
  joinedDate?: string
  shareScore?: number
  platformMeta?: GGnPlatformMeta | GazellePlatformMeta
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
  collagesStarted: number
  collagesContrib: number
  requestsFilled: number
  requestsVoted: number
  perfectFlacs: number
  uploaded: number
  groups: number
  snatched: number
  invited: number
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

export interface FetchOptions {
  proxyAgent?: HttpAgent
  remoteUserId?: number
  authStyle?: "token" | "raw"
  enrich?: boolean
}

export interface TrackerAdapter {
  fetchStats(baseUrl: string, apiToken: string, apiPath: string, options?: FetchOptions): Promise<TrackerStats>
}
