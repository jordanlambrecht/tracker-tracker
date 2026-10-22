// src/lib/tracker-platforms/adapters/v3x.ts
//
// Functions: parseV3xCredentials, requireBytes, numeric, roleName, dateOnly,
//            parseV3xMe, errorMessage, fetchMe, fetchGamification,
//            applyGamification, V3xAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type {
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
  V3xPlatformMeta,
} from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"

// V3X serves its JSON API from a fixed host, and the web app calls it with
// `credentials: "include"`, so cookie auth is the protocol here.
const API_BASE = "https://api.v3x.club"
const ME_PATH = "/auth/me"
const GAMIFICATION_PATH = "/me/gamification"
const LABEL = "V3X"
const SESSION_EXPIRED = "Session expired. Browser cookies need to be refreshed"

export interface V3xCredentials {
  cookies: string
  userAgent: string
}

export function parseV3xCredentials(apiToken: string): V3xCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, LABEL, [
    "cookies",
    "userAgent",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: ["v3x_session", "__Host-v3x_session", "session"],
      example: "v3x_session=...",
    }),
    userAgent,
  }
}

interface V3xMe {
  username?: string
  role?: string
  status?: string
  uploaded?: number
  downloaded?: number
  downloadedReal?: number
  bonusPoints?: number
  seedTimeSeconds?: number
  freeleechTokens?: number
  createdAt?: string
  ratio?: number
  ratioFloor?: {
    floor?: number
    warnAt?: number
    level?: string
  }
  hnr?: {
    active?: number
    max?: number
    exempt?: boolean
  }
}

interface V3xGamification {
  xp?: number
  level?: number
  prestige?: number
  rank?: {
    key?: string
    label?: string
  }
  nextRank?: {
    label?: string
    atLevel?: number
  }
  into?: number
  need?: number
  maxed?: boolean
  loginStreak?: number
  seedStreak?: number
}

