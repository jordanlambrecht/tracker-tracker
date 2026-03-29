// src/lib/lockout.ts

import { eq, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"

export interface LockoutSettings {
  lockoutEnabled: boolean
  lockoutThreshold: number
  lockoutDurationMinutes: number
  lockedUntil: Date | null
}

export function checkLockout(settings: LockoutSettings): NextResponse | null {
  if (!settings.lockoutEnabled) return null
  if (!settings.lockedUntil || settings.lockedUntil <= new Date()) return null
  const retryAfter = Math.ceil((settings.lockedUntil.getTime() - Date.now()) / 1000)
  return NextResponse.json(
    { error: "Too many failed attempts. Try again later.", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  )
}

export async function recordFailedAttempt(
  settingsId: number,
  lockoutSettings: {
    lockoutEnabled: boolean
    lockoutThreshold: number
    lockoutDurationMinutes: number
  }
): Promise<void> {
  const [updated] = await db
    .update(appSettings)
    .set({ failedLoginAttempts: sql`${appSettings.failedLoginAttempts} + 1` })
    .where(eq(appSettings.id, settingsId))
    .returning({ failedLoginAttempts: appSettings.failedLoginAttempts })

  if (
    lockoutSettings.lockoutEnabled &&
    updated.failedLoginAttempts >= lockoutSettings.lockoutThreshold
  ) {
    await db
      .update(appSettings)
      .set({
        lockedUntil: new Date(Date.now() + lockoutSettings.lockoutDurationMinutes * 60_000),
      })
      .where(eq(appSettings.id, settingsId))
  }
}

export async function resetFailedAttempts(settingsId: number): Promise<void> {
  await db
    .update(appSettings)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(appSettings.id, settingsId))
}
