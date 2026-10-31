// src/lib/tracker-platforms/adapters/c411.ts
//
// Functions: c411Grade, readProfile, absoluteAvatarUrl, fetchProfile, C411Adapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"
import type {
  C411PlatformMeta,
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { adapterRequest } from "../helpers/adapter-fetch"
import { requireBytes } from "../helpers/bytes"
import { pollError } from "../helpers/poll-error"

// ---------------------------------------------------------------------------
// C411's documented profile endpoint. The key travels as a Bearer token and
// needs the "Profile (reading)" scope, which a new key does not get by default.
// ---------------------------------------------------------------------------

interface C411Profile {
  id: number
  username?: string
  avatarUrl?: string | null
  memberSince?: string
  class?: { progress?: { grade?: { tier?: string; level?: number } } } | null
  zen?: { balance?: number } | null
  transfer?: { uploaded?: { total?: number }; downloaded?: { total?: number } }
  download?: { allowed?: boolean }
}

// The grade is C411's rank: four levels in each of bronze, silver (argent) and
// gold (or), named as its wiki names them. The last one is Gold 411, not Gold IV.
const TIER_NAMES: Record<string, string> = { bronze: "Bronze", argent: "Silver", or: "Gold" }
const LEVEL_NUMERALS = ["I", "II", "III", "IV"]

/** The grade's name, an unknown tier or level as sent, or null before a class is chosen. */
function c411Grade(grade: { tier?: unknown; level?: unknown } | undefined): string | null {
  const tier = typeof grade?.tier === "string" ? grade.tier.trim().toLowerCase() : ""
  const level = grade?.level
  if (tier === "" || typeof level !== "number") return null
  if (tier === "or" && level === 4) return "Gold 411"
  const name = Object.hasOwn(TIER_NAMES, tier) ? TIER_NAMES[tier] : tier
  const numeral = LEVEL_NUMERALS[level - 1] ?? String(level)
  return `${name} ${numeral}`
}

/**
 * Upload and download as C411 counts them for its ratio: measured volume plus
 * purchased or gifted credit on the way up, minus it on the way down.
 */
function readProfile(
  data: C411Profile,
  hostname: string
): { uploadedBytes: bigint; downloadedBytes: bigint } {
  return {
    uploadedBytes: requireBytes(
      data.transfer?.uploaded?.total,
      "transfer.uploaded.total",
      hostname
    ),
    downloadedBytes: requireBytes(
      data.transfer?.downloaded?.total,
      "transfer.downloaded.total",
      hostname
    ),
  }
}

const PROFILE_PATH = "/api/user/profile"

/** The API sends a site-relative path; an unparseable one shows no avatar. */
function absoluteAvatarUrl(path: unknown, baseUrl: string): string | undefined {
  if (typeof path !== "string" || path === "") return undefined
  try {
    return new URL(path, baseUrl).toString()
  } catch {
    return undefined
  }
}

/** On a refusal, the `message` field of the response body is appended to the error message. */
async function fetchProfile(
  baseUrl: string,
  token: string,
  options?: FetchOptions
): Promise<C411Profile> {
  const hostname = new URL(baseUrl).hostname
  const res = await adapterRequest(new URL(PROFILE_PATH, baseUrl).toString(), hostname, options, {
    Authorization: `Bearer ${token}`,
  })
  if (!res.ok) {
    let reason = ""
    try {
      const body = JSON.parse(await res.text()) as { message?: unknown }
      if (typeof body.message === "string") reason = `: ${body.message.slice(0, 200)}`
    } catch {
      // security-audit-ignore: an unreadable body leaves the status line as the message
    }
    throw new Error(`Tracker API error: ${res.status} ${res.statusText}${reason}`)
  }
  return res.json<C411Profile>()
}

export class C411Adapter implements TrackerAdapter {
  // _apiPath is ignored: /api/user/profile is intrinsic to the platform, not a
  // property of a user's row, so a stale persisted api_path value self-heals
  // instead of breaking the adapter (the btn.ts precedent).
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const trimmedToken = validateHeaderToken(apiToken)
    const hostname = new URL(baseUrl).hostname

    const data = await fetchProfile(baseUrl, trimmedToken, options)

    const { uploadedBytes, downloadedBytes } = readProfile(data, hostname)

    return {
      username: data.username ?? "",
      group: c411Grade(data.class?.progress?.grade),
      uploadedBytes,
      downloadedBytes,
      ratio: computeRatio(uploadedBytes, downloadedBytes),
      bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: null,
      leechingCount: null,
      seedbonus: typeof data.zen?.balance === "number" ? data.zen.balance : null,
      hitAndRuns: null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
      remoteUserId: data.id,
      joinedDate: data.memberSince,
      avatarUrl: absoluteAvatarUrl(data.avatarUrl, baseUrl),
      // Always an object, so a poll that stops reporting the flag clears it.
      // JSON.stringify drops the undefined member.
      platformMeta: {
        canDownload:
          typeof data.download?.allowed === "boolean" ? data.download.allowed : undefined,
      } satisfies C411PlatformMeta,
    }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const trimmedToken = validateHeaderToken(apiToken)
    const hostname = new URL(baseUrl).hostname

    try {
      const data = await fetchProfile(baseUrl, trimmedToken, options)
      // A body fetchStats would fail must not read as healthy here (adapter
      // standard 2.6).
      return [
        {
          label: "User Profile",
          endpoint: PROFILE_PATH,
          data,
          error: pollError(() => readProfile(data, hostname)),
        },
      ]
    } catch (err) {
      return [
        {
          label: "User Profile",
          endpoint: PROFILE_PATH,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
