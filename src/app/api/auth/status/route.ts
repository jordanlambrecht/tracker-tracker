// src/app/api/auth/status/route.ts
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"

export async function GET() {
  const [settings] = await db.select().from(appSettings).limit(1)
  const session = await getSession()

  return NextResponse.json({
    configured: !!settings,
    authenticated: !!session,
  })
}
