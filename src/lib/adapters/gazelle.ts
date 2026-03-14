// src/lib/adapters/gazelle.ts
//
// Functions: GazelleAdapter, GazelleAdapter.fetchStats, GazelleAdapter.fetchRaw

import { adapterFetch } from "./adapter-fetch"
import type { FetchOptions, GazellePlatformMeta, TrackerAdapter, TrackerStats } from "./types"

interface GazelleUserStats {
  uploaded: number
  downloaded: number
  ratio: number
  requiredratio?: number
  class: string
  bonusPoints?: number
  bonuspoints?: number
  seedingcount?: number
  leechingcount?: number
  freeleechTokens?: number
}

interface GazelleIndexResponse {
  status: string
  error?: string
  response?: {
    username: string
    id: number
    giftTokens?: number
    meritTokens?: number
    notifications?: {
      messages: number
      notifications: number
      newAnnouncement: boolean
      newBlog: boolean
      newSubscriptions?: boolean
    }
    userstats: GazelleUserStats
  }
}

interface GazelleUserResponse {
  status: string
  error?: string
  response?: {
    username: string
    avatar: string
    stats: {
      joinedDate: string
      lastAccess: string
      uploaded: number
      downloaded: number
      ratio: number
      buffer: number
      requiredRatio: number
    }
    ranks: {
      uploaded: number
      downloaded: number
      uploads: number
      requests: number
      bounty: number
      posts: number
      artists: number
      overall: number
    }
    personal: {
      class: string
      paranoia: number
      paranoiaText: string
      donor: boolean
      warned: boolean
      enabled: boolean
    }
    community: {
      posts: number
      torrentComments: number
      artistComments?: number
      collageComments?: number
      requestComments?: number
      collagesStarted: number
      collagesContrib: number
      requestsFilled: number
      requestsVoted: number
      perfectFlacs: number
      uploaded: number
      groups: number
      seeding: number
      leeching: number
      snatched: number
      invited: number
      bountyEarned: number | null
      bountySpent: number | null
    }
  }
}

