// src/lib/tracker-platforms/adapters/btn.ts
//
// Functions: parseBtnBytes, mapBtnResult, callBtnUserInfo, readBtnUserInfo, BtnAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { localDateStr } from "@/lib/formatters"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
import { adapterRequest } from "../helpers/adapter-fetch"
import { presentClass } from "../helpers/class-name"
import { tryParseCount } from "../helpers/html-parse"
import { pollError } from "../helpers/poll-error"

/**
 * BTN serves one API host for every user, so the adapter owns the URL and
 * ignores the persisted apiPath. Some rows hold an absolute URL in api_path,
 * and ignoring it keeps them working if BTN moves hosts.
 */
const BTN_API_URL = "https://api.broadcasthe.net/"
const BTN_API_HOSTNAME = new URL(BTN_API_URL).hostname

/**
 * BTN's published `userInfo` fields (apidocs.broadcasthe.net) are:
 * UserID, Username, Email, Upload, Download, Title, Enabled, Paranoia,
 * Invites, ClassID. Anything below marked "undocumented" was observed on a
 * live response but is not in the spec, treat it as best-effort.
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
  error?: { code: number; message?: string }
}

/**
 * A byte counter from the API. Both totals are non-nullable `bigint`, so an
 * absent one cannot be reported as unknown and must not become a measured zero:
 * that reads as a real 0.00 ratio, fires the ratio-danger alert, and persists
 * into snapshot history. `Upload` and `Download` are documented required
 * fields, so a blank one is a payload this adapter cannot read (2.1).
 */
function parseBtnBytes(raw: string | undefined, field: string): bigint {
  const value = (raw ?? "").trim()
  if (!value) {
    throw new Error(`Unexpected response from ${BTN_API_HOSTNAME}: blank ${field} value`)
  }
  try {
    return BigInt(value)
  } catch {
    throw new Error(`Unexpected response from ${BTN_API_HOSTNAME}: non-numeric ${field} value`)
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
    // `Title` is documented; `Class` appears in live responses. Accept either,
    // and read a blank one as absent.
    group: presentClass(result.Class) ?? presentClass(result.Title),
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
    hitAndRuns: tryParseCount(result.HnR) ?? null,
    // `Lumens` and `Bonus` are undocumented with unconfirmed meanings, so
    // neither is mapped.
    seedbonus: null,
    freeleechTokens: null,
    remoteUserId: tryParseCount(result.UserID) ?? undefined,
    joinedDate,
  }
}

async function callBtnUserInfo(
  apiUrl: string,
  apiKey: string,
  hostname: string,
  options?: FetchOptions
): Promise<BtnJsonRpcResponse> {
  // adapterRequest returns the status, so the 401 and 503 messages below key
  // off the status code, never off digits in a tracker-supplied message.
  let response: Awaited<ReturnType<typeof adapterRequest>>
  try {
    response = await adapterRequest(
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
    throw err instanceof Error ? err : new Error("BTN request failed")
  }

  if (response.status === 401) throw new Error("Invalid BTN API key")
  if (response.status === 503) throw new Error("BTN API rate limited (150 calls/hour)")
  if (!response.ok) {
    throw new Error(`Tracker API error: ${response.status} ${response.statusText}`)
  }

  return response.json<BtnJsonRpcResponse>()
}

/** The userInfo result, or the error fetchStats fails the poll with. */
function readBtnUserInfo(data: BtnJsonRpcResponse): BtnUserInfoResult {
  if (data.error) {
    throw new Error(data.error.message?.trim() || "BTN API returned an error with no message")
  }
  if (!data.result) {
    throw new Error(`Unexpected response from ${BTN_API_HOSTNAME}: missing result`)
  }
  return data.result
}

export class BtnAdapter implements TrackerAdapter {
  async fetchStats(
    _baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const data = await callBtnUserInfo(BTN_API_URL, apiToken, BTN_API_HOSTNAME, options)
    return mapBtnResult(readBtnUserInfo(data))
  }

  async fetchRaw(
    _baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    try {
      const data = await callBtnUserInfo(BTN_API_URL, apiToken, BTN_API_HOSTNAME, options)
      return [
        {
          label: "User Info",
          endpoint: BTN_API_URL,
          data,
          error: pollError(() => mapBtnResult(readBtnUserInfo(data))),
        },
      ]
    } catch (err) {
      return [
        {
          label: "User Info",
          endpoint: BTN_API_URL,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
