// src/lib/tracker-platforms/adapters/tr4ker.ts
//
// Functions: tr4kerClassName, bonusBytes, creditedTotals, pollError, Tr4kerAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
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

// The site shows each role id as a French class name, the name the registry
// ladder lists. An id missing here shows as sent.
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

function tr4kerClassName(role: unknown): string {
  const id = typeof role === "string" ? role.trim() : ""
  if (id === "") return "Unknown"
  const key = id.toLowerCase()
  return Object.hasOwn(ROLE_LABELS, key) ? ROLE_LABELS[key] : id
}

/**
 * A bonus figure as a bigint. TR4KER's pages add a null bonus as nothing, so
 * null counts as no bonus; an absent key or a non-number fails the poll the way
 * a byte total does.
 */
function bonusBytes(value: unknown, field: string, hostname: string): bigint {
  if (value === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing ${field}`)
  }
  return requireBytes(value ?? 0, field, hostname)
}

/**
 * Upload and download as TR4KER shows them, with the bonus added. The site
 * computes its ratio from these, so the ratio and buffer follow from them.
 */
function creditedTotals(
  data: Tr4kerApiResponse,
  hostname: string
): { uploadedBytes: bigint; downloadedBytes: bigint } {
  return {
    uploadedBytes:
      requireBytes(data.uploaded, "uploaded", hostname) +
      bonusBytes(data.bonus_upload, "bonus_upload", hostname),
    downloadedBytes:
      requireBytes(data.downloaded, "downloaded", hostname) +
      bonusBytes(data.bonus_download, "bonus_download", hostname),
  }
}

/** The message fetchStats fails the poll with for this body, or null. */
function pollError(data: Tr4kerApiResponse, hostname: string): string | null {
  try {
    creditedTotals(data, hostname)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : "Request failed"
  }
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

    const { uploadedBytes, downloadedBytes } = creditedTotals(data, hostname)

    return {
      username: data.username ?? "",
      group: tr4kerClassName(data.role),
      uploadedBytes,
      downloadedBytes,
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
      const data = await adapterFetch<Tr4kerApiResponse>(url, hostname, options, {
        "X-Api-Key": apiToken,
      })
      // A body fetchStats would fail must not read as healthy here (adapter
      // standard 2.6).
      return [{ label: "User Stats", endpoint: apiPath, data, error: pollError(data, hostname) }]
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
