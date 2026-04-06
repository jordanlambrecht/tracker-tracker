// src/app/api/settings/route.ts
//
// Functions: GET, PATCH

import { access, mkdir } from "node:fs/promises"
import path from "node:path"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  validateIntRange,
  validateMaxLength,
} from "@/lib/api-helpers"
import { VALID_BACKUP_FREQUENCIES } from "@/lib/backup"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { QBITMANAGE_KEYS } from "@/lib/download-clients/qbt/qbitmanage-defaults"
import {
  BACKUP_PASSWORD_MAX,
  BACKUP_RETENTION_MAX,
  BACKUP_RETENTION_MIN,
  CREDENTIAL_MAX,
  HOST_MAX,
  LOCKOUT_DURATION_MAX,
  LOCKOUT_DURATION_MIN,
  LOCKOUT_THRESHOLD_MAX,
  LOCKOUT_THRESHOLD_MIN,
  LONG_STRING_MAX,
  POLL_INTERVAL_MAX,
  POLL_INTERVAL_MIN,
  PORT_MAX,
  PORT_MIN,
  SESSION_TIMEOUT_MAX,
  SESSION_TIMEOUT_MIN,
  SHORT_NAME_MAX,
  SNAPSHOT_RETENTION_MAX,
  SNAPSHOT_RETENTION_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from "@/lib/limits"
import { log } from "@/lib/logger"
import { scrubSnapshotUsernames } from "@/lib/privacy-db"
import { fetchSettings, serializeSettingsResponse } from "@/lib/server-data"
import { PROXY_HOST_PATTERN, VALID_PROXY_TYPES } from "@/lib/tunnel"
import { isValidPort } from "@/lib/validators"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [settings] = await fetchSettings()

  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  return NextResponse.json(serializeSettingsResponse(settings))
}

