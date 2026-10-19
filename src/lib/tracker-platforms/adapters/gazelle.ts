// src/lib/tracker-platforms/adapters/gazelle.ts
//
// Functions: gazelleAuthHeader, readIndex, profileFailure, GazelleAdapter

import { computeBufferBytes, computeRatio, signedFloatBytesToBigInt } from "@/lib/data-transforms"
import { log } from "@/lib/logger"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"
import type {
  DebugApiCall,
  FetchOptions,
  GazellePlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { adapterFetch } from "../helpers/adapter-fetch"
import { requireBytes } from "../helpers/bytes"
import { presentClass } from "../helpers/class-name"
import { pollError } from "../helpers/poll-error"

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

/**
 * Most forks want the "token " prefix; a few take the key raw, which the
 * registry's auth style pins.
 */
function gazelleAuthHeader(apiToken: string, options?: FetchOptions): string {
  const trimmedToken = validateHeaderToken(apiToken)
  return options?.authStyle === "raw" ? trimmedToken : `token ${trimmedToken}`
}

/** The index response and its byte totals, or the error fetchStats fails the poll with. */
function readIndex(
  data: GazelleIndexResponse,
  hostname: string
): {
  response: NonNullable<GazelleIndexResponse["response"]>
  uploaded: bigint
  downloaded: bigint
} {
  if (data.status !== "success") {
    throw new Error(data.error?.trim() || `Gazelle API returned status: ${data.status}`)
  }

  const response = data.response
  if (!response) {
    throw new Error(`Unexpected response from ${hostname}: missing response`)
  }

  const userStats = response.userstats
  if (!userStats) {
    throw new Error(`Unexpected response from ${hostname}: missing userstats`)
  }

  return {
    response,
    uploaded: requireBytes(userStats.uploaded, "uploaded", hostname),
    downloaded: requireBytes(userStats.downloaded, "downloaded", hostname),
  }
}

/** Why a profile reply carries no profile, or null when it does. */
function profileFailure(data: GazelleUserResponse, hostname: string): string | null {
  if (data.status !== "success") {
    return data.error?.trim() || `Gazelle API returned status: ${data.status}`
  }
  return data.response ? null : `Unexpected response from ${hostname}: missing response`
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
    const authHeader = gazelleAuthHeader(apiToken, options)

    const data = await adapterFetch<GazelleIndexResponse>(url.toString(), hostname, options, {
      Authorization: authHeader,
    })

    const { response, uploaded, downloaded } = readIndex(data, hostname)
    const userStats = response.userstats

    const stats: TrackerStats = {
      username: response.username,
      group: presentClass(userStats.class),
      uploadedBytes: uploaded,
      downloadedBytes: downloaded,
      // Derived from byte totals. Gazelle reports -1 for infinite ratio.
      ratio: computeRatio(uploaded, downloaded),
      bufferBytes: computeBufferBytes(uploaded, downloaded),
      // Redacted's index carries neither field, so both stay null unless
      // enrichment supplies a count.
      seedingCount: userStats.seedingcount ?? null,
      leechingCount: userStats.leechingcount ?? null,
      seedbonus: userStats.bonusPoints ?? userStats.bonuspoints ?? null,
      hitAndRuns: null,
      requiredRatio: typeof userStats.requiredratio === "number" ? userStats.requiredratio : null,
      warned: null,
      freeleechTokens:
        typeof userStats.freeleechTokens === "number"
          ? userStats.freeleechTokens
          : typeof response.giftTokens === "number"
            ? response.giftTokens
            : null,
    }

    // Cache the remote user ID from the index response
    if (response.id) {
      stats.remoteUserId = response.id
    }

    // Built from this poll's reads and always returned, so a failed profile call
    // clears the profile fields instead of the scheduler keeping the last poll's.
    let meta: GazellePlatformMeta = {}

    // Enrichment: fetch full user profile for ranks, community, warned, etc.
    if (options?.enrich) {
      const userId = options.remoteUserId ?? response.id
      if (userId) {
        try {
          // Brief pause between API calls to avoid rate-limiting on strict Gazelle sites
          await new Promise((r) => setTimeout(r, 1500))
          const enriched = await this.fetchUserProfile(
            baseUrl,
            apiPath,
            authHeader,
            userId,
            hostname,
            options
          )
          if (enriched) {
            // Override core stats with richer data from user profile
            if (typeof enriched.warned === "boolean") stats.warned = enriched.warned
            if (enriched.joinedDate) stats.joinedDate = enriched.joinedDate
            if (enriched.lastAccessDate) stats.lastAccessDate = enriched.lastAccessDate
            if (enriched.bufferBytes != null) stats.bufferBytes = enriched.bufferBytes
            if (typeof enriched.seedingCount === "number")
              stats.seedingCount = enriched.seedingCount
            if (typeof enriched.leechingCount === "number")
              stats.leechingCount = enriched.leechingCount
            if (enriched.avatarUrl) stats.avatarUrl = enriched.avatarUrl
            meta = enriched.platformMeta
          }
        } catch (err) {
          // Enrichment failure is non-fatal; core stats from index still
          // stand. Through log, not console, so the in-app event feed sees it.
          log.warn({ err, hostname }, "gazelle: enrichment failed, core stats kept")
        }
      }
    }

    // Index-level data (notifications, tokens)
    if (response.notifications) meta.notifications = response.notifications
    if (typeof response.giftTokens === "number") meta.giftTokens = response.giftTokens
    if (typeof response.meritTokens === "number") meta.meritTokens = response.meritTokens
    stats.platformMeta = meta

    return stats
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const hostname = new URL(baseUrl).hostname
    const authHeader = gazelleAuthHeader(apiToken, options)
    const calls: DebugApiCall[] = []

    // Call 1: Index
    const indexUrl = new URL(apiPath, baseUrl)
    indexUrl.searchParams.set("action", "index")
    let userId = options?.remoteUserId

    try {
      const indexData = await adapterFetch<GazelleIndexResponse>(
        indexUrl.toString(),
        hostname,
        options,
        { Authorization: authHeader }
      )
      const indexError = pollError(() => readIndex(indexData, hostname))
      calls.push({
        label: "Index",
        endpoint: `${apiPath}?action=index`,
        data: indexData,
        error: indexError,
      })
      // The poll stops at an index it rejects, so an id in one does not carry
      // the profile call.
      if (indexError === null) userId ??= indexData.response?.id
    } catch (err) {
      calls.push({
        label: "Index",
        endpoint: `${apiPath}?action=index`,
        data: null,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }

    // Call 2: User Profile (enrichment)
    if (userId) {
      // The same pause fetchStats takes. The debug route runs both methods in
      // one request, so skipping it here means one press issues every call back
      // to back against a site strict enough to need the pause.
      await new Promise((r) => setTimeout(r, 1500))
      const userUrl = new URL(apiPath, baseUrl)
      userUrl.searchParams.set("action", "user")
      userUrl.searchParams.set("id", String(userId))
      const endpoint = `${apiPath}?action=user&id=${userId}`

      try {
        const userData = await adapterFetch<GazelleUserResponse>(
          userUrl.toString(),
          hostname,
          options,
          { Authorization: authHeader }
        )
        calls.push({
          label: "User Profile",
          endpoint,
          data: userData,
          error: profileFailure(userData, hostname),
        })
      } catch (err) {
        calls.push({
          label: "User Profile",
          endpoint,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        })
      }
    } else {
      // readIndex does not require the id, so a healthy index can lack one.
      calls.push({
        label: "User Profile",
        endpoint: `${apiPath}?action=user`,
        data: null,
        error:
          calls[0].error === null
            ? "Skipped: Index carried no user id"
            : "Skipped: Index failed and no user id is cached",
      })
    }

    return calls
  }

  private async fetchUserProfile(
    baseUrl: string,
    apiPath: string,
    authHeader: string,
    userId: number,
    hostname: string,
    options?: FetchOptions
  ): Promise<{
    // null, not false: an enrichment that did not carry the flag must not
    // overwrite the honest null the first call set.
    warned: boolean | null
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

    const data = await adapterFetch<GazelleUserResponse>(userUrl.toString(), hostname, options, {
      Authorization: authHeader,
    })

    const failure = profileFailure(data, hostname)
    const resp = data.response
    if (failure !== null || !resp) {
      // The poll keeps its core stats either way, so this line is the only trace
      // of a profile call that came back without a profile.
      log.warn({ hostname, reason: failure }, "gazelle: enrichment returned no profile")
      return null
    }

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
        artistComments: resp.community.artistComments,
        collageComments: resp.community.collageComments,
        requestComments: resp.community.requestComments,
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
      warned: typeof resp.personal?.warned === "boolean" ? resp.personal.warned : null,
      joinedDate: resp.stats?.joinedDate ?? undefined,
      lastAccessDate: resp.stats?.lastAccess ?? undefined,
      // Gazelle's buffer value is signed. It overwrites the derived value in
      // fetchStats. If clamped here, enriched Gazelle sites would report 0 for
      // a deficit despite what the helpers compute.
      bufferBytes:
        resp.stats?.buffer != null ? signedFloatBytesToBigInt(resp.stats.buffer) : undefined,
      seedingCount: resp.community?.seeding,
      leechingCount: resp.community?.leeching,
      avatarUrl: resp.avatar || undefined,
      platformMeta: meta,
    }
  }
}
