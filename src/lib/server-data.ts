// src/lib/server-data.ts
//
// Functions: fetchSettings, serializeSettingsResponse, getSettingsForClient,
// getTrackerListForDashboard, getTrackerForClient, getSnapshotsForTracker,
// getFleetSnapshots, getTagGroupsWithMembers, getProxyTrackers, getDatabaseSize,
// getDatabaseSizeBytes, recordDatabaseSize, getDbSizeHistory,
// fetchClients, serializeClientResponse, fetchNotificationTargets,
// serializeNotificationTarget
// Constants: settingsColumns, trackerColumns, snapshotColumns, clientColumns,
// notificationTargetColumns
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
import { DEFAULT_TRACKER_COLOR } from "@/lib/constants"
import { db } from "@/lib/db"
import {
  appSettings,
  dbSizeHistory,
  downloadClients,
  notificationTargets,
  tagGroupMembers,
  tagGroups as tagGroupsTable,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { parseQbitmanageTags } from "@/lib/download-clients/qbt/qbitmanage-defaults"
import { localDateStr } from "@/lib/formatters"
import { createPrivacyMaskSync } from "@/lib/privacy-db"
import { serializeTrackerResponse } from "@/lib/tracker-serializer"
import type { Snapshot, TagGroup, TagGroupChartType, TrackerSummary } from "@/types/api"

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Explicit column projection for appSettings. Uses allowlisted columns only —
 * encrypted/sensitive fields are structurally excluded at the query level.
 *
 * Note: `hasProxyPassword` and `hasBackupPassword` select the encrypted column
 * references so the serializer can coerce them to booleans. The raw ciphertext
 * is never returned to clients and serializeSettingsResponse() converts these to
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
  hasPtpimgKey: appSettings.encryptedPtpimgApiKey,
  hasOeimgKey: appSettings.encryptedOeimgApiKey,
  hasImgbbKey: appSettings.encryptedImgbbApiKey,
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
    hasPtpimgKey: !!row.hasPtpimgKey,
    hasOeimgKey: !!row.hasOeimgKey,
    hasImgbbKey: !!row.hasImgbbKey,
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
 * fetches settings and serializes for the client.
 * Returns null if no settings row exists (app not yet configured).
 */
export async function getSettingsForClient() {
  const [row] = await fetchSettings()
  if (!row) return null
  return serializeSettingsResponse(row)
}

// ---------------------------------------------------------------------------
// Download clients
// ---------------------------------------------------------------------------

/**
 * Explicit column projection for downloadClients. Excludes encryptedUsername
 * and encryptedPassword at the query level via a SQL boolean expression so the
 * ciphertext never enters server process memory. Also excludes cachedTorrents
 * (potentially large JSONB) and cachedTorrentsAt (internal scheduler state).
 */
export const clientColumns = {
  id: downloadClients.id,
  name: downloadClients.name,
  type: downloadClients.type,
  enabled: downloadClients.enabled,
  host: downloadClients.host,
  port: downloadClients.port,
  useSsl: downloadClients.useSsl,
  hasCredentials:
    sql<boolean>`(${downloadClients.encryptedUsername} IS NOT NULL AND ${downloadClients.encryptedPassword} IS NOT NULL)`.as(
      "has_credentials"
    ),
  pollIntervalSeconds: downloadClients.pollIntervalSeconds,
  isDefault: downloadClients.isDefault,
  crossSeedTags: downloadClients.crossSeedTags,
  lastPolledAt: downloadClients.lastPolledAt,
  lastError: downloadClients.lastError,
  errorSince: downloadClients.errorSince,
  createdAt: downloadClients.createdAt,
  updatedAt: downloadClients.updatedAt,
}

export function fetchClients() {
  return db.select(clientColumns).from(downloadClients).orderBy(downloadClients.createdAt)
}

export type ClientRow = Awaited<ReturnType<typeof fetchClients>>[number]

export function serializeClientResponse(row: ClientRow) {
  return {
    ...row,
    crossSeedTags: row.crossSeedTags ?? [],
    lastPolledAt: row.lastPolledAt?.toISOString() ?? null,
    errorSince: row.errorSince?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Notification targets
// ---------------------------------------------------------------------------

/**
 * Explicit column projection for notificationTargets. Excludes encryptedConfig
 * at the query level via a SQL boolean expression so the ciphertext never
 * enters server process memory.
 */
export const notificationTargetColumns = {
  id: notificationTargets.id,
  name: notificationTargets.name,
  type: notificationTargets.type,
  enabled: notificationTargets.enabled,
  hasConfig: sql<boolean>`(${notificationTargets.encryptedConfig} IS NOT NULL)`.as("has_config"),
  notifyRatioDrop: notificationTargets.notifyRatioDrop,
  notifyHitAndRun: notificationTargets.notifyHitAndRun,
  notifyTrackerDown: notificationTargets.notifyTrackerDown,
  notifyBufferMilestone: notificationTargets.notifyBufferMilestone,
  notifyWarned: notificationTargets.notifyWarned,
  notifyRatioDanger: notificationTargets.notifyRatioDanger,
  notifyZeroSeeding: notificationTargets.notifyZeroSeeding,
  notifyRankChange: notificationTargets.notifyRankChange,
  notifyAnniversary: notificationTargets.notifyAnniversary,
  notifyBonusCap: notificationTargets.notifyBonusCap,
  notifyVipExpiring: notificationTargets.notifyVipExpiring,
  notifyUnsatisfiedLimit: notificationTargets.notifyUnsatisfiedLimit,
  notifyActiveHnrs: notificationTargets.notifyActiveHnrs,
  notifyDownloadDisabled: notificationTargets.notifyDownloadDisabled,
  thresholds: notificationTargets.thresholds,
  includeTrackerName: notificationTargets.includeTrackerName,
  scope: notificationTargets.scope,
  lastDeliveryStatus: notificationTargets.lastDeliveryStatus,
  lastDeliveryAt: notificationTargets.lastDeliveryAt,
  lastDeliveryError: notificationTargets.lastDeliveryError,
  createdAt: notificationTargets.createdAt,
  updatedAt: notificationTargets.updatedAt,
}

export function fetchNotificationTargets() {
  return db.select(notificationTargetColumns).from(notificationTargets)
}

export type NotificationTargetRow = Awaited<ReturnType<typeof fetchNotificationTargets>>[number]

export function serializeNotificationTarget(row: NotificationTargetRow) {
  return {
    ...row,
    lastDeliveryAt: row.lastDeliveryAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
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
  userPausedAt: trackers.userPausedAt,
  color: trackers.color,
  qbtTag: trackers.qbtTag,
  mouseholeUrl: trackers.mouseholeUrl,
  remoteUserId: trackers.remoteUserId,
  platformMeta: trackers.platformMeta,
  useProxy: trackers.useProxy,
  countCrossSeedUnsatisfied: trackers.countCrossSeedUnsatisfied,
  hideUnreadBadges: trackers.hideUnreadBadges,
  isFavorite: trackers.isFavorite,
  sortOrder: trackers.sortOrder,
  joinedAt: trackers.joinedAt,
  lastAccessAt: trackers.lastAccessAt,
  profileUrl: trackers.profileUrl,
  createdAt: trackers.createdAt,
  updatedAt: trackers.updatedAt,
}

/**
 * Fetches all trackers with their latest snapshot for the dashboard.
 * Applies privacy masking at response time. Never returns encryptedApiToken.
 */
export async function getTrackerListForDashboard(): Promise<TrackerSummary[]> {
  const [allTrackers, [privacySettings], latestSnapshots] = await Promise.all([
    db.select(trackerColumns).from(trackers).orderBy(trackers.createdAt),
    db.select({ storeUsernames: appSettings.storeUsernames }).from(appSettings).limit(1),
    db
      .selectDistinctOn([trackerSnapshots.trackerId])
      .from(trackerSnapshots)
      .orderBy(trackerSnapshots.trackerId, desc(trackerSnapshots.polledAt)),
  ])

  // Enforce masking at response time
  // Fallback true = "store usernames" = no masking. Matches createPrivacyMask()
  // behavior when no settings row exists. Do NOT change to false.
  const mask = createPrivacyMaskSync(privacySettings?.storeUsernames ?? true)

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

const snapshotColumns = {
  polledAt: trackerSnapshots.polledAt,
  uploadedBytes: trackerSnapshots.uploadedBytes,
  downloadedBytes: trackerSnapshots.downloadedBytes,
  ratio: trackerSnapshots.ratio,
  bufferBytes: trackerSnapshots.bufferBytes,
  seedingCount: trackerSnapshots.seedingCount,
  leechingCount: trackerSnapshots.leechingCount,
  seedbonus: trackerSnapshots.seedbonus,
  hitAndRuns: trackerSnapshots.hitAndRuns,
  requiredRatio: trackerSnapshots.requiredRatio,
  warned: trackerSnapshots.warned,
  freeleechTokens: trackerSnapshots.freeleechTokens,
  shareScore: trackerSnapshots.shareScore,
  username: trackerSnapshots.username,
  group: trackerSnapshots.group,
}

/** Pick a date_trunc bucket for chart queries based on requested day range. null = raw. */
function getSnapshotBucket(days: number): "hour" | "day" | null {
  if (days > 0 && days <= 2) return null
  if (days > 0 && days <= 90) return "hour"
  return "day"
}

/**
 * Fetches snapshots for a tracker, filtered by day range.
 * Pass days=0 for all snapshots. Applies adaptive time-bucketing for
 * longer ranges (hourly for 3-90d, daily for >90d) to bound response size.
 * Applies privacy masking.
 */
export async function getSnapshotsForTracker(trackerId: number, days: number): Promise<Snapshot[]> {
  const safeDays = days === 0 ? 0 : Math.min(Math.max(days, 1), 3650)

  const conditions = [eq(trackerSnapshots.trackerId, trackerId)]
  if (safeDays > 0) {
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000)
    conditions.push(gte(trackerSnapshots.polledAt, since))
  }

  const bucket = getSnapshotBucket(safeDays)
  const whereClause = and(...conditions)

  const [snapshots, [privacySettings]] = await Promise.all([
    bucket
      ? (() => {
          const bucketExpr = sql`date_trunc(${sql.raw(`'${bucket}'`)}, ${trackerSnapshots.polledAt})`
          return db
            .selectDistinctOn([bucketExpr], snapshotColumns)
            .from(trackerSnapshots)
            .where(whereClause)
            .orderBy(bucketExpr, desc(trackerSnapshots.polledAt))
        })()
      : db
          .select(snapshotColumns)
          .from(trackerSnapshots)
          .where(whereClause)
          .orderBy(trackerSnapshots.polledAt),
    db.select({ storeUsernames: appSettings.storeUsernames }).from(appSettings).limit(1),
  ])

  const mask = createPrivacyMaskSync(privacySettings?.storeUsernames ?? true)

  return snapshots.map((s) => serializeSnapshot(s, mask))
}

function serializeSnapshot(
  s: {
    polledAt: Date
    uploadedBytes: bigint | null
    downloadedBytes: bigint | null
    ratio: number | null
    bufferBytes: bigint | null
    seedingCount: number | null
    leechingCount: number | null
    seedbonus: number | null
    hitAndRuns: number | null
    requiredRatio: number | null
    warned: boolean | null
    freeleechTokens: number | null
    shareScore: number | null
    username: string | null
    group: string | null
  },
  mask: (v: string | null) => string | null
): Snapshot {
  return {
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
  }
}

/**
 * Fetches bucketed snapshots for ALL trackers in a single query.
 * Same bucketing logic as getSnapshotsForTracker but partitioned by tracker_id.
 * Eliminates N+1 queries from the dashboard.
 */
export type FleetSnapshotMap = Record<string, Snapshot[]>

export async function getFleetSnapshots(days: number): Promise<FleetSnapshotMap> {
  const safeDays = days === 0 ? 0 : Math.min(Math.max(days, 1), 3650)
  const bucket = getSnapshotBucket(safeDays)

  const sinceCondition =
    safeDays > 0
      ? gte(trackerSnapshots.polledAt, new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000))
      : undefined

  const columnsWithTracker = { ...snapshotColumns, trackerId: trackerSnapshots.trackerId }

  const [rows, [privacySettings]] = await Promise.all([
    bucket
      ? (() => {
          const bucketExpr = sql`date_trunc(${sql.raw(`'${bucket}'`)}, ${trackerSnapshots.polledAt})`
          return db
            .selectDistinctOn([trackerSnapshots.trackerId, bucketExpr], columnsWithTracker)
            .from(trackerSnapshots)
            .where(sinceCondition)
            .orderBy(trackerSnapshots.trackerId, bucketExpr, desc(trackerSnapshots.polledAt))
        })()
      : db
          .select(columnsWithTracker)
          .from(trackerSnapshots)
          .where(sinceCondition)
          .orderBy(trackerSnapshots.trackerId, trackerSnapshots.polledAt),
    db.select({ storeUsernames: appSettings.storeUsernames }).from(appSettings).limit(1),
  ])

  const mask = createPrivacyMaskSync(privacySettings?.storeUsernames ?? true)

  const result: FleetSnapshotMap = {}
  for (const s of rows) {
    const key = String(s.trackerId)
    if (!result[key]) result[key] = []
    result[key].push(serializeSnapshot(s, mask))
  }
  return result
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

// ---------------------------------------------------------------------------
// Proxy trackers
// ---------------------------------------------------------------------------

/**
 * Fetches only id, name, and color for trackers that have useProxy enabled.
 * Used by the settings page
 */
export async function getProxyTrackers(): Promise<{ id: number; name: string; color: string }[]> {
  const rows = await db
    .select({
      id: trackers.id,
      name: trackers.name,
      color: trackers.color,
    })
    .from(trackers)
    .where(eq(trackers.useProxy, true))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color ?? DEFAULT_TRACKER_COLOR,
  }))
}

// ---------------------------------------------------------------------------
// Database size
// ---------------------------------------------------------------------------

// security-audit-ignore: read-only PostgreSQL system function, no user input
export async function getDatabaseSize(): Promise<string> {
  const rows = await db.execute(
    sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`
  )
  return (rows as unknown as Array<{ size: string }>)[0]?.size ?? "Unknown"
}

/** Returns database size in bytes as a bigint */
// security-audit-ignore: read-only PostgreSQL system function, no user input
export async function getDatabaseSizeBytes(): Promise<bigint> {
  const rows = await db.execute(sql`SELECT pg_database_size(current_database()) as size_bytes`)
  const raw = (rows as unknown as Array<{ size_bytes: string }>)[0]?.size_bytes
  return raw ? BigInt(raw) : 0n
}

/** Record today's database size. Upserts — safe to call multiple times per day. */
export async function recordDatabaseSize(): Promise<void> {
  const totalBytes = await getDatabaseSizeBytes()
  const today = localDateStr(new Date())
  await db.insert(dbSizeHistory).values({ recordedAt: today, totalBytes }).onConflictDoUpdate({
    target: dbSizeHistory.recordedAt,
    set: { totalBytes },
  })
}

export interface DbSizeHistoryRow {
  date: string
  bytes: string // bigint serialized as string for JSON
}

export interface DbSizeResponse {
  history: DbSizeHistoryRow[]
  currentBytes: string
  dailyGrowthBytes: number
  projectedBytes: string
  projectionDate: string
}

/** Fetch full db size history and compute linear projection. */
export async function getDbSizeHistory(): Promise<DbSizeResponse> {
  const rows = await db
    .select({
      recordedAt: dbSizeHistory.recordedAt,
      totalBytes: dbSizeHistory.totalBytes,
    })
    .from(dbSizeHistory)
    .orderBy(dbSizeHistory.recordedAt)

  const history: DbSizeHistoryRow[] = rows.map((r) => ({
    date: r.recordedAt,
    bytes: r.totalBytes.toString(),
  }))

  const currentBytes = rows.length > 0 ? rows[rows.length - 1].totalBytes : 0n

  // Compute average daily growth from consecutive deltas
  let dailyGrowthBytes = 0
  if (rows.length >= 2) {
    const deltas: number[] = []
    for (let i = 1; i < rows.length; i++) {
      const delta = Number(rows[i].totalBytes - rows[i - 1].totalBytes)
      // Count days between points (may skip days if scheduler was off)
      const daysBetween = Math.max(
        1,
        Math.round(
          (new Date(rows[i].recordedAt).getTime() - new Date(rows[i - 1].recordedAt).getTime()) /
            86_400_000
        )
      )
      deltas.push(delta / daysBetween)
    }
    dailyGrowthBytes = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
  }

  // Project forward by the same number of days as we have history
  const historyDays = rows.length
  const projectedGrowth = Math.max(0, dailyGrowthBytes) * historyDays
  const projectedBytes = currentBytes + BigInt(Math.round(projectedGrowth))

  const projectionDate = new Date(Date.now() + historyDays * 86_400_000).toISOString().slice(0, 10)

  return {
    history,
    currentBytes: currentBytes.toString(),
    dailyGrowthBytes: Math.max(0, dailyGrowthBytes),
    projectedBytes: projectedBytes.toString(),
    projectionDate,
  }
}
