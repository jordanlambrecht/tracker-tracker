// src/lib/adapters/unit3d.ts
//
// Functions: isUnlimitedBuffer, Unit3dAdapter

import { computeBufferBytes } from "@/lib/data-transforms"
import { parseBytes } from "@/lib/parser"
import { adapterFetch } from "./adapter-fetch"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "./types"

/** True when a UNIT3D build reports an unbounded buffer rather than a byte value. */
function isUnlimitedBuffer(raw: string): boolean {
  const trimmed = raw?.trim().toLowerCase() ?? ""
  return trimmed === "∞" || trimmed === "-∞" || trimmed === "inf" || trimmed === "-inf"
}

interface Unit3dApiResponse {
  username: string
  group: string
  uploaded: string
  downloaded: string
  ratio: string
  buffer: string
  seeding: number
  leeching: number
  seedbonus: string
  hit_and_runs: number
}

export class Unit3dAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const url = new URL(apiPath, baseUrl)
    const hostname = new URL(baseUrl).hostname

    const headers: Record<string, string> =
      options?.unit3dAuthStyle === "bearer" ? { Authorization: `Bearer ${apiToken}` } : {}

    if (options?.unit3dAuthStyle !== "bearer") {
      url.searchParams.set("api_token", apiToken)
    }

    const data = await adapterFetch<Unit3dApiResponse>(url.toString(), hostname, options, headers)

    const uploadedBytes = parseBytes(data.uploaded)
    const downloadedBytes = parseBytes(data.downloaded)

    return {
      username: data.username,
      group: data.group,
      uploadedBytes,
      downloadedBytes,
      ratio: parseFloat(data.ratio) || 0,
      // Some UNIT3D builds (i.e. Zenith) report an unlimited buffer as "∞",
      // which parseBytes rejects. Derive it from the totals instead — the
      // same fallback avistaz.ts uses. Only the buffer field does this;
      // parseBytes stays strict for every other caller.
      bufferBytes: isUnlimitedBuffer(data.buffer)
        ? computeBufferBytes(uploadedBytes, downloadedBytes)
        : parseBytes(data.buffer),
      seedingCount: data.seeding,
      leechingCount: data.leeching,
      seedbonus: parseFloat(data.seedbonus) || 0,
      hitAndRuns: data.hit_and_runs,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
    }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const url = new URL(apiPath, baseUrl)
    const hostname = new URL(baseUrl).hostname

    const headers: Record<string, string> =
      options?.unit3dAuthStyle === "bearer" ? { Authorization: `Bearer ${apiToken}` } : {}

    if (options?.unit3dAuthStyle !== "bearer") {
      url.searchParams.set("api_token", apiToken)
    }

    try {
      const data = await adapterFetch<Record<string, unknown>>(
        url.toString(),
        hostname,
        options,
        headers
      )
      return [{ label: "User Stats", endpoint: apiPath, data, error: null }]
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