export async function PATCH(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  // --- Username ---
  if (body.username !== undefined) {
    if (body.username === null || body.username === "") {
      updates.username = null
    } else if (typeof body.username === "string") {
      if (body.username.length < USERNAME_MIN || body.username.length > USERNAME_MAX) {
        return NextResponse.json(
          { error: `Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters` },
          { status: 400 }
        )
      }
      updates.username = body.username.trim()
    } else {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 })
    }
  }

  // --- Session timeout ---
  if (body.sessionTimeoutMinutes !== undefined) {
    if (body.sessionTimeoutMinutes === null || body.sessionTimeoutMinutes === 0) {
      updates.sessionTimeoutMinutes = null
    } else if (
      typeof body.sessionTimeoutMinutes === "number" &&
      Number.isInteger(body.sessionTimeoutMinutes)
    ) {
      if (
        body.sessionTimeoutMinutes < SESSION_TIMEOUT_MIN ||
        body.sessionTimeoutMinutes > SESSION_TIMEOUT_MAX
      ) {
        return NextResponse.json(
          {
            error: `Session timeout must be between ${SESSION_TIMEOUT_MIN} and ${SESSION_TIMEOUT_MAX} minutes`,
          },
          { status: 400 }
        )
      }
      updates.sessionTimeoutMinutes = body.sessionTimeoutMinutes
    } else {
      return NextResponse.json({ error: "Invalid session timeout" }, { status: 400 })
    }
  }

  // --- Lockout settings ---
  if (body.lockoutEnabled !== undefined) {
    if (typeof body.lockoutEnabled !== "boolean") {
      return NextResponse.json({ error: "lockoutEnabled must be a boolean" }, { status: 400 })
    }
    updates.lockoutEnabled = body.lockoutEnabled
    if (!body.lockoutEnabled) {
      updates.lockedUntil = null
      updates.failedLoginAttempts = 0
    }
  }

  if (body.lockoutThreshold !== undefined) {
    if (typeof body.lockoutThreshold !== "number") {
      return NextResponse.json({ error: "Invalid lockout threshold" }, { status: 400 })
    }
    const thresholdErr = validateIntRange(
      body.lockoutThreshold,
      LOCKOUT_THRESHOLD_MIN,
      LOCKOUT_THRESHOLD_MAX,
      "lockoutThreshold",
      `Lockout threshold must be between ${LOCKOUT_THRESHOLD_MIN} and ${LOCKOUT_THRESHOLD_MAX}`
    )
    if (thresholdErr) return thresholdErr
    updates.lockoutThreshold = body.lockoutThreshold
  }

  if (body.lockoutDurationMinutes !== undefined) {
    if (typeof body.lockoutDurationMinutes !== "number") {
      return NextResponse.json({ error: "Invalid lockout duration" }, { status: 400 })
    }
    const durationErr = validateIntRange(
      body.lockoutDurationMinutes,
      LOCKOUT_DURATION_MIN,
      LOCKOUT_DURATION_MAX,
      "lockoutDurationMinutes",
      `Lockout duration must be between ${LOCKOUT_DURATION_MIN} and ${LOCKOUT_DURATION_MAX} minutes`
    )
    if (durationErr) return durationErr
    updates.lockoutDurationMinutes = body.lockoutDurationMinutes
  }

  // --- Snapshot retention ---
  if (body.snapshotRetentionDays !== undefined) {
    if (body.snapshotRetentionDays === null || body.snapshotRetentionDays === 0) {
      updates.snapshotRetentionDays = null
    } else if (
      typeof body.snapshotRetentionDays === "number" &&
      Number.isInteger(body.snapshotRetentionDays)
    ) {
      if (
        body.snapshotRetentionDays < SNAPSHOT_RETENTION_MIN ||
        body.snapshotRetentionDays > SNAPSHOT_RETENTION_MAX
      ) {
        return NextResponse.json(
          {
            error: `Snapshot retention must be between ${SNAPSHOT_RETENTION_MIN} and ${SNAPSHOT_RETENTION_MAX} days`,
          },
          { status: 400 }
        )
      }
      updates.snapshotRetentionDays = body.snapshotRetentionDays
    } else {
      return NextResponse.json({ error: "Invalid snapshot retention" }, { status: 400 })
    }
  }

  // --- Tracker poll interval ---
  if (body.trackerPollIntervalMinutes !== undefined) {
    if (typeof body.trackerPollIntervalMinutes !== "number") {
      return NextResponse.json({ error: "Invalid poll interval" }, { status: 400 })
    }
    const pollErr = validateIntRange(
      body.trackerPollIntervalMinutes,
      POLL_INTERVAL_MIN,
      POLL_INTERVAL_MAX,
      "trackerPollIntervalMinutes",
      `Poll interval must be between ${POLL_INTERVAL_MIN} and ${POLL_INTERVAL_MAX} minutes`
    )
    if (pollErr) return pollErr
    updates.trackerPollIntervalMinutes = body.trackerPollIntervalMinutes
  }

  // --- Proxy config ---
  if (body.proxyEnabled !== undefined) {
    if (typeof body.proxyEnabled !== "boolean") {
      return NextResponse.json({ error: "proxyEnabled must be a boolean" }, { status: 400 })
    }
    updates.proxyEnabled = body.proxyEnabled
  }

  if (body.proxyType !== undefined) {
    if (typeof body.proxyType !== "string" || !VALID_PROXY_TYPES.has(body.proxyType)) {
      return NextResponse.json(
        { error: `proxyType must be one of: ${[...VALID_PROXY_TYPES].join(", ")}` },
        { status: 400 }
      )
    }
    updates.proxyType = body.proxyType
  }

  if (body.proxyHost !== undefined) {
    if (body.proxyHost === null || body.proxyHost === "") {
      updates.proxyHost = null
    } else if (typeof body.proxyHost === "string") {
      const proxyHostErr = validateMaxLength(body.proxyHost, HOST_MAX, "Proxy host")
      if (proxyHostErr) return proxyHostErr
      if (!PROXY_HOST_PATTERN.test(body.proxyHost)) {
        return NextResponse.json({ error: "Invalid proxy host format" }, { status: 400 })
      }
      updates.proxyHost = body.proxyHost.trim()
    } else {
      return NextResponse.json({ error: "Invalid proxy host" }, { status: 400 })
    }
  }

  if (body.proxyPort !== undefined) {
    if (body.proxyPort === null) {
      updates.proxyPort = null
    } else if (typeof body.proxyPort === "number" && Number.isInteger(body.proxyPort)) {
      if (!isValidPort(body.proxyPort)) {
        return NextResponse.json(
          { error: `Proxy port must be between ${PORT_MIN} and ${PORT_MAX}` },
          { status: 400 }
        )
      }
      updates.proxyPort = body.proxyPort
    } else {
      return NextResponse.json({ error: "Invalid proxy port" }, { status: 400 })
    }
  }

  if (body.proxyUsername !== undefined) {
    if (body.proxyUsername === null || body.proxyUsername === "") {
      updates.proxyUsername = null
    } else if (typeof body.proxyUsername === "string") {
      const proxyUsernameErr = validateMaxLength(
        body.proxyUsername,
        CREDENTIAL_MAX,
        "Proxy username"
      )
      if (proxyUsernameErr) return proxyUsernameErr
      updates.proxyUsername = body.proxyUsername
    } else {
      return NextResponse.json({ error: "Invalid proxy username" }, { status: 400 })
    }
  }

  if (body.proxyPassword !== undefined) {
    if (body.proxyPassword === null || body.proxyPassword === "") {
      updates.encryptedProxyPassword = null
    } else if (typeof body.proxyPassword === "string") {
      const proxyPasswordErr = validateMaxLength(
        body.proxyPassword,
        CREDENTIAL_MAX,
        "Proxy password"
      )
      if (proxyPasswordErr) return proxyPasswordErr
      const key = decodeKey(auth)
      updates.encryptedProxyPassword = encrypt(body.proxyPassword, key)
    } else {
      return NextResponse.json({ error: "Invalid proxy password" }, { status: 400 })
    }
  }

  // --- Store usernames (privacy toggle) ---
  if (body.storeUsernames !== undefined) {
    if (typeof body.storeUsernames !== "boolean") {
      return NextResponse.json({ error: "storeUsernames must be a boolean" }, { status: 400 })
    }
    updates.storeUsernames = body.storeUsernames

    // When disabling username storage, optionally scrub historical data
    if (!body.storeUsernames && body.scrubExisting) {
      await scrubSnapshotUsernames()
    }
  }

  // --- qbitmanage config ---
  if (body.qbitmanageEnabled !== undefined) {
    if (typeof body.qbitmanageEnabled !== "boolean") {
      return NextResponse.json({ error: "qbitmanageEnabled must be a boolean" }, { status: 400 })
    }
    updates.qbitmanageEnabled = body.qbitmanageEnabled
  }

  if (body.qbitmanageTags !== undefined) {
    if (
      typeof body.qbitmanageTags !== "object" ||
      body.qbitmanageTags === null ||
      Array.isArray(body.qbitmanageTags)
    ) {
      return NextResponse.json({ error: "qbitmanageTags must be an object" }, { status: 400 })
    }
    const incoming = body.qbitmanageTags as Record<string, unknown>
    const unknownKeys = Object.keys(incoming).filter(
      (k) => !(QBITMANAGE_KEYS as string[]).includes(k)
    )
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { error: `Unknown qbitmanageTags keys: ${unknownKeys.join(", ")}` },
        { status: 400 }
      )
    }
    const validatedTags: Record<string, { enabled: boolean; tag: string }> = {}
    for (const key of QBITMANAGE_KEYS) {
      const entry = incoming[key]
      if (entry === undefined) continue
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        return NextResponse.json(
          { error: `qbitmanageTags.${key} must be an object` },
          { status: 400 }
        )
      }
      const { enabled, tag } = entry as Record<string, unknown>
      if (typeof enabled !== "boolean") {
        return NextResponse.json(
          { error: `qbitmanageTags.${key}.enabled must be a boolean` },
          { status: 400 }
        )
      }
      if (typeof tag !== "string") {
        return NextResponse.json(
          { error: `qbitmanageTags.${key}.tag must be a string` },
          { status: 400 }
        )
      }
      if (tag.length === 0 || tag.length > SHORT_NAME_MAX) {
        return NextResponse.json(
          { error: `qbitmanageTags.${key}.tag must be between 1 and 100 characters` },
          { status: 400 }
        )
      }
      validatedTags[key] = { enabled, tag }
    }
    updates.qbitmanageTags = JSON.stringify(validatedTags)
  }

  // --- Backup schedule config ---
  if (body.backupScheduleEnabled !== undefined) {
    if (typeof body.backupScheduleEnabled !== "boolean") {
      return NextResponse.json(
        { error: "backupScheduleEnabled must be a boolean" },
        { status: 400 }
      )
    }
    updates.backupScheduleEnabled = body.backupScheduleEnabled
  }

  if (body.backupScheduleFrequency !== undefined) {
    if (
      typeof body.backupScheduleFrequency !== "string" ||
      !VALID_BACKUP_FREQUENCIES.has(body.backupScheduleFrequency)
    ) {
      return NextResponse.json(
        { error: "backupScheduleFrequency must be one of: daily, weekly, monthly" },
        { status: 400 }
      )
    }
    updates.backupScheduleFrequency = body.backupScheduleFrequency
  }

  if (body.backupRetentionCount !== undefined) {
    if (typeof body.backupRetentionCount !== "number") {
      return NextResponse.json({ error: "Invalid backup retention count" }, { status: 400 })
    }
    const retentionErr = validateIntRange(
      body.backupRetentionCount,
      BACKUP_RETENTION_MIN,
      BACKUP_RETENTION_MAX,
      "backupRetentionCount",
      `Backup retention count must be between ${BACKUP_RETENTION_MIN} and ${BACKUP_RETENTION_MAX}`
    )
    if (retentionErr) return retentionErr
    updates.backupRetentionCount = body.backupRetentionCount
  }

  if (body.backupEncryptionEnabled !== undefined) {
    if (typeof body.backupEncryptionEnabled !== "boolean") {
      return NextResponse.json(
        { error: "backupEncryptionEnabled must be a boolean" },
        { status: 400 }
      )
    }
    updates.backupEncryptionEnabled = body.backupEncryptionEnabled
    // When disabling encryption, clear the stored backup password
    if (!body.backupEncryptionEnabled) {
      updates.encryptedBackupPassword = null
    }
  }

  if (body.backupPassword !== undefined) {
    if (body.backupPassword === null || body.backupPassword === "") {
      updates.encryptedBackupPassword = null
    } else if (typeof body.backupPassword === "string") {
      const backupPasswordErr = validateMaxLength(
        body.backupPassword,
        BACKUP_PASSWORD_MAX,
        "Backup password"
      )
      if (backupPasswordErr) return backupPasswordErr
      const key = decodeKey(auth)
      updates.encryptedBackupPassword = encrypt(body.backupPassword, key)
    } else {
      return NextResponse.json({ error: "Invalid backup password" }, { status: 400 })
    }
  }

  // --- Image hosting API keys ---
  if (body.ptpimgApiKey !== undefined) {
    if (body.ptpimgApiKey === null || body.ptpimgApiKey === "") {
      updates.encryptedPtpimgApiKey = null
    } else if (typeof body.ptpimgApiKey === "string") {
      const ptpimgApiKeyErr = validateMaxLength(
        body.ptpimgApiKey,
        LONG_STRING_MAX,
        "PTPimg API key"
      )
      if (ptpimgApiKeyErr) return ptpimgApiKeyErr
      const key = decodeKey(auth)
      updates.encryptedPtpimgApiKey = encrypt(body.ptpimgApiKey, key)
    } else {
      return NextResponse.json({ error: "Invalid ptpimgApiKey" }, { status: 400 })
    }
  }

  if (body.oeimgApiKey !== undefined) {
    if (body.oeimgApiKey === null || body.oeimgApiKey === "") {
      updates.encryptedOeimgApiKey = null
    } else if (typeof body.oeimgApiKey === "string") {
      const oeimgApiKeyErr = validateMaxLength(
        body.oeimgApiKey,
        LONG_STRING_MAX,
        "OnlyImage API key"
      )
      if (oeimgApiKeyErr) return oeimgApiKeyErr
      const key = decodeKey(auth)
      updates.encryptedOeimgApiKey = encrypt(body.oeimgApiKey, key)
    } else {
      return NextResponse.json({ error: "Invalid oeimgApiKey" }, { status: 400 })
    }
  }

  if (body.imgbbApiKey !== undefined) {
    if (body.imgbbApiKey === null || body.imgbbApiKey === "") {
      updates.encryptedImgbbApiKey = null
    } else if (typeof body.imgbbApiKey === "string") {
      const imgbbApiKeyErr = validateMaxLength(body.imgbbApiKey, LONG_STRING_MAX, "ImgBB API key")
      if (imgbbApiKeyErr) return imgbbApiKeyErr
      const key = decodeKey(auth)
      updates.encryptedImgbbApiKey = encrypt(body.imgbbApiKey, key)
    } else {
      return NextResponse.json({ error: "Invalid imgbbApiKey" }, { status: 400 })
    }
  }

  if (body.backupStoragePath !== undefined) {
    if (body.backupStoragePath === null || body.backupStoragePath === "") {
      updates.backupStoragePath = null
    } else if (typeof body.backupStoragePath === "string") {
      const trimmedPath = body.backupStoragePath.trim()
      const backupStoragePathErr = validateMaxLength(
        trimmedPath,
        LONG_STRING_MAX,
        "Backup storage path"
      )
      if (backupStoragePathErr) return backupStoragePathErr
      if (!path.isAbsolute(trimmedPath) || trimmedPath.includes("..")) {
        return NextResponse.json(
          { error: "Backup storage path must be an absolute path with no '..' segments" },
          { status: 400 }
        )
      }
      try {
        await mkdir(trimmedPath, { recursive: true })
        await access(trimmedPath)
      } catch (err) {
        log.warn(err, `Backup storage path validation failed: ${trimmedPath}`)
        return NextResponse.json(
          { error: `Backup storage path is not accessible: ${trimmedPath}` },
          { status: 400 }
        )
      }
      updates.backupStoragePath = trimmedPath
    } else {
      return NextResponse.json({ error: "Invalid backup storage path" }, { status: 400 })
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  await db.update(appSettings).set(updates).where(eq(appSettings.id, settings.id))
  log.info({ route: "PATCH /api/settings", fields: Object.keys(updates) }, "settings updated")

  // Re-fetch to return current state
  const [updated] = await fetchSettings()
  if (!updated) {
    log.error({ route: "PATCH /api/settings" }, "settings re-fetch returned empty after update")
    return NextResponse.json({ error: "Settings update failed" }, { status: 500 })
  }

  // Restart backup scheduler if schedule settings changed
  if (
    updates.backupScheduleEnabled !== undefined ||
    updates.backupScheduleFrequency !== undefined
  ) {
    const { stopBackupScheduler, startBackupScheduler } = await import("@/lib/backup-scheduler")
    stopBackupScheduler()
    if (updated.backupScheduleEnabled) {
      const key = decodeKey(auth)
      startBackupScheduler(key)
    }
  }

  return NextResponse.json(serializeSettingsResponse(updated))
}
