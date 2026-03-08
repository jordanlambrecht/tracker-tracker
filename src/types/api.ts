// src/types/api.ts

export interface TrackerLatestStats {
  ratio: number | null
  uploadedBytes: string | null
  downloadedBytes: string | null
  seedingCount: number | null
  leechingCount: number | null
  username: string | null
  group: string | null
}

export interface TrackerSummary {
  id: number
  name: string
  baseUrl: string
  platformType: string
  pollIntervalMinutes: number
  isActive: boolean
  lastPolledAt: string | null
  lastError: string | null
  color: string
  latestStats: TrackerLatestStats | null
}

export interface Snapshot {
  polledAt: string
  uploadedBytes: string
  downloadedBytes: string
  ratio: number | null
  bufferBytes: string
  seedbonus: number | null
  seedingCount: number | null
  leechingCount: number | null
  hitAndRuns: number | null
  username: string | null
  group: string | null
}
