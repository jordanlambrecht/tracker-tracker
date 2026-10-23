// src/lib/tracker-platforms/adapters/animebytes.ts
//
// Functions: parseAnimeBytesCredentials, unwrapPersonalStats, readPersonalStats,
//            AnimeBytesAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"
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
  error?: string
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
  return { token: validateHeaderToken(token), username: username.trim() }
}

export function unwrapPersonalStats(
  body: AnimeBytesPersonalStats,
  hostname: string
): AnimeBytesPersonalStats {
  if (!body?.success) {
    throw new Error(body?.error?.trim() || `AnimeBytes API request failed on ${hostname}`)
  }
  return body
}

function readPersonalStats(
  body: AnimeBytesPersonalStats,
  hostname: string
): { data: AnimeBytesPersonalStats; uploadedBytes: bigint; downloadedBytes: bigint } {
  const data = unwrapPersonalStats(body, hostname)
  return {
    data,
    uploadedBytes: requireBytes(data.upload?.account, "upload.account", hostname),
    downloadedBytes: requireBytes(data.download?.account, "download.account", hostname),
  }
}

export class AnimeBytesAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const { token, username } = parseAnimeBytesCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl).toString()

    const body = await adapterFetch<AnimeBytesPersonalStats>(url, hostname, options, {
      Authorization: `Bearer ${token}`,
    })
    const { data, uploadedBytes, downloadedBytes } = readPersonalStats(body, hostname)

    const platformMeta: AnimeBytesPlatformMeta = {
      potentialHnrs: data.hnrs?.potential,
      yenPerHour: data.yen?.per_hour,
      yenPerDay: data.yen?.per_day,
      rawUploadedBytes: data.upload?.raw,
      rawDownloadedBytes: data.download?.raw,
      snatched: data.tracker?.snatched,
      seedSizeBytes: data.tracker?.seed_size,
      avgSeedTime: data.tracker?.avg_seed_time,
      torrentsUploaded: data.torrents?.uploaded,
      torrentsPruned: data.torrents?.pruned,
    }
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
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const { token } = parseAnimeBytesCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl).toString()

    try {
      const data = await adapterFetch<AnimeBytesPersonalStats>(url, hostname, options, {
        Authorization: `Bearer ${token}`,
      })
      return [
        {
          label: "Personal stats",
          endpoint: apiPath,
          data,
          error: pollError(() => readPersonalStats(data, hostname)),
        },
      ]
    } catch (err) {
      return [
        {
          label: "Personal stats",
          endpoint: apiPath,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
