// src/app/api/settings/backup/history/route.ts

import { desc } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { backupHistory } from "@/lib/db/schema"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const records = await db.select().from(backupHistory).orderBy(desc(backupHistory.createdAt))

  return NextResponse.json(records)
}
