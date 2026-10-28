// src/lib/tracker-platforms/adapters/hawke.ts
//
// Functions: unwrapEnvelope, readProfile, HawkeAdapter

import { computeBufferBytes, computeRatio, signedFloatBytesToBigInt } from "@/lib/data-transforms"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"
import type {
  DebugApiCall,
  FetchOptions,
  HawkePlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { adapterFetch } from "../helpers/adapter-fetch"
import { requireBytes } from "../helpers/bytes"
import { presentClass } from "../helpers/class-name"
import { pollError } from "../helpers/poll-error"

// ---------------------------------------------------------------------------
// Hawke is not UNIT3D. Its profile is GET /api/profile with a Bearer key,
// wrapped in a success/data/message envelope; /api/user and /api/v1/user
// both 404.
// ---------------------------------------------------------------------------

interface HawkeProfile {
  username: string
  group: string
  member_since: string
  uploaded: number
  downloaded: number
  ratio: number
  /** Signed: negative on a deficit account. Must not be clamped to zero. */
  buffer: number
  /** Hawke's bonus-point currency. */
  hunos: number
  active_seeds: number
  active_leeches: number
  hit_and_runs: number
  seed_divisions?: Record<string, number>
  warnings?: number
  can_upload?: boolean
  can_download?: boolean
  can_request?: boolean
  can_invite?: boolean
}

interface HawkeEnvelope {
  success: boolean
  data?: HawkeProfile
  message?: string
}

/**
 * Unwrap Hawke's success/data/message envelope.
 *
 * adapterFetch already throws on any non-2xx, so this only has to handle the
 * 200-with-failure case: Hawke answers an authenticated-but-rejected request
 * with HTTP 200 and `success: false`, where the human-readable reason lives in
 * `message`. Surfacing that message is the whole point, without it the caller
 * sees a successful poll carrying zeroed stats.
 */
function unwrapEnvelope(body: HawkeEnvelope, hostname: string): HawkeProfile {
  if (!body?.success) {
    throw new Error(body?.message?.trim() || `Hawke API request failed on ${hostname}`)
  }
  if (!body.data) {
    throw new Error(`Unexpected response from ${hostname}: envelope reported success with no data`)
  }
  return body.data
}

/** The profile and its byte totals, or the error fetchStats fails the poll with. */
function readProfile(
  body: HawkeEnvelope,
  hostname: string
): { data: HawkeProfile; uploadedBytes: bigint; downloadedBytes: bigint } {
  const data = unwrapEnvelope(body, hostname)
  return {
    data,
    uploadedBytes: requireBytes(data.uploaded, "uploaded", hostname),
    downloadedBytes: requireBytes(data.downloaded, "downloaded", hostname),
  }
}

export class HawkeAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const trimmedToken = validateHeaderToken(apiToken)
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl).toString()

    // Bearer only. Hawke has no legacy query-param form, so none of UNIT3D's
    // probe-and-remember auth machinery applies here.
    const body = await adapterFetch<HawkeEnvelope>(url, hostname, options, {
      Authorization: `Bearer ${trimmedToken}`,
    })

    const { data, uploadedBytes, downloadedBytes } = readProfile(body, hostname)

    // All optional on HawkePlatformMeta, so an absent warning count or
    // permission flag stays undefined rather than defaulting.
    const platformMeta: HawkePlatformMeta = {
      warnings: data.warnings,
      canUpload: data.can_upload,
      canDownload: data.can_download,
      canRequest: data.can_request,
      canInvite: data.can_invite,
    }
    if (data.seed_divisions) platformMeta.seedDivisions = data.seed_divisions

    return {
      username: data.username,
      group: presentClass(data.group),
      uploadedBytes,
      downloadedBytes,
      // Keep Hawke's reported figure, which it rounds, unless nothing has been
      // downloaded (no quotient to report) or it is not a finite number.
      ratio:
        downloadedBytes === 0n || !Number.isFinite(data.ratio)
          ? computeRatio(uploadedBytes, downloadedBytes)
          : data.ratio,
      // Hawke reports a signed buffer that goes negative on a deficit. A
      // non-finite value falls back to the derived buffer, since
      // BigInt(Math.trunc(NaN)) throws.
      bufferBytes:
        typeof data.buffer === "number" && Number.isFinite(data.buffer)
          ? signedFloatBytesToBigInt(data.buffer)
          : computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: data.active_seeds ?? null,
      leechingCount: data.active_leeches ?? null,
      seedbonus: data.hunos ?? null,
      hitAndRuns: data.hit_and_runs ?? null,
      requiredRatio: null,
      // `warnings` is a count, not a boolean. Can't distinguish 0 warnings from
      // untracked. Keep the boolean unknown and report count in platformMeta.
      warned: null,
      freeleechTokens: null,
      joinedDate: data.member_since || undefined,
      platformMeta,
    }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const trimmedToken = validateHeaderToken(apiToken)
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl).toString()

    try {
      const data = await adapterFetch<HawkeEnvelope>(url, hostname, options, {
        Authorization: `Bearer ${trimmedToken}`,
      })
      return [
        {
          label: "Profile",
          endpoint: apiPath,
          data,
          error: pollError(() => readProfile(data, hostname)),
        },
      ]
    } catch (err) {
      return [
        {
          label: "Profile",
          endpoint: apiPath,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