export class GazelleAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("action", "index")

    const hostname = new URL(baseUrl).hostname
    const authHeader = options?.authStyle === "raw" ? apiToken : `token ${apiToken}`

    const data = await adapterFetch<GazelleIndexResponse>(
      url.toString(),
      hostname,
      options,
      { Authorization: authHeader }
    )

    if (data.status !== "success") {
      throw new Error(data.error ?? `Gazelle API returned status: ${data.status}`)
    }

    const response = data.response
    if (!response) {
      throw new Error(`Unexpected response from ${hostname}: missing response`)
    }

    const userStats = response.userstats
    if (!userStats) {
      throw new Error(`Unexpected response from ${hostname}: missing userstats`)
    }

    const uploaded = BigInt(Math.floor(userStats.uploaded ?? 0))
    const downloaded = BigInt(Math.floor(userStats.downloaded ?? 0))

    const stats: TrackerStats = {
      username: response.username,
      group: userStats.class ?? "Unknown",
      uploadedBytes: uploaded,
      downloadedBytes: downloaded,
      ratio: typeof userStats.ratio === "number" ? userStats.ratio : 0,
      bufferBytes: uploaded > downloaded ? uploaded - downloaded : BigInt(0),
      seedingCount: userStats.seedingcount ?? 0,
      leechingCount: userStats.leechingcount ?? 0,
      seedbonus: userStats.bonusPoints ?? userStats.bonuspoints ?? null,
      hitAndRuns: null,
      requiredRatio: typeof userStats.requiredratio === "number" ? userStats.requiredratio : null,
      warned: false,
      freeleechTokens: typeof userStats.freeleechTokens === "number"
        ? userStats.freeleechTokens
        : typeof response.giftTokens === "number"
          ? response.giftTokens
          : null,
    }

    // Cache the remote user ID from the index response
    if (response.id) {
      stats.remoteUserId = response.id
    }

    // Enrichment: fetch full user profile for ranks, community, warned, etc.
    if (options?.enrich) {
      const userId = options.remoteUserId ?? response.id
      if (userId) {
        try {
          const enriched = await this.fetchUserProfile(baseUrl, apiPath, authHeader, userId, hostname, options)
          if (enriched) {
            // Override core stats with richer data from user profile
            if (typeof enriched.warned === "boolean") stats.warned = enriched.warned
            if (enriched.joinedDate) stats.joinedDate = enriched.joinedDate
            if (enriched.lastAccessDate) stats.lastAccessDate = enriched.lastAccessDate
            if (enriched.bufferBytes != null) stats.bufferBytes = enriched.bufferBytes
            if (typeof enriched.seedingCount === "number") stats.seedingCount = enriched.seedingCount
            if (typeof enriched.leechingCount === "number") stats.leechingCount = enriched.leechingCount
            if (enriched.avatarUrl) stats.avatarUrl = enriched.avatarUrl
            stats.platformMeta = enriched.platformMeta
          }
        } catch { // security-audit-ignore: enrichment failure is non-fatal — core stats from index are still valid
        }
      }
    }

    // Merge index-level data (notifications, tokens) into platformMeta
    if (response.notifications || response.giftTokens != null || response.meritTokens != null) {
      const meta = (stats.platformMeta as GazellePlatformMeta) ?? {}
      if (response.notifications) meta.notifications = response.notifications
      if (typeof response.giftTokens === "number") meta.giftTokens = response.giftTokens
      if (typeof response.meritTokens === "number") meta.meritTokens = response.meritTokens
      stats.platformMeta = meta
    }

    return stats
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<Record<string, unknown>> {
    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("action", "index")

    const hostname = new URL(baseUrl).hostname
    const authHeader = options?.authStyle === "raw" ? apiToken : `token ${apiToken}`

    const indexData = await adapterFetch<Record<string, unknown>>(
      url.toString(),
      hostname,
      options,
      { Authorization: authHeader }
    )

    const result: Record<string, unknown> = { index: indexData }

    // If we have a remoteUserId, also fetch the user profile
    const indexResponse = indexData.response as { id?: number } | undefined
    const userId = options?.remoteUserId ?? indexResponse?.id
    if (userId) {
      try {
        const userUrl = new URL(apiPath, baseUrl)
        userUrl.searchParams.set("action", "user")
        userUrl.searchParams.set("id", String(userId))
        const userData = await adapterFetch<Record<string, unknown>>(
          userUrl.toString(),
          hostname,
          options,
          { Authorization: authHeader }
        )
        result.user = userData
      } catch {
        // user profile fetch is non-fatal for raw debug
      }
    }

    return result
  }

  private async fetchUserProfile(
    baseUrl: string,
    apiPath: string,
    authHeader: string,
    userId: number,
    hostname: string,
    options?: FetchOptions
  ): Promise<{
    warned: boolean
    joinedDate?: string
    lastAccessDate?: string
    bufferBytes?: bigint
    seedingCount?: number
    leechingCount?: number
    avatarUrl?: string
    platformMeta: GazellePlatformMeta
  } | null> {
    const userUrl = new URL(apiPath, baseUrl)
    userUrl.searchParams.set("action", "user")
    userUrl.searchParams.set("id", String(userId))

    const data = await adapterFetch<GazelleUserResponse>(
      userUrl.toString(),
      hostname,
      options,
      { Authorization: authHeader }
    )

    if (data.status !== "success" || !data.response) return null

    const resp = data.response
    const meta: GazellePlatformMeta = {
      donor: resp.personal?.donor,
      enabled: resp.personal?.enabled,
      paranoia: resp.personal?.paranoia,
      paranoiaText: resp.personal?.paranoiaText,
    }

    if (resp.ranks) {
      meta.ranks = {
        uploaded: resp.ranks.uploaded,
        downloaded: resp.ranks.downloaded,
        uploads: resp.ranks.uploads,
        requests: resp.ranks.requests,
        bounty: resp.ranks.bounty,
        posts: resp.ranks.posts,
        artists: resp.ranks.artists,
        overall: resp.ranks.overall,
      }
    }

    if (resp.community) {
      meta.community = {
        posts: resp.community.posts,
        torrentComments: resp.community.torrentComments,
        artistComments: resp.community.artistComments ?? 0,
        collageComments: resp.community.collageComments ?? 0,
        requestComments: resp.community.requestComments ?? 0,
        collagesStarted: resp.community.collagesStarted,
        collagesContrib: resp.community.collagesContrib,
        requestsFilled: resp.community.requestsFilled,
        requestsVoted: resp.community.requestsVoted,
        perfectFlacs: resp.community.perfectFlacs,
        uploaded: resp.community.uploaded,
        groups: resp.community.groups,
        snatched: resp.community.snatched,
        invited: resp.community.invited,
        bountyEarned: resp.community.bountyEarned ?? null,
        bountySpent: resp.community.bountySpent ?? null,
      }
    }

    return {
      warned: resp.personal?.warned ?? false,
      joinedDate: resp.stats?.joinedDate ?? undefined,
      lastAccessDate: resp.stats?.lastAccess ?? undefined,
      bufferBytes: resp.stats?.buffer != null ? BigInt(Math.floor(resp.stats.buffer)) : undefined,
      seedingCount: resp.community?.seeding,
      leechingCount: resp.community?.leeching,
      avatarUrl: resp.avatar || undefined,
      platformMeta: meta,
    }
  }
}
