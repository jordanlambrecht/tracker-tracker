// src/lib/tracker-platforms/adapters/ggn.ts

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import type {
  DebugApiCall,
  FetchOptions,
  GGnPlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { adapterFetch } from "../helpers/adapter-fetch"
import { requireBytes } from "../helpers/bytes"
import { presentClass } from "../helpers/class-name"
import { pollError } from "../helpers/poll-error"

interface GGnQuickUserResponse {
  status: string
  error?: string
  response?: {
    username: string
    id: number
  }
}

interface GGnUserResponse {
  status: string
  error?: string
  response?: {
    id: number
    username: string
    stats: {
      uploaded: number
      downloaded: number
      ratio: string | number
      requiredRatio: number
      gold: number
      joinedDate: string | null
      lastAccess?: string | null
      onIRC: boolean
      shareScore: number | null
    }
    personal: {
      class: string
      hnrs: number | null
      warned: boolean
      donor: boolean
      enabled: boolean
      parked: boolean
      invites: number | null
    }
    community: {
      seeding: number | null
      leeching: number | null
      hourlyGold: number | null
      snatched: number | null
      uniqueSnatched: number | null
    }
    buffs?: Record<string, number>
    achievements?: {
      userLevel: string
      nextLevel: string
      totalPoints: number
      pointsToNextLvl: number
    }
  }
}

/**
 * GGn authenticates with a key query parameter rather than a header, so the
 * URL is the auth. Both methods build their requests here.
 */
function ggnQuickUserUrl(apiPath: string, baseUrl: string, apiToken: string): URL {
  const url = new URL(apiPath, baseUrl)
  url.searchParams.set("request", "quick_user")
  url.searchParams.set("key", apiToken)
  return url
}

function ggnUserUrl(apiPath: string, baseUrl: string, apiToken: string, userId: number): URL {
  const url = new URL(apiPath, baseUrl)
  url.searchParams.set("request", "user")
  url.searchParams.set("id", String(userId))
  url.searchParams.set("key", apiToken)
  return url
}

/** The user's id and name from quick_user, or the error fetchStats fails the poll with. */
function readQuickUser(
  data: GGnQuickUserResponse,
  hostname: string
): { id: number; username: string } {
  if (data.status !== "success") {
    throw new Error(data.error?.trim() || `GGn API returned status: ${data.status}`)
  }
  if (!data.response?.id || !data.response.username) {
    throw new Error(`Unexpected response from ${hostname}: missing user ID or username`)
  }
  return { id: data.response.id, username: data.response.username }
}

/** The user profile and its byte totals, or the error fetchStats fails the poll with. */
function readUserStats(
  data: GGnUserResponse,
  hostname: string
): { resp: NonNullable<GGnUserResponse["response"]>; uploaded: bigint; downloaded: bigint } {
  if (data.status !== "success") {
    throw new Error(data.error?.trim() || `GGn API returned status: ${data.status}`)
  }

  const resp = data.response
  if (!resp?.stats) {
    throw new Error(`Unexpected response from ${hostname}: missing stats`)
  }

  return {
    resp,
    uploaded: requireBytes(resp.stats.uploaded, "uploaded", hostname),
    downloaded: requireBytes(resp.stats.downloaded, "downloaded", hostname),
  }
}

export class GGnAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const hostname = new URL(baseUrl).hostname

    let userId: number
    let username: string

    if (options?.remoteUserId) {
      // Skip quick_user call because we already resolved this user's ID on a prior poll
      userId = options.remoteUserId
      username = "" // Will be overwritten from the full user response
    } else {
      // Step 1: quick_user to get the user ID (first poll only)
      const quickUrl = ggnQuickUserUrl(apiPath, baseUrl, apiToken)

      const quickData = await adapterFetch<GGnQuickUserResponse>(
        quickUrl.toString(),
        hostname,
        options
      )

      const quickUser = readQuickUser(quickData, hostname)
      userId = quickUser.id
      username = quickUser.username
    }

    // Step 2: full user profile for detailed stats
    const userUrl = ggnUserUrl(apiPath, baseUrl, apiToken, userId)

    const userData = await adapterFetch<GGnUserResponse>(userUrl.toString(), hostname, options)

    const { resp, uploaded, downloaded } = readUserStats(userData, hostname)
    // GGn sends its ratio as a string or a number. An account with nothing
    // downloaded has no quotient to report, and a ratio that does not parse is no
    // figure at all, so both come from the byte totals.
    const reported =
      typeof resp.stats.ratio === "number" ? resp.stats.ratio : parseFloat(resp.stats.ratio)
    const ratio =
      downloaded === 0n || !Number.isFinite(reported)
        ? computeRatio(uploaded, downloaded)
        : reported

    // Every field here is optional on GGnPlatformMeta, so an absent one stays
    // absent and the UI draws its unknown placeholder.
    const platformMeta: GGnPlatformMeta = {
      donor: resp.personal?.donor,
      parked: resp.personal?.parked,
      enabled: resp.personal?.enabled,
      invites: resp.personal?.invites ?? undefined,
      onIRC: resp.stats.onIRC,
      hourlyGold: resp.community?.hourlyGold ?? undefined,
      snatched: resp.community?.snatched ?? undefined,
      uniqueSnatched: resp.community?.uniqueSnatched ?? undefined,
    }
    if (resp.buffs) platformMeta.buffs = resp.buffs
    if (resp.achievements) platformMeta.achievements = resp.achievements

    return {
      username: resp.username || username,
      group: presentClass(resp.personal?.class),
      remoteUserId: userId,
      uploadedBytes: uploaded,
      downloadedBytes: downloaded,
      ratio,
      bufferBytes: computeBufferBytes(uploaded, downloaded),
      seedingCount: resp.community?.seeding ?? null,
      leechingCount: resp.community?.leeching ?? null,
      seedbonus: resp.stats.gold ?? null,
      hitAndRuns: resp.personal?.hnrs ?? null,
      requiredRatio: typeof resp.stats.requiredRatio === "number" ? resp.stats.requiredRatio : null,
      warned: typeof resp.personal?.warned === "boolean" ? resp.personal.warned : null,
      freeleechTokens: null,
      joinedDate: resp.stats.joinedDate ?? undefined,
      lastAccessDate: resp.stats.lastAccess ?? undefined,
      shareScore: resp.stats.shareScore ?? undefined,
      platformMeta,
    }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const hostname = new URL(baseUrl).hostname
    const calls: DebugApiCall[] = []

    let userId: number | undefined = options?.remoteUserId

    // Call 1: Quick User (skip if we already have a cached user ID)
    if (!userId) {
      const quickUrl = ggnQuickUserUrl(apiPath, baseUrl, apiToken)

      try {
        const quickData = await adapterFetch<GGnQuickUserResponse>(
          quickUrl.toString(),
          hostname,
          options
        )
        const bodyError = pollError(() => readQuickUser(quickData, hostname))
        calls.push({
          label: "Quick User",
          endpoint: `${apiPath}?request=quick_user`,
          data: quickData,
          error: bodyError,
        })
        // The poll stops at a body it rejects, so an id in one does not carry
        // the user call.
        if (bodyError === null) userId = quickData.response?.id
      } catch (err) {
        calls.push({
          label: "Quick User",
          endpoint: `${apiPath}?request=quick_user`,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        })
      }
    }

    // Call 2: Full User Profile
    if (userId) {
      const userUrl = ggnUserUrl(apiPath, baseUrl, apiToken, userId)
      const endpoint = `${apiPath}?request=user&id=${userId}`

      try {
        const userData = await adapterFetch<GGnUserResponse>(userUrl.toString(), hostname, options)
        calls.push({
          label: "User Profile",
          endpoint,
          data: userData,
          error: pollError(() => readUserStats(userData, hostname)),
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
      // readQuickUser fails a body with no id, so only a failed Quick User
      // gets here.
      calls.push({
        label: "User Profile",
        endpoint: `${apiPath}?request=user`,
        data: null,
        error: "Skipped: Quick User failed and no user id is cached",
      })
    }

    return calls
  }
}
