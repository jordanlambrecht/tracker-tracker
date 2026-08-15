// src/app/api/settings/dashboard/route.ts

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { DASHBOARD_SETTINGS_DEFAULTS, type DashboardSettings } from "@/types/api"

const DEFAULTS = DASHBOARD_SETTINGS_DEFAULTS

function parseSettings(raw: string | null): DashboardSettings {
  if (!raw) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DashboardSettings>) }
  } catch (err) {
    log.warn({ error: String(err) }, "Corrupt dashboardSettings JSON in DB, returning defaults")
    return { ...DEFAULTS }
  }
}

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [row] = await db
    .select({ dashboardSettings: appSettings.dashboardSettings })
    .from(appSettings)
    .limit(1)

  return NextResponse.json(parseSettings(row?.dashboardSettings ?? null))
}

export async function PUT(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const [row] = await db
    .select({ id: appSettings.id, dashboardSettings: appSettings.dashboardSettings })
    .from(appSettings)
    .limit(1)
  if (!row) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  // The allowlist is derived from the defaults rather than written out key by key. A
  // hand-maintained list silently drops any field added to DashboardSettings later, which is
  // exactly what happened to enable3DCharts — the PUT looked like it worked because the client
  // updates optimistically, and the value only vanished on reload. Comparing against the
  // default's type keeps the same validation the explicit branches did.
  const merged: DashboardSettings = parseSettings(row.dashboardSettings)
  for (const key of Object.keys(DEFAULTS) as (keyof DashboardSettings)[]) {
    const value = body[key]
    if (typeof value === typeof DEFAULTS[key]) {
      merged[key] = value as DashboardSettings[typeof key]
    }
  }

  await db
    .update(appSettings)
    .set({ dashboardSettings: JSON.stringify(merged) })
    .where(eq(appSettings.id, row.id))

  return NextResponse.json(merged)
}
