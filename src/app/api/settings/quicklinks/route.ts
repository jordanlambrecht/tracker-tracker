// src/app/api/settings/quicklinks/route.ts
//
// Functions: GET, PUT

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody, validateMaxLength } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { QUICKLINK_SLUG_MAX, QUICKLINK_SLUGS_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [settings] = await db
    .select({ draftQuicklinks: appSettings.draftQuicklinks })
    .from(appSettings)
    .limit(1)

  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  let slugs: string[] = []
  if (settings.draftQuicklinks) {
    try {
      const parsed = JSON.parse(settings.draftQuicklinks)
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
        slugs = parsed
      }
    } catch (err) {
      log.warn({ error: String(err) }, "Corrupt draftQuicklinks JSON in DB, returning empty")
      slugs = []
    }
  }

  return NextResponse.json({ slugs })
}

export async function PUT(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { slugs } = body

  if (!Array.isArray(slugs) || !slugs.every((s) => typeof s === "string")) {
    return NextResponse.json({ error: "slugs must be an array of strings" }, { status: 400 })
  }

  if (slugs.length > QUICKLINK_SLUGS_MAX) {
    return NextResponse.json({ error: "Too many quicklinks (max 100)" }, { status: 400 })
  }

  for (const s of slugs) {
    const slugErr = validateMaxLength(s, QUICKLINK_SLUG_MAX, "Slug")
    if (slugErr) return slugErr
  }

  const [settings] = await db.select({ id: appSettings.id }).from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  await db
    .update(appSettings)
    .set({ draftQuicklinks: JSON.stringify(slugs) })
    .where(eq(appSettings.id, settings.id))

  return NextResponse.json({ slugs })
}
