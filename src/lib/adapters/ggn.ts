// src/lib/adapters/ggn.ts

import { computeBufferBytes, floatBytesToBigInt } from "@/lib/formatters"
import { adapterFetch } from "./adapter-fetch"
import type {
  DebugApiCall,
  FetchOptions,
  GGnPlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "./types"

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
      const quickUrl = new URL(apiPath, baseUrl)
      quickUrl.searchParams.set("request", "quick_user")
      quickUrl.searchParams.set("key", apiToken)

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
    const userUrl = new URL(apiPath, baseUrl)
    userUrl.searchParams.set("request", "user")
    userUrl.searchParams.set("id", String(userId))
    userUrl.searchParams.set("key", apiToken)

    const userData = await adapterFetch<GGnUserResponse>(userUrl.toString(), hostname, options)

    if (userData.status !== "success") {
      throw new Error(userData.error ?? `GGn API returned status: ${userData.status}`)
    }

    const resp = userData.response
    if (!resp?.stats) {
      throw new Error(`Unexpected response from ${hostname}: missing stats`)
    }

    const uploaded = floatBytesToBigInt(resp.stats.uploaded)
    const downloaded = floatBytesToBigInt(resp.stats.downloaded)
    const ratio =
      typeof resp.stats.ratio === "number" ? resp.stats.ratio : parseFloat(resp.stats.ratio) || 0

    const platformMeta: GGnPlatformMeta = {
      donor: resp.personal?.donor ?? false,
      parked: resp.personal?.parked ?? false,
      enabled: resp.personal?.enabled ?? true,
      invites: resp.personal?.invites ?? 0,
      onIRC: resp.stats.onIRC ?? false,
      hourlyGold: resp.community?.hourlyGold ?? 0,
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
      seedingCount: resp.community?.seeding ?? 0,
      leechingCount: resp.community?.leeching ?? 0,
      seedbonus: resp.stats.gold ?? 0,
      hitAndRuns: resp.personal?.hnrs ?? null,
      requiredRatio: typeof resp.stats.requiredRatio === "number" ? resp.stats.requiredRatio : null,
      warned: resp.personal?.warned ?? false,
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
      const quickUrl = new URL(apiPath, baseUrl)
      quickUrl.searchParams.set("request", "quick_user")
      quickUrl.searchParams.set("key", apiToken)

      try {
        const quickData = await adapterFetch<GGnQuickUserResponse>(
          quickUrl.toString(),
          hostname,
          options
        )
        calls.push({
          label: "Quick User",
          endpoint: `${apiPath}?request=quick_user`,
          data: quickData,
          error: null,
        })
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
      const userUrl = new URL(apiPath, baseUrl)
      userUrl.searchParams.set("request", "user")
      userUrl.searchParams.set("id", String(userId))
      userUrl.searchParams.set("key", apiToken)
      const endpoint = `${apiPath}?request=user&id=${userId}`

      try {
        const userData = await adapterFetch<Record<string, unknown>>(
          userUrl.toString(),
          hostname,
          options
        )
        calls.push({ label: "User Profile", endpoint, data: userData, error: null })
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
