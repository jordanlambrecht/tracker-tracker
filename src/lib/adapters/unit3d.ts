// src/lib/adapters/unit3d.ts
import { parseBytes } from "@/lib/parser"
import { adapterFetch } from "./adapter-fetch"
import type { FetchOptions, TrackerAdapter, TrackerStats } from "./types"

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
    url.searchParams.set("api_token", apiToken)

    const hostname = new URL(baseUrl).hostname

    const data = await adapterFetch<Unit3dApiResponse>(url.toString(), hostname, options)

    return {
      username: data.username,
      group: data.group,
      uploadedBytes: parseBytes(data.uploaded),
      downloadedBytes: parseBytes(data.downloaded),
      ratio: parseFloat(data.ratio) || 0,
      bufferBytes: parseBytes(data.buffer),
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
  ): Promise<Record<string, unknown>> {
    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("api_token", apiToken)

    const hostname = new URL(baseUrl).hostname
    const data = await adapterFetch<Record<string, unknown>>(url.toString(), hostname, options)
    return data
  }
}
