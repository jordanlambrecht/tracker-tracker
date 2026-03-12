// src/lib/adapters/nebulance.ts
//
// Handles Nebulance-family APIs (Nebulance, Anthelion). Differences:
//   - Auth param: Nebulance uses "api_key", Anthelion uses "apikey"
//   - SubClass field: Nebulance "SubClass" (singular), Anthelion "SubClasses" (plural)
//   - HnR field: present on Nebulance, absent on Anthelion
//   - Response may be wrapped {"status":"success","response":{...}} or flat
//
// Functions: NebulanceAdapter

import { proxyFetch } from "@/lib/proxy"
import type { FetchOptions, NebulancePlatformMeta, TrackerAdapter, TrackerStats } from "./types"

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
    // use user ID 1 (system/admin account — always exists on Gazelle-derived sites).
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
    // We can't use adapterFetch since it throws on non-200 before we parse the error JSON.
    const headers = { Accept: "application/json" }
    let ok: boolean
    let status: number
    let data: NebulanceResponse

    try {
      if (options?.proxyAgent) {
        const result = await proxyFetch(url.toString(), options.proxyAgent, { headers })
        ok = result.ok
        status = result.status
        data = (await result.json()) as NebulanceResponse
      } else {
        const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15000) })
        ok = response.ok
        status = response.status
        data = (await response.json()) as NebulanceResponse
      }
    } catch (err) {
      if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new Error(`Request to ${hostname} timed out`)
      }
      throw new Error(`Failed to connect to ${hostname}: ${err instanceof Error ? err.message : "Unknown"}`)
    }

    if (!ok || "error" in data) {
      const err = "error" in data ? data.error : undefined
      const errMsg = typeof err === "object" && err !== null ? err.message : typeof err === "string" ? err : `HTTP ${status}`
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

    const uploaded = BigInt(Math.floor(resp.Uploaded ?? 0))
    const downloaded = BigInt(Math.floor(resp.Downloaded ?? 0))

    let ratio: number
    if (downloaded === 0n) {
      ratio = uploaded > 0n ? Infinity : 0
    } else {
      ratio = Math.round((Number(uploaded) / Number(downloaded)) * 100) / 100
    }

    const platformMeta: NebulancePlatformMeta = {
      snatched: resp.Snatched ?? undefined,
      grabbed: resp.Grabbed ?? undefined,
      forumPosts: resp.ForumPosts ?? undefined,
      invites: resp.Invites ?? undefined,
    }

    return {
      username: resp.Username,
      group: (resp.SubClasses ?? resp.SubClass) ? `${resp.Class} / ${resp.SubClasses ?? resp.SubClass}` : (resp.Class ?? "Unknown"),
      remoteUserId: resp.ID,
      uploadedBytes: uploaded,
      downloadedBytes: downloaded,
      ratio,
      bufferBytes: uploaded > downloaded ? uploaded - downloaded : 0n,
      seedingCount: resp.SeedCount ?? 0,
      leechingCount: 0, // Not available from Nebulance API
      seedbonus: null, // Not available from Nebulance API
      hitAndRuns: resp.HnR ?? 0,
      requiredRatio: null, // Not available from Nebulance API
      warned: null, // Not available from Nebulance API
      freeleechTokens: null, // Not available from Nebulance API
      joinedDate: resp.JoinDate ?? undefined,
      platformMeta,
    }
  }
}
