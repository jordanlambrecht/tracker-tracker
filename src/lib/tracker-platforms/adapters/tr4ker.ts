// src/lib/tracker-platforms/adapters/tr4ker.ts
//
// Functions: tr4kerClassName, bonusBytes, Tr4kerAdapter

import { computeBufferBytes, computeRatio, floatBytesToBigInt } from "@/lib/data-transforms"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
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
  bonus_upload?: number | null
  bonus_download?: number | null
  money?: number | null
  avatar_url?: string | null
  joined_at?: string
  last_seen_at?: string
}

// TR4KER sends a lowercased role id ("user", "uploader_herbe"). The site shows
// a French class name, and the registry ladder matches class names exactly, so
// map the id to the label the site displays. An unknown or absent role reports
// "Unknown" rather than a name that reads as a real class.
const ROLE_LABELS: Record<string, string> = {
  user: "Membre",
  helper: "Helper",
  uploader_herbe: "Uploader en herbe",
  uploader: "Uploader",
  contributeur: "Contributeur",
  team: "Team",
  moderator: "Modérateur",
  admin: "Administrateur",
}

function tr4kerClassName(role: string | undefined): string {
  const key = role?.trim().toLowerCase()
  return key ? (ROLE_LABELS[key] ?? "Unknown") : "Unknown"
}

/**
 * Bonus credit as a bigint. TR4KER folds bonus_upload and bonus_download into
 * the ratio it displays, so they are added before the ratio is computed. An
 * absent bonus is genuinely zero: no credit was granted.
 */
function bonusBytes(value: unknown): bigint {
  return typeof value === "number" && Number.isFinite(value) ? floatBytesToBigInt(value) : 0n
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

    // TR4KER's profile ratio folds in the bonus credit: the site computes
    // (uploaded + bonus_upload) / (downloaded + bonus_download). Compute the
    // same ratio here so the app's ratio and the 0.5 minimum-ratio warning
    // agree with the site, while the stored totals stay the raw figures the
    // profile shows (adapter standard 2.3 allows a documented deviation).
    const ratio = computeRatio(
      uploadedBytes + bonusBytes(data.bonus_upload),
      downloadedBytes + bonusBytes(data.bonus_download)
    )

    return {
      username: data.username ?? "",
      group: tr4kerClassName(data.role),
      uploadedBytes,
      downloadedBytes,
      ratio,
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
      // fetchStats fails the poll when a byte total is absent, so reporting the
      // same body as healthy here would hide that (adapter standard 2.6).
      const missingBytes = data.uploaded == null || data.downloaded == null
      return [
        {
          label: "User Stats",
          endpoint: apiPath,
          data,
          error: missingBytes
            ? `Unexpected response from ${hostname}: missing uploaded or downloaded`
            : null,
        },
      ]
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
