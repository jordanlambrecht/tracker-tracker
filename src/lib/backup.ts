// src/lib/backup.ts
//
// Functions: generateBackupPayload, validateBackupJson, encryptBackupPayload, decryptBackupPayload, pruneOldBackups

import { unlink } from "node:fs/promises"
import path from "node:path"
import { desc, eq, isNotNull } from "drizzle-orm"
import { decrypt, deriveKey, encrypt, generateSalt } from "@/lib/crypto"
import { db } from "@/lib/db"
import {
  appSettings,
  backupHistory,
  clientSnapshots,
  clientUptimeBuckets,
  dismissedAlerts,
  downloadClients,
  tagGroupMembers,
  tagGroups,
  trackerRoles,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { log } from "@/lib/logger"
import packageJson from "../../package.json"

export const CURRENT_BACKUP_VERSION = 1

export interface BackupManifest {
  version: number
  appVersion: string
  instanceUrl: string | null
  createdAt: string
  encrypted: boolean
  counts: Record<string, number>
}

export interface BackupPayload {
  manifest: BackupManifest
  settings: Record<string, unknown>
  trackers: Record<string, unknown>[]
  trackerSnapshots: Record<string, unknown>[]
  trackerRoles: Record<string, unknown>[]
  downloadClients: Record<string, unknown>[]
  tagGroups: Record<string, unknown>[]
  tagGroupMembers: Record<string, unknown>[]
  clientSnapshots: Record<string, unknown>[]
  clientUptimeBuckets?: Record<string, unknown>[]
  dismissedAlerts?: Record<string, unknown>[]
}

export interface EncryptedBackupEnvelope {
  format: "tracker-tracker-encrypted-backup"
  version: 1
  createdAt: string
  encryptionSalt: string
  ciphertext: string
}

// Serialize a single value — converts BigInt to decimal string and Date to ISO 8601.
function serializeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value
}

// Walk a plain object returned by Drizzle and serialize all leaf values.
function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    out[key] = serializeValue(row[key])
  }
  return out
}

