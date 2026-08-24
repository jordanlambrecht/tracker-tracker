// src/lib/adapters/hawke.ts
//
// Functions: unwrapEnvelope, HawkeAdapter

import {
  computeBufferBytes,
  computeRatio,
  floatBytesToBigInt,
  signedFloatBytesToBigInt,
} from "@/lib/data-transforms"
import { adapterFetch } from "./adapter-fetch"
import type {
  DebugApiCall,
  FetchOptions,
  HawkePlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "./types"

// ---------------------------------------------------------------------------
// Hawke is NOT UNIT3D.
//
// hawke.uno was registered as platform "unit3d" pointing at /api/user, and the
// resulting 404 got recorded as "the API does not permit /user requests". That
// read the symptom correctly and the cause wrongly: Hawke simply isn't running
// UNIT3D, so no UNIT3D route exists to permit. Verified against the live API:
//
//   GET /api/user     -> 404
//   GET /api/v1/user  -> 404
//   GET /api/profile  -> 200, with `Authorization: Bearer <key>`
//
// The payload is wrapped in a success/data/message envelope rather than being
// the bare user object UNIT3D returns, which is the other half of why pointing
// a UNIT3D adapter at it could never have worked.
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

export class HawkeAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl).toString()

    // Bearer only. Hawke has no legacy query-param form, so none of UNIT3D's
    // probe-and-remember auth machinery applies here.
    const body = await adapterFetch<HawkeEnvelope>(url, hostname, options, {
      Authorization: `Bearer ${apiToken}`,
    })

    const data = unwrapEnvelope(body, hostname)

    const uploadedBytes = floatBytesToBigInt(data.uploaded)
    const downloadedBytes = floatBytesToBigInt(data.downloaded)

    const platformMeta: HawkePlatformMeta = {
      warnings: data.warnings ?? 0,
      canUpload: data.can_upload ?? false,
      canDownload: data.can_download ?? false,
      canRequest: data.can_request ?? false,
      canInvite: data.can_invite ?? false,
    }
    if (data.seed_divisions) platformMeta.seedDivisions = data.seed_divisions

    return {
      username: data.username,
      group: data.group,
      uploadedBytes,
      downloadedBytes,
      // Hawke reports a numeric ratio without infinity. Use it, otherwise derive.
      ratio: Number.isFinite(data.ratio)
        ? data.ratio
        : computeRatio(uploadedBytes, downloadedBytes),
      // Hawke reports a signed buffer. Verified to go negative (-2.6 TB). The
      // isFinite guard is needed because BigInt(Math.trunc(NaN)) throws. Falls
      // back to derived buffer if non-finite.
      bufferBytes:
        typeof data.buffer === "number" && Number.isFinite(data.buffer)
          ? signedFloatBytesToBigInt(data.buffer)
          : computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: data.active_seeds ?? 0,
      leechingCount: data.active_leeches ?? 0,
      seedbonus: data.hunos ?? 0,
      hitAndRuns: data.hit_and_runs ?? 0,
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
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl).toString()

    try {
      const data = await adapterFetch<Record<string, unknown>>(url, hostname, options, {
        Authorization: `Bearer ${apiToken}`,
      })
      return [{ label: "Profile", endpoint: apiPath, data, error: null }]
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
