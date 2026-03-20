// src/lib/server-data.ts
//
// Functions: fetchSettings, serializeSettingsResponse, getSettingsForClient,
// getTrackerListForDashboard, getTrackerForClient, getSnapshotsForTracker,
// getTagGroupsWithMembers
// Constants: settingsColumns, trackerColumns
//
// Server-side data fetchers: single source of truth for safe DB queries
// that return client-safe shapes. Used by both API route handlers and
// Server Component pages.
//
// SECURITY CONTRACT: These functions NEVER return encrypted fields.
// Encrypted/sensitive columns excluded by design:
//   appSettings: passwordHash, encryptionSalt, totpSecret, totpBackupCodes,
//     failedLoginAttempts, lockedUntil, encryptedProxyPassword,
//     encryptedBackupPassword, encryptedSchedulerKey
//   trackers: encryptedApiToken
//   downloadClients: encryptedUsername, encryptedPassword
//   notificationTargets: encryptedConfig

import "server-only"

import { and, asc, desc, eq, gte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  appSettings,
  tagGroupMembers,
  tagGroups as tagGroupsTable,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { createPrivacyMaskSync } from "@/lib/privacy-db"
import { parseQbitmanageTags } from "@/lib/qbitmanage-defaults"
import { serializeTrackerResponse } from "@/lib/tracker-serializer"
import type { Snapshot, TagGroup, TagGroupChartType } from "@/types/api"

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Explicit column projection for appSettings. Uses allowlisted columns only —
 * encrypted/sensitive fields are structurally excluded at the query level.
 *
 * Note: `hasProxyPassword` and `hasBackupPassword` select the encrypted column
 * references so the serializer can coerce them to booleans. The raw ciphertext
 * is never returned to clients — serializeSettingsResponse() converts these to
 * `!!value` before the data leaves the server.
 */
export const settingsColumns = {
  storeUsernames: appSettings.storeUsernames,
  username: appSettings.username,
  sessionTimeoutMinutes: appSettings.sessionTimeoutMinutes,
  lockoutEnabled: appSettings.lockoutEnabled,
  lockoutThreshold: appSettings.lockoutThreshold,
  lockoutDurationMinutes: appSettings.lockoutDurationMinutes,
  snapshotRetentionDays: appSettings.snapshotRetentionDays,
  trackerPollIntervalMinutes: appSettings.trackerPollIntervalMinutes,
  proxyEnabled: appSettings.proxyEnabled,
  proxyType: appSettings.proxyType,
  proxyHost: appSettings.proxyHost,
  proxyPort: appSettings.proxyPort,
  proxyUsername: appSettings.proxyUsername,
  hasProxyPassword: appSettings.encryptedProxyPassword,
  qbitmanageEnabled: appSettings.qbitmanageEnabled,
  qbitmanageTags: appSettings.qbitmanageTags,
  backupScheduleEnabled: appSettings.backupScheduleEnabled,
  backupScheduleFrequency: appSettings.backupScheduleFrequency,
  backupRetentionCount: appSettings.backupRetentionCount,
  backupEncryptionEnabled: appSettings.backupEncryptionEnabled,
  hasBackupPassword: appSettings.encryptedBackupPassword,
  backupStoragePath: appSettings.backupStoragePath,
}

export function fetchSettings() {
  return db.select(settingsColumns).from(appSettings).limit(1)
}

export type SettingsRow = Awaited<ReturnType<typeof fetchSettings>>[number]

/**
 * Converts a raw settings DB row into a client-safe JSON-serializable shape.
 * Coerces encrypted column references to boolean presence flags.
 */
export function serializeSettingsResponse(row: SettingsRow) {
  return {
    storeUsernames: row.storeUsernames,
    username: row.username,
    sessionTimeoutMinutes: row.sessionTimeoutMinutes,
    lockoutEnabled: row.lockoutEnabled,
    lockoutThreshold: row.lockoutThreshold,
    lockoutDurationMinutes: row.lockoutDurationMinutes,
    snapshotRetentionDays: row.snapshotRetentionDays,
    trackerPollIntervalMinutes: row.trackerPollIntervalMinutes,
    proxyEnabled: row.proxyEnabled,
    proxyType: row.proxyType,
    proxyHost: row.proxyHost,
    proxyPort: row.proxyPort,
    proxyUsername: row.proxyUsername,
    hasProxyPassword: !!row.hasProxyPassword,
    qbitmanageEnabled: row.qbitmanageEnabled,
    qbitmanageTags: parseQbitmanageTags(row.qbitmanageTags),
    backupScheduleEnabled: row.backupScheduleEnabled,
    backupScheduleFrequency: row.backupScheduleFrequency,
    backupRetentionCount: row.backupRetentionCount,
    backupEncryptionEnabled: row.backupEncryptionEnabled,
    hasBackupPassword: !!row.hasBackupPassword,
    backupStoragePath: row.backupStoragePath,
  }
}

/**
 * Convenience wrapper: fetches settings and serializes for the client.
 * Returns null if no settings row exists (app not yet configured).
 */
export async function getSettingsForClient() {
  const [row] = await fetchSettings()
  if (!row) return null
  return serializeSettingsResponse(row)
}

// ---------------------------------------------------------------------------
// Tracker list (dashboard)
// ---------------------------------------------------------------------------

/**
 * Explicit column projection for trackers. Excludes encryptedApiToken at the
 * query level so the ciphertext never enters server process memory. Also
 * excludes avatarData (potentially large base64) since the serializer
 * doesn't include it. Avatars are served via a dedicated API route.
 */
export const trackerColumns = {
  id: trackers.id,
  name: trackers.name,
  baseUrl: trackers.baseUrl,
  apiPath: trackers.apiPath,
  platformType: trackers.platformType,
  isActive: trackers.isActive,
  lastPolledAt: trackers.lastPolledAt,
  lastError: trackers.lastError,
  consecutiveFailures: trackers.consecutiveFailures,
  pausedAt: trackers.pausedAt,
  color: trackers.color,
  qbtTag: trackers.qbtTag,
  remoteUserId: trackers.remoteUserId,
  platformMeta: trackers.platformMeta,
  useProxy: trackers.useProxy,
  countCrossSeedUnsatisfied: trackers.countCrossSeedUnsatisfied,
  isFavorite: trackers.isFavorite,
  sortOrder: trackers.sortOrder,
  joinedAt: trackers.joinedAt,
  lastAccessAt: trackers.lastAccessAt,
  createdAt: trackers.createdAt,
  updatedAt: trackers.updatedAt,
}

/** Return type for serialized tracker + latest snapshot. */
export type TrackerSummary = ReturnType<typeof serializeTrackerResponse>

/**
 * Fetches all trackers with their latest snapshot for the dashboard.
 * Applies privacy masking at response time. Never returns encryptedApiToken.
 */
export async function getTrackerListForDashboard(): Promise<TrackerSummary[]> {
  const [allTrackers, [privacySettings]] = await Promise.all([
    db.select(trackerColumns).from(trackers).orderBy(trackers.createdAt),
    db.select({ storeUsernames: appSettings.storeUsernames }).from(appSettings).limit(1),
  ])

  // Enforce masking at response time -- even if DB has plaintext from before
  // privacy was enabled, the API never leaks it when privacy mode is on.
  // Fallback true = "store usernames" = no masking. Matches createPrivacyMask()
  // behavior when no settings row exists. Do NOT change to false.
  const mask = createPrivacyMaskSync(privacySettings?.storeUsernames ?? true)

  // Batch-fetch the latest snapshot per tracker using DISTINCT ON.
  // PG18's enable_distinct_reordering planner flag optimises exactly this pattern.
  // Drizzle has no native DISTINCT ON support, so we use db.execute with a raw sql tag. I know, I know.
  // security-audit-ignore: static SQL string with zero user input -- no injection risk
  const latestSnapshots = (await db.execute(sql`
    SELECT DISTINCT ON (tracker_id)
      id,
      tracker_id        AS "trackerId",
      polled_at          AS "polledAt",
      uploaded_bytes     AS "uploadedBytes",
      downloaded_bytes   AS "downloadedBytes",
      ratio,
      buffer_bytes       AS "bufferBytes",
      seeding_count      AS "seedingCount",
      leeching_count     AS "leechingCount",
      seedbonus,
      hit_and_runs       AS "hitAndRuns",
      required_ratio     AS "requiredRatio",
      warned,
      freeleech_tokens   AS "freeleechTokens",
      share_score        AS "shareScore",
      username,
      group_name         AS "group"
    FROM tracker_snapshots
    ORDER BY tracker_id, polled_at DESC
  `)) as unknown as (typeof trackerSnapshots.$inferSelect)[]

  // Build a lookup map for O(1) access
  const snapshotByTracker = new Map(latestSnapshots.map((s) => [s.trackerId, s]))

  // SECURITY: Never include encryptedApiToken in response
  // security-audit-ignore: serializeTrackerResponse omits encryptedApiToken by design
  return allTrackers.map((tracker) => {
    const latest = snapshotByTracker.get(tracker.id) ?? null
    return serializeTrackerResponse(tracker, latest, mask)
  })
}

// ---------------------------------------------------------------------------
// Single tracker
// ---------------------------------------------------------------------------

/**
 * Fetches a single tracker by ID with its latest snapshot.
 * Returns null if the tracker is not found.
 * Applies privacy masking. Never returns encryptedApiToken.
 */
export async function getTrackerForClient(id: number): Promise<TrackerSummary | null> {
  const [[tracker], [latest], [privacySettings]] = await Promise.all([
    db.select(trackerColumns).from(trackers).where(eq(trackers.id, id)).limit(1),
    db
      .select()
      .from(trackerSnapshots)
      .where(eq(trackerSnapshots.trackerId, id))
      .orderBy(desc(trackerSnapshots.polledAt))
      .limit(1),
    db.select({ storeUsernames: appSettings.storeUsernames }).from(appSettings).limit(1),
  ])

  if (!tracker) return null

  // Fallback true = "store usernames" = no masking. Matches createPrivacyMask()
  // behavior when no settings row exists. Do NOT change to false.
  // Why? Because I said so.
  const mask = createPrivacyMaskSync(privacySettings?.storeUsernames ?? true)

  // security-audit-ignore: serializeTrackerResponse omits encryptedApiToken by design
  return serializeTrackerResponse(tracker, latest ?? null, mask)
}

// ---------------------------------------------------------------------------
// Snapshots for a tracker
// ---------------------------------------------------------------------------

/**
 * Fetches snapshots for a tracker, filtered by day range.
 * Pass days=0 for all snapshots. Applies privacy masking.
 */
export async function getSnapshotsForTracker(trackerId: number, days: number): Promise<Snapshot[]> {
  const safeDays = days === 0 ? 0 : Math.min(Math.max(days, 1), 3650)

  const conditions = [eq(trackerSnapshots.trackerId, trackerId)]
  if (safeDays > 0) {
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000)
    conditions.push(gte(trackerSnapshots.polledAt, since))
  }

  const [snapshots, [privacySettings]] = await Promise.all([
    db
      .select()
      .from(trackerSnapshots)
      .where(and(...conditions))
      .orderBy(trackerSnapshots.polledAt),
    db.select({ storeUsernames: appSettings.storeUsernames }).from(appSettings).limit(1),
  ])

  // Enforce masking at response time. even if DB has plaintext from before
  // privacy mode was enabled. Fallback true = "store usernames" = no masking.
  const mask = createPrivacyMaskSync(privacySettings?.storeUsernames ?? true)

  // Serialize bigints to strings for JSON. Username/group are included because
  // detectRankChanges needs them. When privacy mode is on, values are masked
  // before leaving the server.
  return snapshots.map((s) => ({
    polledAt: s.polledAt.toISOString(),
    uploadedBytes: s.uploadedBytes?.toString() ?? "0",
    downloadedBytes: s.downloadedBytes?.toString() ?? "0",
    ratio: s.ratio,
    bufferBytes: s.bufferBytes?.toString() ?? "0",
    seedingCount: s.seedingCount,
    leechingCount: s.leechingCount,
    seedbonus: s.seedbonus,
    hitAndRuns: s.hitAndRuns,
    requiredRatio: s.requiredRatio,
    warned: s.warned,
    freeleechTokens: s.freeleechTokens,
    shareScore: s.shareScore,
    username: mask(s.username),
    group: mask(s.group),
  }))
}

// ---------------------------------------------------------------------------
// Tag groups with members
// ---------------------------------------------------------------------------

/**
 * Fetches all tag groups with their members in a single two-query batch.
 */
export async function getTagGroupsWithMembers(): Promise<TagGroup[]> {
  const [groups, allMembers] = await Promise.all([
    db.select().from(tagGroupsTable).orderBy(asc(tagGroupsTable.sortOrder), asc(tagGroupsTable.id)),
    db.select().from(tagGroupMembers).orderBy(asc(tagGroupMembers.sortOrder)),
  ])

  const membersByGroup = new Map<number, typeof allMembers>()
  for (const m of allMembers) {
    const list = membersByGroup.get(m.groupId) ?? []
    list.push(m)
    membersByGroup.set(m.groupId, list)
  }

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji,
    chartType: g.chartType as TagGroupChartType,
    description: g.description,
    sortOrder: g.sortOrder,
    countUnmatched: g.countUnmatched,
    members: membersByGroup.get(g.id) ?? [],
  }))
}
