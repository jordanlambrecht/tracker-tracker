// src/lib/tracker-platforms/adapters/animebytes.ts
//
// Functions: parseAnimeBytesCredentials, readPersonalStats, fetchPersonalStats,
//            AnimeBytesAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"
import { validateTrackerUsername } from "@/lib/tracker-credentials/tracker-username"
import type {
  AnimeBytesPlatformMeta,
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { adapterFetch } from "../helpers/adapter-fetch"
import { requireBytes } from "../helpers/bytes"
import { presentClass } from "../helpers/class-name"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { pollError } from "../helpers/poll-error"

interface AnimeBytesPersonalStats {
  success: boolean
  error?: unknown
  freeleech?: number
  yen?: { per_day?: number; per_hour?: number; current?: number }
  hnrs?: { potential?: number; active?: number }
  upload?: { raw?: number; account?: number }
  download?: { raw?: number; account?: number }
  torrents?: { uploaded?: number; pruned?: number }
  tracker?: {
    seeding?: number
    leeching?: number
    snatched?: number
    seed_size?: number
    avg_seed_time?: number
  }
  class?: string
}

/**
 * The API token, and the username the API never reports, which the credential
 * form asks for alongside it.
 */
export function parseAnimeBytesCredentials(apiToken: string): { token: string; username: string } {
  const { token, username } = parseCredentialJson(apiToken, "AnimeBytes", [
    "token",
    "username",
  ] as const)
  return { token: validateHeaderToken(token), username: validateTrackerUsername(username) }
}

/** The byte totals, or the error fetchStats fails the poll with. */
function readPersonalStats(
  data: AnimeBytesPersonalStats,
  hostname: string
): { uploadedBytes: bigint; downloadedBytes: bigint } {
  if (!data?.success) {
    const reason = typeof data?.error === "string" ? data.error.trim().slice(0, 200) : ""
    throw new Error(`Unexpected response from ${hostname}: ${reason || "success was false"}`)
  }
  return {
    uploadedBytes: requireBytes(data.upload?.account, "upload.account", hostname),
    downloadedBytes: requireBytes(data.download?.account, "download.account", hostname),
  }
}

const PERSONAL_STATS_PATH = "/api/stats/personal"

async function fetchPersonalStats(
  baseUrl: string,
  trimmedToken: string,
  options?: FetchOptions
): Promise<AnimeBytesPersonalStats> {
  const hostname = new URL(baseUrl).hostname
  return adapterFetch<AnimeBytesPersonalStats>(
    new URL(PERSONAL_STATS_PATH, baseUrl).toString(),
    hostname,
    options,
    { Authorization: `Bearer ${trimmedToken}` }
  )
}

export class AnimeBytesAdapter implements TrackerAdapter {
  // _apiPath is ignored: /api/stats/personal is intrinsic to the platform, not
  // a property of a user's row, so a stale persisted api_path value self-heals
  // instead of breaking the adapter (the btn.ts precedent).
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const { token: trimmedToken, username } = parseAnimeBytesCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    const data = await fetchPersonalStats(baseUrl, trimmedToken, options)
    const { uploadedBytes, downloadedBytes } = readPersonalStats(data, hostname)

    const platformMeta: AnimeBytesPlatformMeta = {
      potentialHnrs: data.hnrs?.potential ?? undefined,
      yenPerHour: data.yen?.per_hour ?? undefined,
      yenPerDay: data.yen?.per_day ?? undefined,
      rawUploadedBytes: data.upload?.raw ?? undefined,
      rawDownloadedBytes: data.download?.raw ?? undefined,
      snatched: data.tracker?.snatched ?? undefined,
      seedSizeBytes: data.tracker?.seed_size ?? undefined,
      avgSeedTime: data.tracker?.avg_seed_time ?? undefined,
      torrentsUploaded: data.torrents?.uploaded ?? undefined,
      torrentsPruned: data.torrents?.pruned ?? undefined,
    }
    // A reported 0 is stored as no personal freeleech.
    if (typeof data.freeleech === "number" && data.freeleech > 0) {
      platformMeta.freeleechUntil = data.freeleech
    }

    return {
      username,
      group: presentClass(data.class),
      uploadedBytes,
      downloadedBytes,
      ratio: computeRatio(uploadedBytes, downloadedBytes),
      bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: data.tracker?.seeding ?? null,
      leechingCount: data.tracker?.leeching ?? null,
      seedbonus: data.yen?.current ?? null,
      hitAndRuns: data.hnrs?.active ?? null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
      platformMeta,
    }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const { token: trimmedToken } = parseAnimeBytesCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname

    try {
      const data = await fetchPersonalStats(baseUrl, trimmedToken, options)
      return [
        {
          label: "Personal Stats",
          endpoint: PERSONAL_STATS_PATH,
          data,
          error: pollError(() => readPersonalStats(data, hostname)),
        },
      ]
    } catch (err) {
      return [
        {
          label: "Personal Stats",
          endpoint: PERSONAL_STATS_PATH,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
