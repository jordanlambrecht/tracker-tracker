// src/lib/adapters/types.ts
export interface TrackerStats {
  username: string
  group: string
  uploadedBytes: bigint
  downloadedBytes: bigint
  ratio: number
  bufferBytes: bigint
  seedingCount: number
  leechingCount: number
  seedbonus: number
  hitAndRuns: number
}

export interface TrackerAdapter {
  fetchStats(baseUrl: string, apiToken: string, apiPath: string): Promise<TrackerStats>
}
