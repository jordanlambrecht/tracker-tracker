// src/lib/adapters/unit3d.ts
import { parseBytes } from "@/lib/parser"
import type { TrackerAdapter, TrackerStats } from "./types"

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
  async fetchStats(baseUrl: string, apiToken: string, apiPath: string): Promise<TrackerStats> {
    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("api_token", apiToken)

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`Tracker API error: ${response.status} ${response.statusText}`)
    }

    const data: Unit3dApiResponse = await response.json()

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
    }
  }
}
