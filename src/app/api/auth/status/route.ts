// src/app/api/auth/status/route.ts
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"

export async function GET() {
  const [[settings], session] = await Promise.all([
    db
      .select({ totpSecret: appSettings.totpSecret, username: appSettings.username })
      .from(appSettings)
      .limit(1),
    getSession(),
  ])

  return NextResponse.json({
    configured: !!settings,
    authenticated: !!session,
    totpEnabled: !!settings?.totpSecret,
    hasUsername: !!settings?.username,
  })
}
