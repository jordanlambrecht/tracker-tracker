// src/lib/tracker-platforms/adapters/digitalcore.ts
//
// Functions: parseDigitalCoreCredentials, dcFlag, dcClassNameFromId,
//            parseJsonSafe, fetchDCJson, DigitalCoreAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import type {
  DebugApiCall,
  DigitalCorePlatformMeta,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { adapterRequest } from "../helpers/adapter-fetch"
import { SessionExpiredError } from "../helpers/errors"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

export interface DigitalCoreCredentials {
  uid: string
  pass: string
  /**
   * Browser User-Agent the session cookies were copied from. Optional, since
   * blobs saved before this field existed have none and must keep polling.
   */
  userAgent?: string
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

  // Header injection guard. NUL, CR, and LF make undici throw a TypeError that
  // quotes the whole Cookie header, which reaches the log and the debug
  // endpoint; the rest of the control range is rejected without the value but
  // is kept off the wire all the same.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char check
  const unsafeChars = /[;\x00-\x1F\x7F]/
  if (unsafeChars.test(trimmedUid)) {
    throw new Error(
      "DigitalCore credentials: uid contains invalid characters (a semicolon or a control character)"
    )
  }
  if (unsafeChars.test(trimmedPass)) {
    throw new Error(
      "DigitalCore credentials: pass contains invalid characters (a semicolon or a control character)"
    )
  }

