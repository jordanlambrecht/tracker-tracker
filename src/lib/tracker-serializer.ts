// src/lib/tracker-serializer.ts
//
// Functions: parsePlatformMeta, serializeTrackerResponse

import "server-only"

import type { trackerSnapshots, trackers } from "@/lib/db/schema"

type TrackerRow = typeof trackers.$inferSelect
type SnapshotRow = typeof trackerSnapshots.$inferSelect

export function parsePlatformMeta(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function serializeTrackerResponse(
  tracker: TrackerRow,
  latest: SnapshotRow | null,
  mask: (val: string | null | undefined) => string | null
) {
  return {
    id: tracker.id,
    name: tracker.name,
    baseUrl: tracker.baseUrl,
    platformType: tracker.platformType,
    isActive: tracker.isActive,
    lastPolledAt: tracker.lastPolledAt,
    lastError: tracker.lastError,
    consecutiveFailures: tracker.consecutiveFailures,
    pausedAt: tracker.pausedAt,
    color: tracker.color,
    qbtTag: tracker.qbtTag,
    useProxy: tracker.useProxy,
    countCrossSeedUnsatisfied: tracker.countCrossSeedUnsatisfied,
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
          uploadedBytes: latest.uploadedBytes?.toString(),
          downloadedBytes: latest.downloadedBytes?.toString(),
          seedingCount: latest.seedingCount,
          leechingCount: latest.leechingCount,
          requiredRatio: latest.requiredRatio ?? null,
          warned: latest.warned ?? null,
          freeleechTokens: latest.freeleechTokens ?? null,
          username: mask(latest.username),
          group: mask(latest.group),
        }
      : null,
  }
}