function requireBytes(value: unknown, field: string, hostname: string): bigint {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Unexpected response from ${hostname}: missing ${field}`)
  }
  return BigInt(Math.trunc(value))
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** "power_user" and "power-user" both read as "Power User". */
function roleName(role: unknown): string | null {
  if (typeof role !== "string" || role.trim() === "") return null
  return role
    .trim()
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function dateOnly(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  return value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

export function parseV3xMe(body: V3xMe, hostname: string): TrackerStats {
  const uploadedBytes = requireBytes(body.uploaded, "uploaded", hostname)
  const downloadedBytes = requireBytes(body.downloaded, "downloaded", hostname)
  const reportedRatio = numeric(body.ratio)

  const meta: V3xPlatformMeta = {}
  const floor = numeric(body.ratioFloor?.floor)
  const warnAt = numeric(body.ratioFloor?.warnAt)
  if (floor !== null) meta.ratioFloor = floor
  if (warnAt !== null) meta.ratioWarnAt = warnAt
  if (typeof body.ratioFloor?.level === "string") meta.ratioLevel = body.ratioFloor.level
  if (typeof body.hnr?.max === "number") meta.hnrMax = body.hnr.max
  if (typeof body.seedTimeSeconds === "number") meta.seedTimeSeconds = body.seedTimeSeconds
  if (typeof body.downloadedReal === "number") meta.downloadedReal = body.downloadedReal

  return {
    username: typeof body.username === "string" ? body.username : "",
    group: roleName(body.role),
    uploadedBytes,
    downloadedBytes,
    ratio:
      downloadedBytes === 0n
        ? computeRatio(uploadedBytes, downloadedBytes)
        : (reportedRatio ?? computeRatio(uploadedBytes, downloadedBytes)),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount: null,
    leechingCount: null,
    seedbonus: numeric(body.bonusPoints),
    hitAndRuns: numeric(body.hnr?.active),
    requiredRatio: floor,
    warned: null,
    freeleechTokens: numeric(body.freeleechTokens),
    remoteUserId: undefined,
    joinedDate: dateOnly(body.createdAt),
    lastAccessDate: undefined,
    platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed"
}

async function fetchMe(
  creds: V3xCredentials,
  options?: FetchOptions
): Promise<{ body: V3xMe; hostname: string }> {
  const hostname = "v3x.club"
  let text: string
  try {
    text = await fetchTrackerHtml({
      url: `${API_BASE}${ME_PATH}`,
      cookies: creds.cookies,
      userAgent: creds.userAgent,
      accept: "application/json",
      label: LABEL,
      sessionExpiredMessage: SESSION_EXPIRED,
      proxyAgent: options?.proxyAgent,
    })
  } catch (err) {
    if (err instanceof Error && /\b401\b|\b403\b/.test(err.message)) {
      throw new SessionExpiredError(SESSION_EXPIRED)
    }
    throw err
  }

  let body: V3xMe
  try {
    body = JSON.parse(text) as V3xMe
  } catch {
    throw new Error(`Unexpected response from ${hostname}: not JSON`)
  }
  if (body == null || typeof body !== "object") {
    throw new Error(`Unexpected response from ${hostname}: missing user object`)
  }
  return { body, hostname }
}

/** Optional enrichment: the level, XP and rank live on their own endpoint. */
async function fetchGamification(
  creds: V3xCredentials,
  options?: FetchOptions
): Promise<V3xGamification | null> {
  try {
    const text = await fetchTrackerHtml({
      url: `${API_BASE}${GAMIFICATION_PATH}`,
      cookies: creds.cookies,
      userAgent: creds.userAgent,
      accept: "application/json",
      label: LABEL,
      sessionExpiredMessage: SESSION_EXPIRED,
      proxyAgent: options?.proxyAgent,
    })
    const body = JSON.parse(text) as V3xGamification
    return body != null && typeof body === "object" ? body : null
  } catch {
    return null
  }
}

function applyGamification(stats: TrackerStats, game: V3xGamification): void {
  const meta = { ...(stats.platformMeta as V3xPlatformMeta | undefined) }
  if (typeof game.level === "number") meta.level = game.level
  if (typeof game.xp === "number") meta.xp = game.xp
  if (typeof game.prestige === "number") meta.prestige = game.prestige
  if (typeof game.into === "number") meta.xpInto = game.into
  if (typeof game.need === "number") meta.xpNeed = game.need
  if (typeof game.loginStreak === "number") meta.loginStreak = game.loginStreak
  if (typeof game.seedStreak === "number") meta.seedStreak = game.seedStreak
  if (Object.keys(meta).length > 0) stats.platformMeta = meta

  const label = game.rank?.label
  if (typeof label === "string" && label.trim() !== "") stats.group = label.trim()
}

export class V3xAdapter implements TrackerAdapter {
  // _apiPath is ignored: /auth/me is intrinsic to the platform, not a property
  // of a user's row, so a stale persisted api_path value self-heals instead of
  // breaking the adapter (the filelist.ts precedent).
  async fetchStats(
    _baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseV3xCredentials(apiToken)
    const { body, hostname } = await fetchMe(creds, options)
    const stats = parseV3xMe(body, hostname)

    const game = await fetchGamification(creds, options)
    if (game) applyGamification(stats, game)

    return stats
  }

  async fetchRaw(
    _baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const creds = parseV3xCredentials(apiToken)
    const calls: DebugApiCall[] = []

    try {
      const { body } = await fetchMe(creds, options)
      calls.push({ label: "Me", endpoint: ME_PATH, data: body, error: null })
    } catch (err) {
      calls.push({ label: "Me", endpoint: ME_PATH, data: null, error: errorMessage(err) })
      return calls
    }

    try {
      const text = await fetchTrackerHtml({
        url: `${API_BASE}${GAMIFICATION_PATH}`,
        cookies: creds.cookies,
        userAgent: creds.userAgent,
        accept: "application/json",
        label: LABEL,
        sessionExpiredMessage: SESSION_EXPIRED,
        proxyAgent: options?.proxyAgent,
      })
      calls.push({
        label: "Gamification",
        endpoint: GAMIFICATION_PATH,
        data: JSON.parse(text),
        error: null,
      })
    } catch (err) {
      calls.push({
        label: "Gamification",
        endpoint: GAMIFICATION_PATH,
        data: null,
        error: errorMessage(err),
      })
    }

    return calls
  }
}