export async function generateBackupPayload(): Promise<BackupPayload> {
  const now = new Date().toISOString()

  // appSettings — exclude: id, passwordHash, failedLoginAttempts, encryptedSchedulerKey, createdAt
  const [rawSettings] = await db.select().from(appSettings).limit(1)
  const settingsPayload: Record<string, unknown> = {}
  if (rawSettings) {
    const {
      id: _id,
      passwordHash: _passwordHash,
      failedLoginAttempts: _failedLoginAttempts,
      encryptedSchedulerKey: _encryptedSchedulerKey,
      createdAt: _createdAt,
      ...rest
    } = rawSettings
    for (const key of Object.keys(rest) as Array<keyof typeof rest>) {
      settingsPayload[key] = serializeValue(rest[key])
    }
  }

  // trackers — exclude: lastPolledAt, lastError
  const rawTrackers = await db.select().from(trackers).orderBy(trackers.id)
  const trackersPayload = rawTrackers.map((t) => {
    const { lastPolledAt: _lpa, lastError: _le, ...rest } = t
    return serializeRow(rest as Record<string, unknown>)
  })

  // trackerSnapshots — include all columns
  const rawSnapshots = await db.select().from(trackerSnapshots).orderBy(trackerSnapshots.id)
  const snapshotsPayload = rawSnapshots.map((s) => serializeRow(s as Record<string, unknown>))

  // trackerRoles — include all columns
  const rawRoles = await db.select().from(trackerRoles).orderBy(trackerRoles.id)
  const rolesPayload = rawRoles.map((r) => serializeRow(r as Record<string, unknown>))

  // downloadClients — exclude: lastPolledAt, lastError, cachedTorrents, cachedTorrentsAt
  const rawClients = await db.select().from(downloadClients).orderBy(downloadClients.id)
  const clientsPayload = rawClients.map((c) => {
    const {
      lastPolledAt: _lpa,
      lastError: _le,
      cachedTorrents: _ct,
      cachedTorrentsAt: _cta,
      ...rest
    } = c
    return serializeRow(rest as Record<string, unknown>)
  })

  // tagGroups — include all columns
  const rawTagGroups = await db.select().from(tagGroups).orderBy(tagGroups.id)
  const tagGroupsPayload = rawTagGroups.map((g) => serializeRow(g as Record<string, unknown>))

  // tagGroupMembers — include all columns
  const rawTagGroupMembers = await db.select().from(tagGroupMembers).orderBy(tagGroupMembers.id)
  const tagGroupMembersPayload = rawTagGroupMembers.map((m) =>
    serializeRow(m as Record<string, unknown>)
  )

  // clientSnapshots — include all columns
  const rawClientSnapshots = await db.select().from(clientSnapshots).orderBy(clientSnapshots.id)
  const clientSnapshotsPayload = rawClientSnapshots.map((cs) =>
    serializeRow(cs as Record<string, unknown>)
  )

  // clientUptimeBuckets — heartbeat history
  const rawUptimeBuckets = await db
    .select()
    .from(clientUptimeBuckets)
    .orderBy(clientUptimeBuckets.id)
  const uptimeBucketsPayload = rawUptimeBuckets.map((ub) =>
    serializeRow(ub as Record<string, unknown>)
  )

  // dismissedAlerts — include all columns
  const rawDismissedAlerts = await db.select().from(dismissedAlerts).orderBy(dismissedAlerts.id)
  const dismissedAlertsPayload = rawDismissedAlerts.map((a) =>
    serializeRow(a as Record<string, unknown>)
  )

  const counts: Record<string, number> = {
    trackers: trackersPayload.length,
    trackerSnapshots: snapshotsPayload.length,
    trackerRoles: rolesPayload.length,
    downloadClients: clientsPayload.length,
    tagGroups: tagGroupsPayload.length,
    tagGroupMembers: tagGroupMembersPayload.length,
    clientSnapshots: clientSnapshotsPayload.length,
    clientUptimeBuckets: uptimeBucketsPayload.length,
    dismissedAlerts: dismissedAlertsPayload.length,
  }

  const manifest: BackupManifest = {
    version: CURRENT_BACKUP_VERSION,
    appVersion: packageJson.version,
    instanceUrl: process.env.BASE_URL || null,
    createdAt: now,
    encrypted: false,
    counts,
  }

  return {
    manifest,
    settings: settingsPayload,
    trackers: trackersPayload,
    trackerSnapshots: snapshotsPayload,
    trackerRoles: rolesPayload,
    downloadClients: clientsPayload,
    tagGroups: tagGroupsPayload,
    tagGroupMembers: tagGroupMembersPayload,
    clientSnapshots: clientSnapshotsPayload,
    clientUptimeBuckets: uptimeBucketsPayload,
    dismissedAlerts: dismissedAlertsPayload,
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
const HEX_64_RE = /^[0-9a-fA-F]{64}$/
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
export const VALID_BACKUP_FREQUENCIES = new Set(["daily", "weekly", "monthly"])

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`Backup validation: ${label} must be a string`)
  }
}

function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Backup validation: ${label} must be a number`)
  }
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Backup validation: ${label} must be an array`)
  }
}

function assertValidIso(value: unknown, label: string): void {
  assertString(value, label)
  if (!ISO_8601_RE.test(value)) {
    throw new Error(`Backup validation: ${label} must be a valid ISO 8601 string`)
  }
}

// ─── Public validation ────────────────────────────────────────────────────────

