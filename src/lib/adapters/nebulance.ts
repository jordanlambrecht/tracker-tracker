// src/lib/adapters/nebulance.ts
//
// Handles Nebulance-family APIs (Nebulance, Anthelion). Differences:
//   - Auth param: Nebulance uses "api_key", Anthelion uses "apikey"
//   - SubClass field: Nebulance "SubClass" (singular), Anthelion "SubClasses" (plural)
//   - HnR field: present on Nebulance, absent on Anthelion
//   - Response may be wrapped {"status":"success","response":{...}} or flat

import { computeBufferBytes, computeRatio, floatBytesToBigInt } from "@/lib/data-transforms"
import { classifyFetchError } from "@/lib/error-utils"
import { adapterRequest } from "./adapter-fetch"
import type {
  DebugApiCall,
  FetchOptions,
  NebulancePlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "./types"

interface NebulanceUserData {
  ID: number
  Username: string
  Uploaded: number
  Downloaded: number
  SeedCount: number
  HnR?: number
  Invites: number
  Class: string
  SubClass?: string | null
  SubClasses?: string | null
  JoinDate: string
  Grabbed: number
  Snatched: number
  ForumPosts: number
  LastAccess?: string
}

interface NebulanceWrappedResponse {
  status: "success"
  response: NebulanceUserData
}

interface NebulanceErrorResponse {
  status?: string
  error?: { code: number; message: string } | string
}

type NebulanceResponse = NebulanceWrappedResponse | NebulanceErrorResponse | NebulanceUserData

export class NebulanceAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const hostname = new URL(baseUrl).hostname

    // These APIs return the key owner's data regardless of the user queried, but
    // the lookup target must be a valid user. On first poll (no cached remoteUserId),
    // use user ID 1 (system/admin account: always exists on Gazelle-derived sites).
    const userId = options?.remoteUserId ?? 1

    // Anthelion uses "apikey" (no underscore), Nebulance uses "api_key"
    const isAnthelion = hostname.includes("anthelion")
    const authParam = isAnthelion ? "apikey" : "api_key"

    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("action", "user")
    url.searchParams.set(authParam, apiToken)
    url.searchParams.set("method", "getuserinfo")
    url.searchParams.set("type", "id")
    url.searchParams.set("user", String(userId))

    // Nebulance returns HTTP error codes (400/401/404) with {"error": {"code": N, "message": "..."}}
    // and user data directly on success (no {"status": "success", "response": {...}} wrapper).
    // adapterRequest hands the non-2xx back rather than throwing, so the error
    // body below is still readable.
    const result = await adapterRequest(url.toString(), hostname, options)
    const ok = result.ok
    const status = result.status
    let data: NebulanceResponse

    try {
      data = await result.json<NebulanceResponse>()
    } catch (err) {
      // Transport failures are already classified by adapterRequest; only a
      // malformed body reaches here.
      throw classifyFetchError(err, hostname)
    }

    if (!ok || "error" in data) {
      const err = "error" in data ? data.error : undefined
      const errMsg =
        typeof err === "object" && err !== null
          ? err.message
          : typeof err === "string"
            ? err
            : `HTTP ${status}`
      throw new Error(`${hostname} API error: ${errMsg}`)
    }

    // Handle both wrapped {"status":"success","response":{...}} and flat response
    let resp: NebulanceUserData
    if ("response" in data && (data as NebulanceWrappedResponse).response?.Username) {
      resp = (data as NebulanceWrappedResponse).response
    } else if ("Username" in data && (data as NebulanceUserData).Username) {
      resp = data as NebulanceUserData
    } else {
      throw new Error(`Unexpected response from ${hostname}: missing user data`)
    }

    const uploaded = floatBytesToBigInt(resp.Uploaded)
    const downloaded = floatBytesToBigInt(resp.Downloaded)

    // Shared derivation, but Nebulance keeps its historical 2dp rounding for
    // finite ratios. Infinity passes through untouched.
    const rawRatio = computeRatio(uploaded, downloaded)
    const ratio = Number.isFinite(rawRatio) ? Math.round(rawRatio * 100) / 100 : rawRatio

    const platformMeta: NebulancePlatformMeta = {
      snatched: resp.Snatched ?? undefined,
      grabbed: resp.Grabbed ?? undefined,
      forumPosts: resp.ForumPosts ?? undefined,
      invites: resp.Invites ?? undefined,
    }

    return {
      username: resp.Username,
      group:
        (resp.SubClasses ?? resp.SubClass)
          ? `${resp.Class} / ${resp.SubClasses ?? resp.SubClass}`
          : (resp.Class ?? "Unknown"),
      remoteUserId: resp.ID,
      uploadedBytes: uploaded,
      downloadedBytes: downloaded,
      ratio,
      bufferBytes: computeBufferBytes(uploaded, downloaded),
      seedingCount: resp.SeedCount ?? 0,
      leechingCount: 0, // Not available from Nebulance API
      seedbonus: null, // Not available from Nebulance API
      hitAndRuns: resp.HnR ?? null,
      requiredRatio: null, // Not available from Nebulance API
      warned: null, // Not available from Nebulance API
      freeleechTokens: null, // Not available from Nebulance API
      joinedDate: resp.JoinDate ?? undefined,
      lastAccessDate: resp.LastAccess ?? undefined,
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
    const userId = options?.remoteUserId ?? 1

    const isAnthelion = hostname.includes("anthelion")
    const authParam = isAnthelion ? "apikey" : "api_key"

    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("action", "user")
    url.searchParams.set(authParam, apiToken)
    url.searchParams.set("method", "getuserinfo")
    url.searchParams.set("type", "id")
    url.searchParams.set("user", String(userId))

    const endpoint = `${apiPath}?action=user&method=getuserinfo&user=${userId}`

    try {
      const result = await adapterRequest(url.toString(), hostname, options)
      const data = await result.json()

      return [{ label: "User Info", endpoint, data, error: null }]
    } catch (err) {
      return [
        {
          label: "User Info",
          endpoint,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
