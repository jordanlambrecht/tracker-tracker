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
import { envelopeError } from "../helpers/envelope"

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

      if (quickData.status !== "success") {
        throw new Error(quickData.error ?? `GGn API returned status: ${quickData.status}`)
      }
      if (!quickData.response?.id || !quickData.response.username) {
        throw new Error(`Unexpected response from ${hostname}: missing user ID or username`)
      }

      userId = quickData.response.id
      username = quickData.response.username
    }

    // Step 2: full user profile for detailed stats
    const userUrl = ggnUserUrl(apiPath, baseUrl, apiToken, userId)

    const userData = await adapterFetch<GGnUserResponse>(userUrl.toString(), hostname, options)

    if (userData.status !== "success") {
      throw new Error(userData.error ?? `GGn API returned status: ${userData.status}`)
    }

    const resp = userData.response
    if (!resp?.stats) {
      throw new Error(`Unexpected response from ${hostname}: missing stats`)
    }

    const uploaded = requireBytes(resp.stats.uploaded, "uploaded", hostname)
    const downloaded = requireBytes(resp.stats.downloaded, "downloaded", hostname)
    // GGn sends its ratio as a string or a number, and prints an infinity glyph
    // for an account with nothing downloaded. A ratio that does not parse falls
    // back to the byte totals rather than to 0.
    const reported =
      typeof resp.stats.ratio === "number" ? resp.stats.ratio : parseFloat(resp.stats.ratio)
    const ratio = Number.isFinite(reported) ? reported : computeRatio(uploaded, downloaded)

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
      group: resp.personal?.class ?? "Unknown",
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
        const bodyError = envelopeError(quickData)
        calls.push({
          label: "Quick User",
          endpoint: `${apiPath}?request=quick_user`,
          data: quickData,
          error: bodyError,
        })
        // A rejected key answers 200 with no response.id, so without this the
        // second call is skipped and the whole debug view is one green call.
        if (bodyError) return calls
        userId = quickData.response?.id
      } catch (err) {
        calls.push({
          label: "Quick User",
          endpoint: `${apiPath}?request=quick_user`,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        })
        return calls
      }
    }

    // Call 2: Full User Profile
    if (userId) {
      const userUrl = ggnUserUrl(apiPath, baseUrl, apiToken, userId)
      const endpoint = `${apiPath}?request=user&id=${userId}`

      try {
        const userData = await adapterFetch<Record<string, unknown>>(
          userUrl.toString(),
          hostname,
          options
        )
        calls.push({
          label: "User Profile",
          endpoint,
          data: userData,
          error: envelopeError(userData),
        })
      } catch (err) {
        calls.push({
          label: "User Profile",
          endpoint,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        })
      }
    }

    return calls
  }
}