export function validateBackupJson(payload: unknown): asserts payload is BackupPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Backup validation: payload must be an object")
  }

  const p = payload as Record<string, unknown>

  // manifest
  if (typeof p.manifest !== "object" || p.manifest === null) {
    throw new Error("Backup validation: manifest must be an object")
  }
  const manifest = p.manifest as Record<string, unknown>

  if (manifest.version !== CURRENT_BACKUP_VERSION) {
    throw new Error(
      `Backup validation: unsupported backup version ${manifest.version} (expected ${CURRENT_BACKUP_VERSION})`
    )
  }

  assertValidIso(manifest.createdAt, "manifest.createdAt")

  if (
    typeof manifest.counts !== "object" ||
    manifest.counts === null ||
    Array.isArray(manifest.counts)
  ) {
    throw new Error("Backup validation: manifest.counts must be an object")
  }
  for (const [k, v] of Object.entries(manifest.counts as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
      throw new Error(`Backup validation: manifest.counts.${k} must be a non-negative integer`)
    }
  }

  // settings
  if (typeof p.settings !== "object" || p.settings === null) {
    throw new Error("Backup validation: settings must be an object")
  }
  const settings = p.settings as Record<string, unknown>

  assertString(settings.encryptionSalt, "settings.encryptionSalt")
  if (!HEX_64_RE.test(settings.encryptionSalt)) {
    throw new Error("Backup validation: settings.encryptionSalt must be exactly 64 hex characters")
  }

  if (settings.backupScheduleFrequency !== undefined) {
    assertString(settings.backupScheduleFrequency, "settings.backupScheduleFrequency")
    if (!VALID_BACKUP_FREQUENCIES.has(settings.backupScheduleFrequency)) {
      throw new Error(
        `Backup validation: settings.backupScheduleFrequency must be one of: ${[...VALID_BACKUP_FREQUENCIES].join(", ")}`
      )
    }
  }

  if (settings.backupRetentionCount !== undefined) {
    assertNumber(settings.backupRetentionCount, "settings.backupRetentionCount")
    if (
      !Number.isInteger(settings.backupRetentionCount) ||
      settings.backupRetentionCount < 1 ||
      settings.backupRetentionCount > 365
    ) {
      throw new Error(
        "Backup validation: settings.backupRetentionCount must be an integer between 1 and 365"
      )
    }
  }

  // array fields
  assertArray(p.trackers, "trackers")
  assertArray(p.trackerSnapshots, "trackerSnapshots")
  assertArray(p.trackerRoles, "trackerRoles")
  assertArray(p.downloadClients, "downloadClients")
  assertArray(p.tagGroups, "tagGroups")
  assertArray(p.tagGroupMembers, "tagGroupMembers")
  assertArray(p.clientSnapshots, "clientSnapshots")
  // clientUptimeBuckets is optional for backward compatibility with older backups
  if (p.clientUptimeBuckets !== undefined) {
    assertArray(p.clientUptimeBuckets, "clientUptimeBuckets")
    for (let i = 0; i < p.clientUptimeBuckets.length; i++) {
      const ub = p.clientUptimeBuckets[i] as Record<string, unknown>
      const prefix = `clientUptimeBuckets[${i}]`
      assertNumber(ub.clientId, `${prefix}.clientId`)
      assertValidIso(ub.bucketTs, `${prefix}.bucketTs`)
      assertNumber(ub.ok, `${prefix}.ok`)
      assertNumber(ub.fail, `${prefix}.fail`)
    }
  }
  // dismissedAlerts is optional for backward compatibility with older backups
  if (p.dismissedAlerts !== undefined) {
    assertArray(p.dismissedAlerts, "dismissedAlerts")
  }

  // tracker entries
  for (let i = 0; i < p.trackers.length; i++) {
    const t = p.trackers[i] as Record<string, unknown>
    const prefix = `trackers[${i}]`

    assertString(t.name, `${prefix}.name`)
    if (t.name.length === 0 || t.name.length > 100) {
      throw new Error(`Backup validation: ${prefix}.name must be between 1 and 100 characters`)
    }

    assertString(t.baseUrl, `${prefix}.baseUrl`)
    try {
      new URL(t.baseUrl)
    } catch {
      throw new Error(`Backup validation: ${prefix}.baseUrl is not a valid URL`)
    }

    assertString(t.encryptedApiToken, `${prefix}.encryptedApiToken`)
    // Empty token is valid — happens after a restore clears encrypted fields

    if (t.color !== null && t.color !== undefined) {
      assertString(t.color, `${prefix}.color`)
      if (!HEX_COLOR_RE.test(t.color)) {
        throw new Error(`Backup validation: ${prefix}.color must be a valid hex color or null`)
      }
    }
  }

  // trackerSnapshot entries
  for (let i = 0; i < p.trackerSnapshots.length; i++) {
    const s = p.trackerSnapshots[i] as Record<string, unknown>
    const prefix = `trackerSnapshots[${i}]`

    assertNumber(s.trackerId, `${prefix}.trackerId`)

    assertString(s.uploadedBytes, `${prefix}.uploadedBytes`)
    try {
      BigInt(s.uploadedBytes)
    } catch {
      throw new Error(`Backup validation: ${prefix}.uploadedBytes must be parseable as BigInt`)
    }

    assertString(s.downloadedBytes, `${prefix}.downloadedBytes`)
    try {
      BigInt(s.downloadedBytes)
    } catch {
      throw new Error(`Backup validation: ${prefix}.downloadedBytes must be parseable as BigInt`)
    }

    assertValidIso(s.polledAt, `${prefix}.polledAt`)
  }

  // downloadClient entries
  for (let i = 0; i < p.downloadClients.length; i++) {
    const c = p.downloadClients[i] as Record<string, unknown>
    const prefix = `downloadClients[${i}]`

    assertString(c.host, `${prefix}.host`)

    assertNumber(c.port, `${prefix}.port`)
    if (!Number.isInteger(c.port) || c.port < 1 || c.port > 65535) {
      throw new Error(`Backup validation: ${prefix}.port must be an integer between 1 and 65535`)
    }

    assertString(c.encryptedUsername, `${prefix}.encryptedUsername`)
    // Empty credentials are valid — happens after a restore clears encrypted fields
    assertString(c.encryptedPassword, `${prefix}.encryptedPassword`)
  }

  // tagGroupMember entries
  for (let i = 0; i < p.tagGroupMembers.length; i++) {
    const m = p.tagGroupMembers[i] as Record<string, unknown>
    const prefix = `tagGroupMembers[${i}]`

    assertNumber(m.groupId, `${prefix}.groupId`)
    assertString(m.tag, `${prefix}.tag`)
    assertString(m.label, `${prefix}.label`)
  }
}

