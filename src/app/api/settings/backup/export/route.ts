// src/app/api/settings/backup/export/route.ts

import { mkdir, writeFile } from "node:fs/promises"
import nodePath from "node:path"
import { NextResponse } from "next/server"
import { authenticate, decodeKey } from "@/lib/api-helpers"
import { encryptBackupPayload, generateBackupPayload, resolveBackupPassword } from "@/lib/backup"
import { db } from "@/lib/db"
import { appSettings, backupHistory } from "@/lib/db/schema"
import { BACKUP_PASSWORD_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    const formData = await request.formData()
    const formPassword = formData.get("backupPassword")

    const [settings] = await db.select().from(appSettings).limit(1)
    const storagePath = settings?.backupStoragePath ?? "/data/backups"

    const payload = await generateBackupPayload()

    // Resolve backup password: explicit form value > stored encrypted password
    let backupPassword: string | null = null
    if (formPassword && typeof formPassword === "string" && formPassword.length > 0) {
      if (formPassword.length > BACKUP_PASSWORD_MAX) {
        return NextResponse.json(
          { error: "Backup password must be 128 characters or fewer" },
          { status: 400 }
        )
      }
      backupPassword = formPassword
    } else if (settings?.backupEncryptionEnabled && settings.encryptedBackupPassword) {
      try {
        backupPassword = resolveBackupPassword(
          true,
          settings.encryptedBackupPassword,
          decodeKey(auth)
        )
      } catch {
        log.error("Failed to decrypt stored backup password for manual export")
        return NextResponse.json(
          {
            error: "Failed to decrypt backup password. Re-enter your backup password in settings.",
          },
          { status: 500 }
        )
      }
    }

    let serialized: string
    let contentType: string
    let ext: string
    let encrypted = false

    if (backupPassword) {
      const envelope = await encryptBackupPayload(payload, backupPassword)
      serialized = JSON.stringify(envelope)
      contentType = "application/octet-stream"
      ext = "ttbak"
      encrypted = true
    } else {
      serialized = JSON.stringify(payload)
      contentType = "application/json"
      ext = "json"
    }

    const sizeBytes = Buffer.byteLength(serialized, "utf8")
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `tracker-tracker-backup-${timestamp}.${ext}`

    // Save to disk alongside browser download
    let filePath: string | null = null
    try {
      await mkdir(storagePath, { recursive: true })
      filePath = nodePath.join(storagePath, filename)
      await writeFile(filePath, serialized, "utf8")
      log.info(`Manual backup saved: ${filePath} (${sizeBytes} bytes)`)
    } catch (fsErr) {
      log.error(fsErr, "Failed to save manual backup to disk — browser download will still proceed")
      filePath = null
    }

    await db.insert(backupHistory).values({
      sizeBytes,
      encrypted,
      frequency: null,
      status: filePath ? "completed" : "disk_write_failed",
      storagePath: filePath,
    })

    if (filePath) {
      // Saved to disk — return JSON success (no browser download)
      return NextResponse.json({
        success: true,
        filename,
        sizeBytes,
        storagePath: filePath,
      })
    }

    // Disk write failed or no storage path — fall through to browser download
    return new Response(serialized, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    log.error(
      {
        route: "POST /api/settings/backup/export",
        error: String(err),
      },
      "backup export failed"
    )
    return NextResponse.json({ error: "Backup export failed" }, { status: 500 })
  }
}
