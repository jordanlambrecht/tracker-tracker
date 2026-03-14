// src/app/api/settings/dashboard/route.ts
//
// Functions: GET, PUT

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { DASHBOARD_SETTINGS_DEFAULTS, type DashboardSettings } from "@/types/api"

const DEFAULTS = DASHBOARD_SETTINGS_DEFAULTS

function parseSettings(raw: string | null): DashboardSettings {
  if (!raw) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DashboardSettings>) }
  } catch {
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

  const merged: DashboardSettings = { ...DEFAULTS }
  if (typeof body.showHealthIndicators === "boolean") {
    merged.showHealthIndicators = body.showHealthIndicators
  }
  if (typeof body.showLoginTimers === "boolean") {
    merged.showLoginTimers = body.showLoginTimers
  }

  const [row] = await db.select({ id: appSettings.id }).from(appSettings).limit(1)
  if (!row) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  await db
    .update(appSettings)
    .set({ dashboardSettings: JSON.stringify(merged) })
    .where(eq(appSettings.id, row.id))

  return NextResponse.json(merged)
}