  // A non-ASCII character is a DevTools truncation mark, never part of a cookie
  // value. Without this it reaches undici, which throws a TypeError naming the
  // whole header, and classifyFetchError flattens that to a bare name the user
  // cannot act on.
  for (const [field, value] of [
    ["uid", trimmedUid],
    ["pass", trimmedPass],
  ] as const) {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional byte-range check
    const nonAscii = value.match(/[^\x00-\xFF]/)
    if (nonAscii) {
      const code = nonAscii[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")
      throw new Error(
        `DigitalCore credentials: ${field} contains a non-ASCII character ("${nonAscii[0]}", U+${code}) at position ${nonAscii.index}. ` +
          "This usually means the browser truncated the value when copying. Re-copy it from DevTools."
      )
    }
  }

  const rawUserAgent = (parsed as Record<string, unknown>).userAgent
  if (rawUserAgent !== undefined && typeof rawUserAgent !== "string") {
    throw new Error("DigitalCore credentials: userAgent must be a string")
  }
  // Not run through unsafeChars. That guard rejects semicolons because uid and
  // pass are interpolated into a Cookie header, and every real browser UA
  // contains them. CR/LF is left to the request layer, which throws
  // ERR_INVALID_CHAR, matching how avistaz and iptorrents treat their own UA.
  const trimmedUserAgent = rawUserAgent?.trim() ?? ""

  // Blank counts as absent rather than an error. A re-save that produced an
  // empty string should fall back to the default UA, not stop the tracker.
  return trimmedUserAgent
    ? { uid: trimmedUid, pass: trimmedPass, userAgent: trimmedUserAgent }
    : { uid: trimmedUid, pass: trimmedPass }
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

/**
 * DigitalCore spells its booleans as "yes"/"no" strings or 0/1 numbers. An
 * absent field is unknown, so it stays undefined rather than false.
 */
function dcFlag<T extends string | number>(value: T | undefined, truthy: T): boolean | undefined {
  return value === undefined ? undefined : value === truthy
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
  /**
   * Inverted connectability (0 = connectable, 1 = not). Authoritative over
   * `connectable` on /api/v1/status, which can disagree (issue #167).
   */
  unconnectable?: number
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

// Both messages open with "Unexpected response from" so sanitizeNetworkError
// classifies them as a shape problem. Wording that contains "invalid" would
// match its credentials rule instead.
function parseJsonSafe<T>(text: string, pathname: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error(
        `Unexpected response from DigitalCore: HTML instead of JSON (maintenance page or Cloudflare challenge)`
      )
    }
    throw new Error(`Unexpected response from DigitalCore: unparseable JSON from ${pathname}`)
  }
}

async function fetchDCJson<T>(
  url: string,
  creds: DigitalCoreCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<T> {
  const parsed = new URL(url)
  const headers: Record<string, string> = {
    Cookie: `uid=${creds.uid}; pass=${creds.pass}`,
    Accept: "application/json",
    // Sent only when the credential carries one. adapterRequest applies the
    // app default otherwise, matching it case-insensitively so this wins.
    ...(creds.userAgent ? { "User-Agent": creds.userAgent } : {}),
  }

  const response = await adapterRequest(url, parsed.hostname, { proxyAgent }, headers)

  if (response.status === 401) {
    throw new SessionExpiredError(
      "Session expired. Re-copy uid and pass cookies from your browser."
    )
  }

  if (!response.ok) {
    throw new Error(
      sanitizeNetworkError(
        `${response.status} ${response.statusText}`,
        `DigitalCore API error: ${response.status}`
      )
    )
  }

  return parseJsonSafe<T>(await response.text(), parsed.pathname)
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
      donor: dcFlag(user.donor, "yes"),
      seedboxDonor: dcFlag(user.seedboxdonor, "yes"),
      parked: dcFlag(user.parkerad, 1),
      enabled: dcFlag(user.enabled, "yes"),
      // Every field on DigitalCorePlatformMeta is optional, so an absent figure
      // stays absent. A fabricated 0 is indistinguishable from a measured one,
      // which is the same distinction TrackerStats keeps with null.
      invites: user.invites ?? undefined,
      leechBonus: user.leechbonus ?? undefined,
      hnr: user.hnr ?? undefined,
      hnrWarned: dcFlag(user.hnr_warned, "yes"),
      downloadBan: dcFlag(user.downloadban, 1),
      uploadBan: dcFlag(user.uploadban, 1),
      connectable: dcFlag(user.connectable, 1),
      crown: dcFlag(user.crown, 1),
      skull: dcFlag(user.skull, 1),
      pokal: dcFlag(user.pokal, 1),
      coin: dcFlag(user.coin, 1),
    }

    const stats: TrackerStats = {
      username: user.username,
      group: dcClassNameFromId(user.class),
      uploadedBytes: uploaded,
      downloadedBytes: downloaded,
      ratio: computeRatio(uploaded, downloaded),
      bufferBytes: computeBufferBytes(uploaded, downloaded),
      seedingCount: user.myseedstotal ?? null,
      // The status call carries no leeching count, so this is unknown rather
      // than a measured zero. The enrichment call below may supply one.
      leechingCount: null,
      seedbonus: user.bonuspoang ?? null,
      hitAndRuns: user.hit_and_run_total ?? null,
      requiredRatio: null,
      // TrackerStats.warned is boolean | null, so an absent flag is null.
      warned: dcFlag(user.warned, "yes") ?? null,
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
      // Raise the null above to a real figure, never to a fabricated zero: an
      // absent count still means unknown, and a run of zeroes is
      // indistinguishable from an account that stopped leeching. gazelle.ts
      // guards its own enrichment the same way.
      if (typeof profile.peersLeecher === "number") {
        stats.leechingCount = profile.peersLeecher
      }

      // Override warned from enrichment (more authoritative source)
      const enrichedWarned = dcFlag(profile.warned, "yes")
      if (enrichedWarned !== undefined) stats.warned = enrichedWarned

      stats.platformMeta = {
        ...baseMeta,
        // /api/v1/status reports `connectable` and /api/v1/users/:id reports
        // the inverse `unconnectable`. They can disagree, and the profile
        // endpoint wins, as for `warned` above.
        ...(profile.unconnectable !== undefined
          ? { connectable: profile.unconnectable === 0 }
          : {}),
        uploadedReal: profile.uploaded_real,
        downloadedReal: profile.downloaded_real,
        torrents: profile.torrents ?? undefined,
        requests: profile.requests ?? undefined,
        forumPosts: profile.forumPosts ?? undefined,
        torrentComments: profile.torrentComments ?? undefined,
        invitees: profile.invitees ?? undefined,
        hnrWarned: dcFlag(profile.hnr_warned, "yes"),
        hearts: profile.hearts ?? undefined,
      }
    } catch (err) {
      // Auth failures during enrichment mean the session is degrading. Surface them
      // so the user knows their cookies need refreshing.
      if (err instanceof SessionExpiredError) {
        throw err
      }
      // Other enrichment failures are non-fatal, core stats + baseMeta from
      // /status are still valid. Through log, not console: the in-app event
      // feed is built by parsing pino output, so console is invisible there.
      log.warn({ err }, "digitalcore: enrichment failed, core stats kept")
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
