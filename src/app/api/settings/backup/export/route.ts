// src/app/api/settings/backup/export/route.ts

import { mkdir, writeFile } from "node:fs/promises"
import nodePath from "node:path"
import { NextResponse } from "next/server"
import { authenticate, decodeKey } from "@/lib/api-helpers"
import {
  encryptBackupPayload,
  generateBackupPayload,
} from "@/lib/backup"
import { db } from "@/lib/db"
import { appSettings, backupHistory } from "@/lib/db/schema"
import { log } from "@/lib/logger"

export async function POST() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    const [settings] = await db.select().from(appSettings).limit(1)
    const encryptionEnabled = settings?.backupEncryptionEnabled ?? false
    const storagePath = settings?.backupStoragePath ?? "/data/backups"

    const payload = await generateBackupPayload()

    let serialized: string
    let contentType: string
    let ext: string

    if (encryptionEnabled) {
      const key = decodeKey(auth)
      const envelope = encryptBackupPayload(payload, key)
      serialized = JSON.stringify(envelope)
      contentType = "application/octet-stream"
      ext = "ttbak"
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
      encrypted: encryptionEnabled,
      frequency: null,
      status: "completed",
      storagePath: filePath,
    })

    return new Response(serialized, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Backup export failed: ${message}` },
      { status: 500 }
    )
  }
}
