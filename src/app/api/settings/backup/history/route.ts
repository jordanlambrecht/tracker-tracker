// src/app/api/settings/backup/history/route.ts

import { desc } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { backupHistory } from "@/lib/db/schema"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const records = await db
    .select({
      id: backupHistory.id,
      createdAt: backupHistory.createdAt,
      sizeBytes: backupHistory.sizeBytes,
      encrypted: backupHistory.encrypted,
      frequency: backupHistory.frequency,
      status: backupHistory.status,
      notes: backupHistory.notes,
    })
    .from(backupHistory)
    .orderBy(desc(backupHistory.createdAt))
    .limit(200)

  return NextResponse.json(records)
}
