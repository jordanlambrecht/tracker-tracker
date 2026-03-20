// src/types/api.ts

import type {
  GazellePlatformMeta,
  GGnPlatformMeta,
  NebulancePlatformMeta,
} from "@/lib/adapters/types"

export type {
  GazellePlatformMeta,
  GazelleRanks,
  GGnPlatformMeta,
  NebulancePlatformMeta,
} from "@/lib/adapters/types"

export interface TrackerLatestStats {
  ratio: number | null
  uploadedBytes: string | null
  downloadedBytes: string | null
  seedingCount: number | null
  leechingCount: number | null
  requiredRatio: number | null
  warned: boolean | null
  freeleechTokens: number | null
  bufferBytes: string | null // bigint serialized as decimal string
  hitAndRuns: number | null
  seedbonus: number | null
  shareScore: number | null
  username: string | null
  group: string | null
}

export interface TrackerSummary {
  id: number
  name: string
  baseUrl: string
  platformType: string
  isActive: boolean
  lastPolledAt: string | null
  lastError: string | null
  consecutiveFailures: number
  pausedAt: string | null
  color: string
  qbtTag: string | null
  useProxy: boolean
  countCrossSeedUnsatisfied: boolean
  isFavorite: boolean
  sortOrder: number | null
  joinedAt: string | null
  lastAccessAt: string | null
  remoteUserId: number | null
  platformMeta: GGnPlatformMeta | GazellePlatformMeta | NebulancePlatformMeta | null
  createdAt: string
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
  requiredRatio: number | null
  warned: boolean | null
  freeleechTokens: number | null
  shareScore: number | null
  username: string | null
  group: string | null
}

export interface TagGroupMember {
  id: number
  groupId: number
  tag: string
  label: string
  color: string | null
  sortOrder: number
}

export type TagGroupChartType = "bar" | "donut" | "treemap" | "numbers"

export const VALID_CHART_TYPES = ["bar", "donut", "treemap", "numbers"] as const

export interface TagGroup {
  id: number
  name: string
  emoji: string | null
  chartType: TagGroupChartType
  description: string | null
  sortOrder: number
  countUnmatched: boolean
  members: TagGroupMember[]
}

export interface QbitmanageTagEntry {
  enabled: boolean
  tag: string
}

export interface QbitmanageTagConfig {
  issue: QbitmanageTagEntry
  minTimeNotReached: QbitmanageTagEntry
  noHardlinks: QbitmanageTagEntry
  minSeedsNotMet: QbitmanageTagEntry
  lastActiveLimitNotReached: QbitmanageTagEntry
  lastActiveNotReached: QbitmanageTagEntry
}

export interface DashboardSettings {
  showHealthIndicators: boolean
  showLoginTimers: boolean
}

export const DASHBOARD_SETTINGS_DEFAULTS: DashboardSettings = {
  showHealthIndicators: true,
  showLoginTimers: true,
}
