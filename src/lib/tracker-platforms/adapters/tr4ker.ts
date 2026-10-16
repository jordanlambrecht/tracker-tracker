// src/lib/tracker-platforms/adapters/tr4ker.ts
//
// Functions: Tr4kerAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import type {
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { adapterFetch } from "../helpers/adapter-fetch"
import { requireBytes } from "../helpers/bytes"

// ---------------------------------------------------------------------------
// TR4KER exposes a minimal JSON "me" endpoint. Auth is the documented
// `X-Api-Key` header; the key must not travel in the URL.
// ---------------------------------------------------------------------------

interface Tr4kerApiResponse {
  id: number
  username?: string
  role?: string
  uploaded?: number | null
  downloaded?: number | null
  money?: number | null
  avatar_url?: string | null
  joined_at?: string
  last_seen_at?: string
}

export class Tr4kerAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl).toString()

    const data = await adapterFetch<Tr4kerApiResponse>(url, hostname, options, {
      "X-Api-Key": apiToken,
    })

    // Byte totals are non-nullable on TrackerStats; an absent value must fail
    // the poll rather than store a measured zero (adapter standard 2.1).
    const uploadedBytes = requireBytes(data.uploaded, "uploaded", hostname)
    const downloadedBytes = requireBytes(data.downloaded, "downloaded", hostname)

    // role arrives lowercased ("user"); title-case it for display.
    const role = data.role?.trim()
    const group = role ? role.charAt(0).toUpperCase() + role.slice(1) : "User"

    return {
      username: data.username ?? "",
      group,
      uploadedBytes,
      downloadedBytes,
      // Derived from byte totals, not reported: TR4KER sends no ratio field.
      ratio: computeRatio(uploadedBytes, downloadedBytes),
      bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: null,
      leechingCount: null,
      seedbonus: typeof data.money === "number" ? data.money : null,
      hitAndRuns: null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
      remoteUserId: data.id,
      joinedDate: data.joined_at,
      lastAccessDate: data.last_seen_at,
      avatarUrl: data.avatar_url ?? undefined,
    }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl).toString()

    try {
      const data = await adapterFetch<Record<string, unknown>>(url, hostname, options, {
        "X-Api-Key": apiToken,
      })
      return [{ label: "User Stats", endpoint: apiPath, data, error: null }]
    } catch (err) {
      return [
        {
          label: "User Stats",
          endpoint: apiPath,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
