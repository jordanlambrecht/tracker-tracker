// src/lib/adapters/btn.ts

import { computeBufferBytes } from "@/lib/data-transforms"
import { classifyFetchError } from "@/lib/error-utils"
import { localDateStr } from "@/lib/formatters"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "./types"

interface BtnUserInfoResult {
  UserID: string
  Username: string
  Upload: string
  Download: string
  // The following fields are returned by the live API but not documented:
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

function mapBtnResult(result: BtnUserInfoResult): TrackerStats {
  const uploadedBytes = BigInt(result.Upload || "0")
  const downloadedBytes = BigInt(result.Download || "0")

  let ratio = 0
  if (downloadedBytes > 0n) {
    ratio = Number(uploadedBytes) / Number(downloadedBytes)
  }

  const joinTimestamp = result.JoinDate ? parseInt(result.JoinDate, 10) : NaN
  const joinedDate =
    Number.isFinite(joinTimestamp) && joinTimestamp > 0
      ? localDateStr(new Date(joinTimestamp * 1000))
      : undefined

  return {
    username: result.Username,
    group: result.Class ?? "Unknown",
    uploadedBytes,
    downloadedBytes,
    ratio,
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount: 0,
    leechingCount: 0,
    seedbonus: parseFloat(result.Lumens ?? "0") || 0,
    hitAndRuns: parseInt(result.HnR ?? "0", 10) || 0,
    requiredRatio: 0,
    warned: false,
    freeleechTokens: parseFloat(result.Bonus ?? "0") || 0,
    remoteUserId: parseInt(result.UserID, 10) || undefined,
    joinedDate,
  }
}

async function callBtnUserInfo(
  apiUrl: string,
  apiKey: string,
  hostname: string
): Promise<BtnJsonRpcResponse> {
  let response: Response
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "userInfo",
        params: [apiKey],
      }),
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    throw classifyFetchError(err, hostname)
  }

  if (response.status === 401) {
    throw new Error("Invalid BTN API key")
  }
  if (response.status === 503) {
    throw new Error("BTN API rate limited (150 calls/hour)")
  }
  if (!response.ok) {
    throw new Error(`BTN API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as BtnJsonRpcResponse

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
    apiPath: string,
    _options?: FetchOptions
  ): Promise<TrackerStats> {
    const hostname = new URL(apiPath).hostname
    const data = await callBtnUserInfo(apiPath, apiToken, hostname)
    // data.result is guaranteed by callBtnUserInfo
    return mapBtnResult(data.result as BtnUserInfoResult)
  }

  async fetchRaw(
    _baseUrl: string,
    apiToken: string,
    apiPath: string,
    _options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const hostname = new URL(apiPath).hostname
    try {
      const data = await callBtnUserInfo(apiPath, apiToken, hostname)
      const stats = mapBtnResult(data.result as BtnUserInfoResult)
      return [{ label: "userInfo", endpoint: apiPath, data: stats, error: null }]
    } catch (err) {
      return [
        {
          label: "userInfo",
          endpoint: apiPath,
          data: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ]
    }
  }
}
