// src/lib/tracker-serializer.ts
import "server-only"

import type { PlatformType } from "@/data/platform-types"
import { DEFAULT_TRACKER_COLOR } from "@/lib/constants"
import type { TrackerRow as FullTrackerRow, TrackerSnapshotRow } from "@/lib/db/schema"
import type { TrackerSummary } from "@/types/api"
import type { PlatformMeta } from "@/types/tracker-stats"

// The ciphertext columns are omitted from the input type, not just left out of
// the output object. Callers physically cannot hand this function a secret, so
// no future edit here can serialize one by reaching for a property that was
// never in scope. encryptedCredentials joins encryptedApiToken for that reason:
// the credential vault leaves the server only via the reveal endpoint.
type TrackerRow = Omit<
  FullTrackerRow,
  | "encryptedApiToken"
  | "encryptedCredentials"
  | "avatarData"
  | "avatarMimeType"
  | "avatarCachedAt"
  | "avatarRemoteUrl"
>

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
    registrySlug: tracker.registrySlug ?? null,
    platformType: tracker.platformType as PlatformType,
    isActive: tracker.isActive,
    lastPolledAt: tracker.lastPolledAt?.toISOString() ?? null,
    lastError: tracker.lastError,
    lastErrorAt: tracker.lastErrorAt?.toISOString() ?? null,
    consecutiveFailures: tracker.consecutiveFailures,
    pausedAt: tracker.pausedAt?.toISOString() ?? null,
    userPausedAt: tracker.userPausedAt?.toISOString() ?? null,
    color: tracker.color ?? DEFAULT_TRACKER_COLOR,
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
          // Derived from byte totals, not the stored `ratio`. JSON turns Infinity
          // into null, so this flag is what carries an infinite ratio.
          ratioIsInfinite: latest.downloadedBytes === 0n && latest.uploadedBytes > 0n,
          // Never emit a non-finite number: it serializes to null anyway, and
          // doing it explicitly keeps the contract obvious at the boundary.
          ratio: Number.isFinite(latest.ratio) ? latest.ratio : null,
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
