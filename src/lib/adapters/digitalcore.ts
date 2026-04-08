// src/lib/adapters/digitalcore.ts
//
// Functions: parseDigitalCoreCredentials, dcClassNameFromId, parseJsonSafe,
//            fetchDCJson, DigitalCoreAdapter

import { computeBufferBytes } from "@/lib/data-transforms"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import type {
  DebugApiCall,
  DigitalCorePlatformMeta,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
} from "./types"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

export interface DigitalCoreCredentials {
  uid: string
  pass: string
}

export function parseDigitalCoreCredentials(apiToken: string): DigitalCoreCredentials {
  let parsed: unknown
  try {
    parsed = JSON.parse(apiToken)
  } catch {
    throw new Error("DigitalCore credentials must be a JSON object with uid and pass cookie values")
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).uid !== "string" ||
    typeof (parsed as Record<string, unknown>).pass !== "string"
  ) {
    throw new Error("DigitalCore credentials must contain uid (string) and pass (string)")
  }

  const trimmedUid = (parsed as Record<string, string>).uid.trim()
  const trimmedPass = (parsed as Record<string, string>).pass.trim()
  if (!trimmedUid) throw new Error("DigitalCore credentials: uid cannot be empty")
  if (!trimmedPass) throw new Error("DigitalCore credentials: pass cannot be empty")

  // Guard against header injection via cookie values
  const unsafeChars = /[;\r\n]/
  if (unsafeChars.test(trimmedUid)) {
    throw new Error(
      "DigitalCore credentials: uid contains invalid characters (semicolons or newlines)"
    )
  }
  if (unsafeChars.test(trimmedPass)) {
    throw new Error(
      "DigitalCore credentials: pass contains invalid characters (semicolons or newlines)"
    )
  }

  return { uid: trimmedUid, pass: trimmedPass }
}

// ---------------------------------------------------------------------------
// Class ID mapping (from DigitalCore's Angular userClasses constant)
// ---------------------------------------------------------------------------

const DC_CLASS_MAP: Record<number, string> = {
  0: "Rogue",
  10: "Sentinel",
  20: "Viceroy",
  30: "Sentry",
  31: "Guardian",
  32: "Vanguard",
  50: "Uploader",
  51: "Titan",
  60: "Developer",
  70: "VIP",
  75: "FLS",
  80: "Moderator",
  90: "Administrator",
}

function dcClassNameFromId(classId: number): string {
  return DC_CLASS_MAP[classId] ?? `Class ${classId}`
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface DCStatusUser {
  id: number
  username: string
  class: number
  avatar: string
  uploaded: number
  downloaded: number
  warned: string
  bonuspoang: number
  hit_and_run_total: number
  hnr: number
  hnr_warned: string
  myseedstotal: number
  invites: number
  donor: string
  seedboxdonor: string
  enabled: string
  leechbonus: number
  parkerad: number
  downloadban: number
  uploadban: number
  connectable: number
  crown: number
  skull: number
  pokal: number
  coin: number
}

interface DCStatusResponse {
  user: DCStatusUser
  settings: { serverTime: number; donatedAmount?: number }
}

interface DCUserResponse {
  id: number
  username: string
  added: string
  last_access: string
  uploaded: number
  downloaded: number
  uploaded_real: number
  downloaded_real: number
  class: number
  avatar: string
  warned: string
  bonuspoang: number
  donor: string
  seedboxdonor: string
  enabled: string
  parkerad: number
  peersSeeder: number
  peersLeecher: number
  torrents: number
  requests: number
  forumPosts: number
  torrentComments: number
  invites: number
  invitees: number
  leechbonus: number
  hnr_warned: string
  crown: number
  skull: number
  pokal: number
  coin: number
  hearts: number
}

// ---------------------------------------------------------------------------
// Cookie-based JSON fetcher
// ---------------------------------------------------------------------------

function parseJsonSafe<T>(text: string, pathname: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error(
        "DigitalCore returned HTML instead of JSON (maintenance page or Cloudflare challenge)"
      )
    }
    throw new Error(`DigitalCore returned invalid JSON from ${pathname}`)
  }
}

