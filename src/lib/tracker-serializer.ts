// src/lib/tracker-serializer.ts
//
// Functions: parsePlatformMeta, serializeTrackerResponse

import "server-only"

import type { PlatformType } from "@/lib/adapters/constants"
import type { PlatformMeta } from "@/lib/adapters/types"
import type { TrackerRow as FullTrackerRow, TrackerSnapshotRow } from "@/lib/db/schema"
import type { TrackerSummary } from "@/types/api"

type TrackerRow = Omit<FullTrackerRow, "encryptedApiToken" | "avatarData" | "avatarCachedAt" | "avatarRemoteUrl">

export function parsePlatformMeta(raw: string | null): PlatformMeta | null {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function serializeTrackerResponse(
  tracker: TrackerRow,
  latest: TrackerSnapshotRow | null,
  mask: (val: string | null | undefined) => string | null
): TrackerSummary {
  return {
    id: tracker.id,
    name: tracker.name,
    baseUrl: tracker.baseUrl,
    platformType: tracker.platformType as PlatformType,
    isActive: tracker.isActive,
    lastPolledAt: tracker.lastPolledAt?.toISOString() ?? null,
    lastError: tracker.lastError,
    consecutiveFailures: tracker.consecutiveFailures,
    pausedAt: tracker.pausedAt?.toISOString() ?? null,
    userPausedAt: tracker.userPausedAt?.toISOString() ?? null,
    color: tracker.color ?? "#00d4ff",
    qbtTag: tracker.qbtTag,
    mouseholeUrl: tracker.mouseholeUrl ?? null,
    useProxy: tracker.useProxy,
    countCrossSeedUnsatisfied: tracker.countCrossSeedUnsatisfied,
    hideUnreadBadges: tracker.hideUnreadBadges,
    isFavorite: tracker.isFavorite,
    sortOrder: tracker.sortOrder,
    joinedAt: tracker.joinedAt,
    lastAccessAt: tracker.lastAccessAt ?? null,
    remoteUserId: tracker.remoteUserId ?? null,
    platformMeta: parsePlatformMeta(tracker.platformMeta),
    createdAt: tracker.createdAt?.toISOString() ?? new Date().toISOString(),
    latestStats: latest
      ? {
          ratio: latest.ratio,
          uploadedBytes: latest.uploadedBytes.toString(),
          downloadedBytes: latest.downloadedBytes.toString(),
          seedingCount: latest.seedingCount,
          leechingCount: latest.leechingCount,
          requiredRatio: latest.requiredRatio ?? null,
          warned: latest.warned ?? null,
          freeleechTokens: latest.freeleechTokens ?? null,
          bufferBytes: latest.bufferBytes?.toString() ?? null,
          hitAndRuns: latest.hitAndRuns ?? null,
          seedbonus: latest.seedbonus ?? null,
          shareScore: latest.shareScore ?? null,
          username: mask(latest.username),
          group: mask(latest.group),
        }
      : null,
  }
}
