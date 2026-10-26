// src/lib/tracker-platforms/adapters/v3x.ts
//
// Functions: numeric, rankForLevel, warningCount, parseV3xMe, fetchMe, V3xAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"
import type {
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
  V3xPlatformMeta,
} from "../contract"
import { adapterRequest } from "../helpers/adapter-fetch"
import { requireBytes } from "../helpers/bytes"
import { pollError } from "../helpers/poll-error"

// V3X's read-only profile API, on a fixed host. A "Mon profil (lecture)" key
// reads only the owner's figures; Torznab, Upload and Drafts keys work too.
// The site allows 30 calls a minute.
const API_HOST = "api.v3x.club"
const ME_PATH = "/api/me"

interface V3xMe {
  id?: number
  username?: string
  createdAt?: string
  lastLoginAt?: string | null
  lastVisitDay?: string | null
  uploaded?: number
  downloaded?: number
  downloadedReal?: number
  bonusPoints?: number
  seeding?: number
  leeching?: number
  freeleechTokens?: number
  globalFreeleech?: boolean
  globalFreeleechUntil?: string | null
  level?: number
  hitAndRun?: number
  ratioFloor?: { floor?: number }
  warnings?: number | unknown[]
  invitesLeft?: number
}

// The site's ranks by level, as its rules list them. The profile API sends the
// level but not the rank name.
const RANKS: readonly [number, string][] = [
  [70, "Palme d'Or"],
  [45, "Réalisateur"],
  [25, "Tête d'affiche"],
  [10, "Second rôle"],
  [1, "Figurant"],
]

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function rankForLevel(level: unknown): string | null {
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1) return null
  return RANKS.find(([min]) => level >= min)?.[1] ?? null
}

/** The wiki calls it the current warnings without saying whether it is a count or a list. */
function warningCount(warnings: unknown): number | null {
  if (Array.isArray(warnings)) return warnings.length
  return numeric(warnings)
}

export function parseV3xMe(body: V3xMe | null): TrackerStats {
  if (body == null || typeof body !== "object") {
    throw new Error(`Unexpected response from ${API_HOST}: missing user object`)
  }
  const uploadedBytes = requireBytes(body.uploaded, "uploaded", API_HOST)
  const downloadedBytes = requireBytes(body.downloaded, "downloaded", API_HOST)
  const downloadedReal = numeric(body.downloadedReal)
  const invites = numeric(body.invitesLeft)
  const warnings = warningCount(body.warnings)

  const meta: V3xPlatformMeta = {}
  // The site shows the real download only when it is above the counted one.
  if (downloadedReal !== null) {
    meta.freeleechDownloadedBytes = Math.max(0, downloadedReal - Number(downloadedBytes))
  }
  if (invites !== null) meta.invites = invites
  if (typeof body.globalFreeleech === "boolean") {
    meta.globalFreeleech = body.globalFreeleech
    if (body.globalFreeleech && typeof body.globalFreeleechUntil === "string") {
      meta.globalFreeleechEndsAt = body.globalFreeleechUntil
    }
  }

  return {
    username: typeof body.username === "string" ? body.username : "",
    group: rankForLevel(body.level),
    uploadedBytes,
    downloadedBytes,
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount: numeric(body.seeding),
    leechingCount: numeric(body.leeching),
    seedbonus: numeric(body.bonusPoints),
    hitAndRuns: numeric(body.hitAndRun),
    requiredRatio: numeric(body.ratioFloor?.floor),
    warned: warnings === null ? null : warnings > 0,
    freeleechTokens: numeric(body.freeleechTokens),
    remoteUserId:
      typeof body.id === "number" && Number.isInteger(body.id) && body.id > 0 ? body.id : undefined,
    joinedDate: typeof body.createdAt === "string" ? body.createdAt : undefined,
    // The site shows the last visit day, and the last login only without one
    lastAccessDate: [body.lastVisitDay, body.lastLoginAt].find(
      (value): value is string => typeof value === "string" && value !== ""
    ),
    platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
  }
}

/** The key goes in the Authorization header rather than the URL, so it stays out of logs. */
async function fetchMe(token: string, options?: FetchOptions): Promise<V3xMe | null> {
  const response = await adapterRequest(`https://${API_HOST}${ME_PATH}`, API_HOST, options, {
    Authorization: `Bearer ${token}`,
  })
  if (response.status === 401) {
    throw new Error("V3X refused the API key. Create one with « Mon profil (lecture) »")
  }
  if (!response.ok) {
    throw new Error(`Tracker API error: ${response.status} ${response.statusText}`)
  }
  return response.json<V3xMe | null>()
}

export class V3xAdapter implements TrackerAdapter {
  // _apiPath is ignored: /api/me is intrinsic to the platform, not a property
  // of a user's row, so a stale persisted api_path value self-heals instead of
  // breaking the adapter (the filelist.ts precedent).
  async fetchStats(
    _baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    return parseV3xMe(await fetchMe(validateHeaderToken(apiToken), options))
  }

  async fetchRaw(
    _baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    // A malformed key throws here, before the try, as it does in fetchStats.
    const token = validateHeaderToken(apiToken)
    const call = { label: "Profile", endpoint: ME_PATH }
    try {
      const data = await fetchMe(token, options)
      // A body fetchStats would fail must not read as healthy here (adapter standard 2.6).
      return [{ ...call, data, error: pollError(() => parseV3xMe(data)) }]
    } catch (err) {
      return [{ ...call, data: null, error: err instanceof Error ? err.message : "Request failed" }]
    }
  }
}
