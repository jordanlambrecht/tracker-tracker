// src/app/api/settings/backup/[id]/route.ts
//
// Functions: GET, DELETE

import { readFile, stat, unlink } from "node:fs/promises"
import path from "node:path"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseRouteId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings, backupHistory } from "@/lib/db/schema"
import { log } from "@/lib/logger"

export async function GET(
  _request: Request,
  props: RouteContext
): Promise<NextResponse | Response> {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const backupId = await parseRouteId(props.params, "backup")
  if (backupId instanceof NextResponse) return backupId

  const [record] = await db
    .select()
    .from(backupHistory)
    .where(eq(backupHistory.id, backupId))
    .limit(1)

  if (!record) {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 })
  }

  if (!record.storagePath) {
    return NextResponse.json(
      { error: "This backup has no stored file (browser-only export)" },
      { status: 404 }
    )
  }

  const [settings] = await db
    .select({ backupStoragePath: appSettings.backupStoragePath })
    .from(appSettings)
    .limit(1)

  const basePath = settings?.backupStoragePath ?? "/data/backups"
  const resolved = path.resolve(/* turbopackIgnore: true */ record.storagePath)
  const base = path.resolve(/* turbopackIgnore: true */ basePath)

  if (!resolved.startsWith(base + path.sep)) {
    log.error(`Backup download rejected: path ${resolved} outside base ${base}`)
    return NextResponse.json({ error: "Invalid backup path" }, { status: 403 })
  }

  try {
    await stat(resolved)
  } catch {
    log.warn(
      { route: "GET /api/settings/backup/[id]", backupId },
      "backup record exists but file not found on disk"
    )
    return NextResponse.json({ error: "Backup file not found on disk" }, { status: 404 })
  }

  const contents = await readFile(resolved)
  const filename = path.basename(resolved)
  const isEncrypted = filename.endsWith(".ttbak")

  log.info({ route: "GET /api/settings/backup/[id]", backupId }, "backup file served for download")
  return new Response(contents, {
    headers: {
      "Content-Type": isEncrypted ? "application/octet-stream" : "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

export async function DELETE(
  _request: Request,
  props: RouteContext
): Promise<NextResponse> {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const backupId = await parseRouteId(props.params, "backup")
  if (backupId instanceof NextResponse) return backupId

  const [record] = await db
    .select()
    .from(backupHistory)
    .where(eq(backupHistory.id, backupId))
    .limit(1)

  if (!record) {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 })
  }

  if (record.storagePath) {
    const [settings] = await db
      .select({ backupStoragePath: appSettings.backupStoragePath })
      .from(appSettings)
      .limit(1)

    const basePath = settings?.backupStoragePath
    if (basePath) {
      const resolved = path.resolve(/* turbopackIgnore: true */ record.storagePath)
      const base = path.resolve(/* turbopackIgnore: true */ basePath)
      if (resolved.startsWith(base + path.sep)) {
        try {
          await unlink(resolved)
        } catch (err) {
          log.error(err, `Failed to delete backup file: ${resolved}`)
          // Continue with DB record deletion even if file deletion fails
        }
      } else {
        log.error(`Backup delete rejected: path ${resolved} outside base ${base}`)
      }
    }
  }

  await db.delete(backupHistory).where(eq(backupHistory.id, backupId))
  log.info({ route: "DELETE /api/settings/backup/[id]", backupId }, "backup record deleted")

  return new NextResponse(null, { status: 204 })
}
