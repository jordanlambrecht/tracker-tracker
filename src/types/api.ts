// src/types/api.ts

export type {
  AvistazPlatformMeta,
  DigitalCorePlatformMeta,
  GazellePlatformMeta,
  GazelleRanks,
  GGnPlatformMeta,
  MamPlatformMeta,
  NebulancePlatformMeta,
  PlatformMeta,
} from "@/lib/adapters/types"

import type { PlatformType } from "@/lib/adapters/constants"
import type { PlatformMeta } from "@/lib/adapters/types"
import type { DownloadClientRow, NotificationTargetRow } from "@/lib/db/schema"
import type { SystemEvent } from "@/lib/events"
import type { NotificationThresholds } from "@/lib/notifications/types"

/** Fields shared between TrackerLatestStats and Snapshot */
interface TrackerStatFields {
  ratio: number | null
  seedingCount: number | null
  leechingCount: number | null
  requiredRatio: number | null
  warned: boolean | null
  freeleechTokens: number | null
  hitAndRuns: number | null
  seedbonus: number | null
  shareScore: number | null
  username: string | null
  group: string | null
}

export interface TrackerLatestStats extends TrackerStatFields {
  uploadedBytes: string | null
  downloadedBytes: string | null
  bufferBytes: string | null
}

export interface TrackerSummary {
  id: number
  name: string
  baseUrl: string
  platformType: PlatformType
  isActive: boolean
  lastPolledAt: string | null
  lastError: string | null
  consecutiveFailures: number
  pausedAt: string | null
  userPausedAt: string | null
  color: string
  qbtTag: string | null
  mouseholeUrl: string | null
  useProxy: boolean
  countCrossSeedUnsatisfied: boolean
  hideUnreadBadges: boolean
  isFavorite: boolean
  sortOrder: number | null
  joinedAt: string | null
  lastAccessAt: string | null
  remoteUserId: number | null
  platformMeta: PlatformMeta | null
  createdAt: string
  latestStats: TrackerLatestStats | null
}

export interface Snapshot extends TrackerStatFields {
  polledAt: string
  uploadedBytes: string
  downloadedBytes: string
  bufferBytes: string
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
  showTodayAtAGlance: boolean
}

export interface TodayAtAGlance {
  fleet: {
    uploadDelta: string
    downloadDelta: string
    bufferDelta: string
    ratioChange: number | null
    seedbonusChange: number | null
    uploadDeltaYesterday: string | null
    downloadDeltaYesterday: string | null
    bufferDeltaYesterday: string | null
  }
  trackers: Array<{
    id: number
    name: string
    color: string | null
    uploadDelta: string
    downloadDelta: string
    bufferDelta: string
  }>
  activity: {
    addedToday: number
    completedToday: number
  }
  movers: {
    topUploaders: Array<{
      hash: string
      name: string
      qbtTag: string | null
      trackerColor: string | null
      clientName: string | null
      uploadedToday: string
    }>
    topDownloaders: Array<{
      hash: string
      name: string
      qbtTag: string | null
      trackerColor: string | null
      clientName: string | null
      downloadedToday: string
    }>
  }
  trackerLastUpdated: string | null
  clientLastUpdated: string | null
}

/** Response from GET /api/auth/status */
/** Response from GET /api/settings/events */
export interface EventsPageResponse {
  events: SystemEvent[]
  total: number
  hasMore: boolean
  logSizeBytes?: number
}

/** Upload/download delta pair returned by computeDelta() */
export type DeltaDisplay = { uploaded: string; downloaded: string } | null

/** Time range selection for snapshot queries */
export type DayRange = 0 | 1 | 7 | 30 | 90 | 365

export const DASHBOARD_SETTINGS_DEFAULTS: DashboardSettings = {
  showHealthIndicators: true,
  showLoginTimers: true,
  showTodayAtAGlance: true,
}

/** API response shape for download clients (credentials stripped, dates serialized) */
export type SafeDownloadClient = Omit<
  DownloadClientRow,
  | "encryptedUsername"
  | "encryptedPassword"
  | "cachedTorrents"
  | "cachedTorrentsAt"
  | "lastPolledAt"
  | "errorSince"
  | "createdAt"
  | "updatedAt"
> & {
  hasCredentials: boolean
  lastPolledAt: string | null
  errorSince: string | null
  createdAt: string
  updatedAt: string
}

/** API response shape for notification targets (encrypted config stripped, dates serialized) */
export type SafeNotificationTarget = Omit<
  NotificationTargetRow,
  "encryptedConfig" | "lastDeliveryAt" | "createdAt" | "updatedAt" | "thresholds"
> & {
  hasConfig: boolean
  thresholds: NotificationThresholds | null
  lastDeliveryAt: string | null
  createdAt: string
  updatedAt: string
}
