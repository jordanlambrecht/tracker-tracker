// src/app/api/settings/route.ts
//
// Functions: fetchSettings, serializeSettingsResponse, GET, PATCH

import { access, mkdir } from "node:fs/promises"
import path from "node:path"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { VALID_BACKUP_FREQUENCIES } from "@/lib/backup"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { scrubSnapshotUsernames } from "@/lib/privacy-db"
import { PROXY_HOST_PATTERN, VALID_PROXY_TYPES } from "@/lib/proxy"
import { parseQbitmanageTags, QBITMANAGE_KEYS } from "@/lib/qbitmanage-defaults"

const settingsColumns = {
  storeUsernames: appSettings.storeUsernames,
  username: appSettings.username,
  sessionTimeoutMinutes: appSettings.sessionTimeoutMinutes,
  autoWipeThreshold: appSettings.autoWipeThreshold,
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
  backupStoragePath: appSettings.backupStoragePath,
}

function fetchSettings() {
  return db.select(settingsColumns).from(appSettings).limit(1)
}

type SettingsRow = Awaited<ReturnType<typeof fetchSettings>>[number]

function serializeSettingsResponse(row: SettingsRow) {
  return {
    storeUsernames: row.storeUsernames,
    username: row.username,
    sessionTimeoutMinutes: row.sessionTimeoutMinutes,
    autoWipeThreshold: row.autoWipeThreshold,
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
    backupStoragePath: row.backupStoragePath,
  }
}

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
      if (body.username.length < 6 || body.username.length > 100) {
        return NextResponse.json(
          { error: "Username must be between 6 and 100 characters" },
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
    } else if (typeof body.sessionTimeoutMinutes === "number" && Number.isInteger(body.sessionTimeoutMinutes)) {
      if (body.sessionTimeoutMinutes < 1 || body.sessionTimeoutMinutes > 525960) {
        return NextResponse.json(
          { error: "Session timeout must be between 1 minute and 1 year" },
          { status: 400 }
        )
      }
      updates.sessionTimeoutMinutes = body.sessionTimeoutMinutes
    } else {
      return NextResponse.json({ error: "Invalid session timeout" }, { status: 400 })
    }
  }

  // --- Auto-wipe threshold ---
  if (body.autoWipeThreshold !== undefined) {
    if (body.autoWipeThreshold === null || body.autoWipeThreshold === 0) {
      updates.autoWipeThreshold = null
      // Also reset the counter when disabling
      updates.failedLoginAttempts = 0
    } else if (typeof body.autoWipeThreshold === "number" && Number.isInteger(body.autoWipeThreshold)) {
      if (body.autoWipeThreshold < 1 || body.autoWipeThreshold > 99) {
        return NextResponse.json(
          { error: "Auto-wipe threshold must be between 1 and 99" },
          { status: 400 }
        )
      }
      updates.autoWipeThreshold = body.autoWipeThreshold
      // Reset counter when changing threshold
      updates.failedLoginAttempts = 0
    } else {
      return NextResponse.json({ error: "Invalid auto-wipe threshold" }, { status: 400 })
    }
  }

  // --- Snapshot retention ---
  if (body.snapshotRetentionDays !== undefined) {
    if (body.snapshotRetentionDays === null || body.snapshotRetentionDays === 0) {
      updates.snapshotRetentionDays = null
    } else if (typeof body.snapshotRetentionDays === "number" && Number.isInteger(body.snapshotRetentionDays)) {
      if (body.snapshotRetentionDays < 7 || body.snapshotRetentionDays > 3650) {
        return NextResponse.json(
          { error: "Snapshot retention must be between 7 days and 10 years" },
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
    if (typeof body.trackerPollIntervalMinutes !== "number" || !Number.isInteger(body.trackerPollIntervalMinutes)) {
      return NextResponse.json({ error: "Invalid poll interval" }, { status: 400 })
    }
    if (body.trackerPollIntervalMinutes < 15 || body.trackerPollIntervalMinutes > 1440) {
      return NextResponse.json(
        { error: "Poll interval must be between 15 minutes and 24 hours" },
        { status: 400 }
      )
    }
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
      if (body.proxyHost.length > 255) {
        return NextResponse.json({ error: "Proxy host must be 255 characters or fewer" }, { status: 400 })
      }
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
      if (body.proxyPort < 1 || body.proxyPort > 65535) {
        return NextResponse.json({ error: "Proxy port must be between 1 and 65535" }, { status: 400 })
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
      if (body.proxyUsername.length > 255) {
        return NextResponse.json({ error: "Proxy username must be 255 characters or fewer" }, { status: 400 })
      }
      updates.proxyUsername = body.proxyUsername
    } else {
      return NextResponse.json({ error: "Invalid proxy username" }, { status: 400 })
    }
  }

  if (body.proxyPassword !== undefined) {
    if (body.proxyPassword === null || body.proxyPassword === "") {
      updates.encryptedProxyPassword = null
    } else if (typeof body.proxyPassword === "string") {
      if (body.proxyPassword.length > 255) {
        return NextResponse.json({ error: "Proxy password must be 255 characters or fewer" }, { status: 400 })
      }
      const key = decodeKey(auth)
      updates.encryptedProxyPassword = encrypt(body.proxyPassword, key)
    } else {
      return NextResponse.json({ error: "Invalid proxy password" }, { status: 400 })
    }
  }

  // --- Store usernames (privacy toggle) ---
  if (body.storeUsernames !== undefined) {
    if (typeof body.storeUsernames !== "boolean") {
      return NextResponse.json(
        { error: "storeUsernames must be a boolean" },
        { status: 400 }
      )
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
    if (typeof body.qbitmanageTags !== "object" || body.qbitmanageTags === null || Array.isArray(body.qbitmanageTags)) {
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
      if (tag.length === 0 || tag.length > 100) {
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
    if (
      typeof body.backupRetentionCount !== "number" ||
      !Number.isInteger(body.backupRetentionCount)
    ) {
      return NextResponse.json(
        { error: "Invalid backup retention count" },
        { status: 400 }
      )
    }
    if (body.backupRetentionCount < 1 || body.backupRetentionCount > 365) {
      return NextResponse.json(
        { error: "Backup retention count must be between 1 and 365" },
        { status: 400 }
      )
    }
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
  }

  if (body.backupStoragePath !== undefined) {
    if (body.backupStoragePath === null || body.backupStoragePath === "") {
      updates.backupStoragePath = null
    } else if (typeof body.backupStoragePath === "string") {
      const trimmedPath = body.backupStoragePath.trim()
      if (trimmedPath.length > 500) {
        return NextResponse.json(
          { error: "Backup storage path must be 500 characters or fewer" },
          { status: 400 }
        )
      }
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
      return NextResponse.json(
        { error: "Invalid backup storage path" },
        { status: 400 }
      )
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  await db.update(appSettings).set(updates).where(eq(appSettings.id, settings.id))

  // Re-fetch to return current state
  const [updated] = await fetchSettings()
  if (!updated) throw new Error("Settings update failed")

  // Restart backup scheduler if schedule settings changed
  if (
    updates.backupScheduleEnabled !== undefined ||
    updates.backupScheduleFrequency !== undefined
  ) {
    const { stopBackupScheduler, startBackupScheduler } = await import(
      "@/lib/backup-scheduler"
    )
    stopBackupScheduler()
    if (updated.backupScheduleEnabled) {
      const key = decodeKey(auth)
      startBackupScheduler(key)
    }
  }

  return NextResponse.json(serializeSettingsResponse(updated))
}