// ─── Encryption wrappers ──────────────────────────────────────────────────────

export async function encryptBackupPayload(
  payload: BackupPayload,
  password: string
): Promise<EncryptedBackupEnvelope> {
  const encryptionSalt = generateSalt() // Generate random salt per backup
  const encryptionKey = await deriveKey(password, encryptionSalt)
  const jsonString = JSON.stringify(payload)
  const ciphertext = encrypt(jsonString, encryptionKey)
  return {
    format: "tracker-tracker-encrypted-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    encryptionSalt,
    ciphertext,
  }
}

export function decryptBackupPayload(
  envelope: EncryptedBackupEnvelope,
  encryptionKey: Buffer
): BackupPayload {
  if (envelope.format !== "tracker-tracker-encrypted-backup") {
    throw new Error(
      `Invalid backup envelope format: expected "tracker-tracker-encrypted-backup", got "${envelope.format}"`
    )
  }
  const jsonString = decrypt(envelope.ciphertext, encryptionKey)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    throw new Error(
      "Failed to parse decrypted backup — data may be corrupted or the wrong key was used"
    )
  }
  validateBackupJson(parsed)
  return parsed
}

// ─── Pruning ──────────────────────────────────────────────────────────────────

export async function pruneOldBackups(retentionCount: number, basePath: string): Promise<number> {
  const allStored = await db
    .select()
    .from(backupHistory)
    .where(isNotNull(backupHistory.storagePath))
    .orderBy(desc(backupHistory.createdAt))

  if (allStored.length <= retentionCount) {
    return 0
  }

  const toDelete = allStored.slice(retentionCount)
  let deleted = 0

  for (const row of toDelete) {
    if (row.storagePath !== null) {
      const resolved = path.resolve(row.storagePath)
      const base = path.resolve(basePath)
      if (!resolved.startsWith(base + path.sep)) {
        log.error(`Backup prune: path ${resolved} is outside base ${base}, skipping file deletion`)
      } else {
        try {
          await unlink(resolved)
        } catch (err) {
          log.error(err, `Backup prune: failed to delete file ${resolved}`)
        }
      }
    }

    await db.delete(backupHistory).where(eq(backupHistory.id, row.id))
    deleted++
  }

  return deleted
}