async function fetchDCJson<T>(
  url: string,
  creds: DigitalCoreCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<T> {
  const parsed = new URL(url)
  const hostname = parsed.hostname
  const headers: Record<string, string> = {
    Cookie: `uid=${creds.uid}; pass=${creds.pass}`,
    Accept: "application/json",
  }

  if (proxyAgent) {
    const { proxyFetch } = await import("@/lib/tunnel")
    const result = await proxyFetch(url, proxyAgent, { headers })

    if (result.status === 401) {
      throw new Error("Session expired. Re-copy uid and pass cookies from your browser.")
    }
    if (!result.ok) {
      throw new Error(
        sanitizeNetworkError(
          `${result.status} ${result.statusText}`,
          `DigitalCore API error: ${result.status}`
        )
      )
    }
    const text = (await result.buffer()).toString("utf8")
    return parseJsonSafe<T>(text, parsed.pathname)
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    const name =
      err !== null && typeof err === "object" && "name" in (err as object)
        ? String((err as { name: unknown }).name)
        : ""
    if (name === "TimeoutError" || name === "AbortError") {
      throw new Error(`Request to ${hostname} timed out`)
    }
    const code =
      err instanceof Error && "code" in err ? (err as NodeJS.ErrnoException).code : undefined
    const detail = code ?? (name || "Unknown")
    throw new Error(`Failed to connect to ${hostname}: ${detail}`)
  }

  if (response.status === 401) {
    throw new Error("Session expired. Re-copy uid and pass cookies from your browser.")
  }

  if (!response.ok) {
    throw new Error(
      sanitizeNetworkError(
        `${response.status} ${response.statusText}`,
        `DigitalCore API error: ${response.status}`
      )
    )
  }

  const text = await response.text()
  return parseJsonSafe<T>(text, parsed.pathname)
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class DigitalCoreAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseDigitalCoreCredentials(apiToken)

    // Call 1: /api/v1/status (core stats)
    const statusUrl = `${baseUrl}/api/v1/status`
    const statusData = await fetchDCJson<DCStatusResponse>(statusUrl, creds, options?.proxyAgent)

    const user = statusData.user
    if (!user?.id) {
      throw new Error("DigitalCore status response missing user data")
    }

    if (typeof user.uploaded !== "number" || typeof user.downloaded !== "number") {
      throw new Error("DigitalCore status response missing upload/download data")
    }

    const uploaded = BigInt(Math.floor(user.uploaded))
    const downloaded = BigInt(Math.floor(user.downloaded))

    // Build baseline platformMeta from status (survives enrichment failure)
    const baseMeta: DigitalCorePlatformMeta = {
      donor: user.donor === "yes",
      seedboxDonor: user.seedboxdonor === "yes",
      parked: user.parkerad === 1,
      enabled: user.enabled === "yes",
      invites: user.invites ?? 0,
      leechBonus: user.leechbonus ?? 0,
      hnr: user.hnr ?? 0,
      hnrWarned: user.hnr_warned === "yes",
      downloadBan: user.downloadban === 1,
      uploadBan: user.uploadban === 1,
      connectable: user.connectable === 1,
      crown: user.crown === 1,
      skull: user.skull === 1,
      pokal: user.pokal === 1,
      coin: user.coin === 1,
    }

    const stats: TrackerStats = {
      username: user.username,
      group: dcClassNameFromId(user.class),
      uploadedBytes: uploaded,
      downloadedBytes: downloaded,
      ratio:
        downloaded === 0n ? (uploaded > 0n ? Infinity : 0) : Number(uploaded) / Number(downloaded),
      bufferBytes: computeBufferBytes(uploaded, downloaded),
      seedingCount: user.myseedstotal ?? 0,
      leechingCount: 0,
      seedbonus: user.bonuspoang ?? 0,
      hitAndRuns: user.hit_and_run_total ?? 0,
      requiredRatio: null,
      warned: user.warned === "yes",
      freeleechTokens: null,
      remoteUserId: user.id,
      avatarUrl: user.avatar || undefined,
      platformMeta: baseMeta,
    }

    // Call 2: /api/v1/users/:id (enrichment)
    const userId = options?.remoteUserId ?? user.id
    try {
      const userUrl = `${baseUrl}/api/v1/users/${userId}`
      const profile = await fetchDCJson<DCUserResponse>(userUrl, creds, options?.proxyAgent)

      stats.joinedDate = profile.added || undefined
      stats.lastAccessDate = profile.last_access || undefined
      stats.leechingCount = profile.peersLeecher ?? 0

      // Override warned from enrichment (more authoritative source)
      stats.warned = profile.warned === "yes"

      stats.platformMeta = {
        ...baseMeta,
        uploadedReal: profile.uploaded_real,
        downloadedReal: profile.downloaded_real,
        torrents: profile.torrents ?? 0,
        requests: profile.requests ?? 0,
        forumPosts: profile.forumPosts ?? 0,
        torrentComments: profile.torrentComments ?? 0,
        invitees: profile.invitees ?? 0,
        hnrWarned: profile.hnr_warned === "yes",
        hearts: profile.hearts ?? 0,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown"
      // Auth failures during enrichment mean the session is degrading. Surface them
      // so the user knows their cookies need refreshing.
      if (msg.includes("Session expired")) {
        throw err
      }
      // Other enrichment failures are non-fatal, core stats + baseMeta from /status are still valid
      console.warn(`[digitalcore] Enrichment failed: ${msg}`)
    }

    return stats
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const creds = parseDigitalCoreCredentials(apiToken)
    const calls: DebugApiCall[] = []

    // Call 1: Status
    let userId: number | undefined = options?.remoteUserId
    try {
      const statusUrl = `${baseUrl}/api/v1/status`
      const statusData = await fetchDCJson<Record<string, unknown>>(
        statusUrl,
        creds,
        options?.proxyAgent
      )
      calls.push({ label: "Status", endpoint: "/api/v1/status", data: statusData, error: null })

      if (!userId) {
        const user = statusData.user as { id?: number } | undefined
        userId = user?.id
      }
    } catch (err) {
      calls.push({
        label: "Status",
        endpoint: "/api/v1/status",
        data: null,
        error: err instanceof Error ? err.message : "Request failed",
      })
      return calls
    }

    // Call 2: User profile
    if (userId) {
      const endpoint = `/api/v1/users/${userId}`
      try {
        const userUrl = `${baseUrl}${endpoint}`
        const userData = await fetchDCJson<Record<string, unknown>>(
          userUrl,
          creds,
          options?.proxyAgent
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
