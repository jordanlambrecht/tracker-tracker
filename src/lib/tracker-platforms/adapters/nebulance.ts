// src/lib/tracker-platforms/adapters/nebulance.ts
//
// Handles Nebulance-family APIs (Nebulance, Anthelion). Differences:
//   - Auth param: Nebulance uses "api_key", Anthelion uses "apikey"
//   - SubClass field: Nebulance "SubClass" (singular), Anthelion "SubClasses" (plural)
//   - HnR field: present on Nebulance, absent on Anthelion
//   - Orbs (bonus points): sent by Anthelion, possibly absent on Nebulance
//   - Response may be wrapped {"status":"success","response":{...}} or flat

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import type {
  DebugApiCall,
  FetchOptions,
  NebulancePlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { adapterRequest } from "../helpers/adapter-fetch"
import { requireBytes } from "../helpers/bytes"
import { presentClass } from "../helpers/class-name"
import { pollError } from "../helpers/poll-error"

interface NebulanceUserData {
  ID: number
  Username: string
  Uploaded: number
  Downloaded: number
  SeedCount: number
  HnR?: number
  Orbs?: number
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

/**
 * Both methods hit this endpoint. The auth parameter spelling comes from the
 * registry.
 */
function buildUserInfoRequest(
  baseUrl: string,
  apiToken: string,
  apiPath: string,
  options?: FetchOptions
): { url: URL; endpoint: string } {
  // These APIs return the key owner's data regardless of the user queried, but
  // the lookup target must be a valid user. On first poll (no cached
  // remoteUserId), user ID 1 is the system account, which always exists.
  const userId = options?.remoteUserId ?? 1
  const authParam = options?.nebulanceAuthParam ?? "api_key"

  const url = new URL(apiPath, baseUrl)
  url.searchParams.set("action", "user")
  url.searchParams.set(authParam, apiToken)
  url.searchParams.set("method", "getuserinfo")
  url.searchParams.set("type", "id")
  url.searchParams.set("user", String(userId))

  // The key is deliberately absent from the label shown in the debug view.
  return { url, endpoint: `${apiPath}?action=user&method=getuserinfo&type=id&user=${userId}` }
}

/**
 * The user record and its byte totals, or the error fetchStats fails the poll
 * with. An error body can arrive on a non-2xx or on a 200, and both read their
 * text the same way.
 */
function readUserInfo(
  data: NebulanceResponse,
  ok: boolean,
  status: number,
  hostname: string
): { resp: NebulanceUserData; uploaded: bigint; downloaded: bigint } {
  if (!ok || "error" in data) {
    const err = "error" in data ? data.error : undefined
    const errMsg =
      typeof err === "object" && err !== null
        ? err.message
        : typeof err === "string"
          ? err
          : `HTTP ${status}`
    // Both messages use a shape sanitizeNetworkError recognises, and both
    // keep the tracker's own text.
    if (!ok) {
      throw new Error(`Tracker API error: ${status} ${errMsg}`)
    }
    throw new Error(`Unexpected response from ${hostname}: ${errMsg}`)
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

  return {
    resp,
    uploaded: requireBytes(resp.Uploaded, "Uploaded", hostname),
    downloaded: requireBytes(resp.Downloaded, "Downloaded", hostname),
  }
}

export class NebulanceAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const hostname = new URL(baseUrl).hostname
    const { url } = buildUserInfoRequest(baseUrl, apiToken, apiPath, options)

    // Nebulance returns HTTP error codes (400/401/404) with {"error": {"code": N, "message": "..."}}
    // and user data directly on success (no {"status": "success", "response": {...}} wrapper).
    // adapterRequest hands the non-2xx back rather than throwing, so the error
    // body below is still readable.
    const result = await adapterRequest(url.toString(), hostname, options)
    const data = await result.json<NebulanceResponse>()
    const { resp, uploaded, downloaded } = readUserInfo(data, result.ok, result.status, hostname)

    const ratio = computeRatio(uploaded, downloaded)

    const platformMeta: NebulancePlatformMeta = {
      snatched: resp.Snatched ?? undefined,
      grabbed: resp.Grabbed ?? undefined,
      forumPosts: resp.ForumPosts ?? undefined,
      invites: resp.Invites ?? undefined,
    }

    const className = presentClass(resp.Class)
    const subClass = resp.SubClasses ?? resp.SubClass

    return {
      username: resp.Username,
      // A SubClass without a Class is no class, not "undefined / VIP".
      group: className && subClass ? `${className} / ${subClass}` : className,
      remoteUserId: resp.ID,
      uploadedBytes: uploaded,
      downloadedBytes: downloaded,
      ratio,
      bufferBytes: computeBufferBytes(uploaded, downloaded),
      seedingCount: resp.SeedCount ?? null,
      leechingCount: null, // Not available from Nebulance API
      seedbonus: resp.Orbs ?? null,
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
    const { url, endpoint } = buildUserInfoRequest(baseUrl, apiToken, apiPath, options)

    try {
      const result = await adapterRequest(url.toString(), hostname, options)
      // The body is read on a non-2xx too, since the poll's error quotes its
      // message.
      const data = await result.json<NebulanceResponse>()
      return [
        {
          label: "User Info",
          endpoint,
          data,
          error: pollError(() => readUserInfo(data, result.ok, result.status, hostname)),
        },
      ]
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
