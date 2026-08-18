// src/lib/adapters/btn.ts
//
// Functions: parseBtnBytes, mapBtnResult, translateBtnError, callBtnUserInfo, BtnAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { localDateStr } from "@/lib/formatters"
import { adapterFetch } from "./adapter-fetch"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "./types"

/**
 * BTN serves its API from a different host than its site, and every BTN user
 * hits the same one — it is a property of the platform, not of a user's row.
 * So the adapter owns it and deliberately ignores the persisted `apiPath`,
 * the same way avistaz/digitalcore/iptorrents/torrentleech ignore theirs.
 *
 * That ignore is load-bearing: rows created before this change persisted the
 * absolute URL into `api_path`. Reading it back would be harmless today but
 * would go stale the moment BTN moves hosts, and `drizzle-kit push` has no
 * sanctioned way to rewrite existing rows. Ignoring it makes those rows
 * self-heal.
 */
const BTN_API_URL = "https://api.broadcasthe.net/"
const BTN_API_HOSTNAME = new URL(BTN_API_URL).hostname

/**
 * BTN's published `userInfo` fields (apidocs.broadcasthe.net) are:
 * UserID, Username, Email, Upload, Download, Title, Enabled, Paranoia,
 * Invites, ClassID. Anything below marked "undocumented" was observed on a
 * live response but is not in the spec — treat it as best-effort.
 */
interface BtnUserInfoResult {
  UserID: string
  Username: string
  Upload: string
  Download: string
  /** Documented user class name. */
  Title?: string
  // Undocumented, observed live but absent from published spec:
  Class?: string
  Lumens?: string
  Bonus?: string
  HnR?: string
  JoinDate?: string
}

interface BtnJsonRpcResponse {
  id: number
  result?: BtnUserInfoResult
  error?: { code: number; message: string }
}

/** Parse a byte counter from the API, rejecting anything non-numeric. */
function parseBtnBytes(raw: string | undefined, field: string): bigint {
  const value = (raw ?? "").trim()
  if (!value) return 0n
  try {
    return BigInt(value)
  } catch {
    throw new Error(`BTN returned a non-numeric ${field} value`)
  }
}

function mapBtnResult(result: BtnUserInfoResult): TrackerStats {
  const uploadedBytes = parseBtnBytes(result.Upload, "Upload")
  const downloadedBytes = parseBtnBytes(result.Download, "Download")

  const joinTimestamp = result.JoinDate ? parseInt(result.JoinDate, 10) : NaN
  const joinedDate =
    Number.isFinite(joinTimestamp) && joinTimestamp > 0
      ? localDateStr(new Date(joinTimestamp * 1000))
      : undefined

  return {
    username: result.Username,
    // `Title` is documented; `Class` appears in live responses. Accept either.
    group: result.Class ?? result.Title ?? "Unknown",
    uploadedBytes,
    downloadedBytes,
    // Derived from byte totals. BTN's userInfo has no ratio field, and
    // defaulting zero-download to 0 would show healthy accounts as critical.
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    // BTN's userInfo has no seeding/leeching counts, required ratio, or warned
    // flag. Report as unknown rather than zero. A hardcoded 0 renders as a
    // measured 0.
    seedingCount: null,
    leechingCount: null,
    requiredRatio: null,
    warned: null,
    // `HnR` is undocumented. BTN has a separate getUserSnatchlist endpoint for
    // hit-and-runs, so this key may not exist. Report unknown rather than a
    // fabricated 0.
    hitAndRuns: result.HnR == null ? null : (parseInt(result.HnR, 10) || 0),
    // `Lumens` and `Bonus` are undocumented, meanings unconfirmed. `Bonus` is
    // fractional, which doesn't fit a token count. Unmapped pending verification.
    seedbonus: null,
    freeleechTokens: null,
    remoteUserId: parseInt(result.UserID, 10) || undefined,
    joinedDate,
  }
}

/** Restore BTN-specific wording for the status codes adapterFetch reports generically. */
function translateBtnError(err: unknown): Error {
  const message = err instanceof Error ? err.message : "BTN request failed"
  if (/\b401\b/.test(message)) return new Error("Invalid BTN API key")
  if (/\b503\b/.test(message)) return new Error("BTN API rate limited (150 calls/hour)")
  return err instanceof Error ? err : new Error(message)
}

async function callBtnUserInfo(
  apiUrl: string,
  apiKey: string,
  hostname: string,
  options?: FetchOptions
): Promise<BtnJsonRpcResponse> {
  let data: BtnJsonRpcResponse
  try {
    // Routed through adapterFetch so BTN honours a configured proxy and the
    // shared request timeout, like every other JSON adapter.
    data = await adapterFetch<BtnJsonRpcResponse>(
      apiUrl,
      hostname,
      options,
      { "Content-Type": "application/json" },
      {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "userInfo", params: [apiKey] }),
      }
    )
  } catch (err) {
    throw translateBtnError(err)
  }

  if (data.error) {
    throw new Error(data.error.message)
  }
  if (!data.result) {
    throw new Error(`Unexpected response from ${hostname}: missing result`)
  }

  return data
}

export class BtnAdapter implements TrackerAdapter {
  async fetchStats(
    _baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const data = await callBtnUserInfo(BTN_API_URL, apiToken, BTN_API_HOSTNAME, options)
    // data.result is guaranteed by callBtnUserInfo
    return mapBtnResult(data.result as BtnUserInfoResult)
  }

  async fetchRaw(
    _baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    try {
      const data = await callBtnUserInfo(BTN_API_URL, apiToken, BTN_API_HOSTNAME, options)
      const stats = mapBtnResult(data.result as BtnUserInfoResult)
      return [{ label: "userInfo", endpoint: BTN_API_URL, data: stats, error: null }]
    } catch (err) {
      return [
        {
          label: "userInfo",
          endpoint: BTN_API_URL,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
