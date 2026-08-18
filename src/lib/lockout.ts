// src/lib/lockout.ts

import { eq, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { log } from "@/lib/logger"

export interface LockoutSettings {
  lockoutEnabled: boolean
  lockoutThreshold: number
  lockoutDurationMinutes: number
  lockedUntil: Date | null
}

/**
 * Escape hatch for the one person the lockout can strand.
 *
 * The in-app lockout toggle lives behind authenticate(), so it is unreachable by
 * exactly the user it has locked out. The only ways back in are waiting, or
 * hand-editing the database. Setting DISABLE_LOGIN_LOCKOUT=true in the container
 * environment and restarting stops the 429 from being served, which is something
 * the operator of a self-hosted box can always do.
 *
 * It suppresses ENFORCEMENT only. recordFailedAttempt() keeps counting and still
 * stamps locked_until, so removing the variable restores the real state rather
 * than a blank one. A successful sign-in calls resetFailedAttempts(), which
 * clears both, so getting back in cleans up after itself.
 */
const DISABLE_LOCKOUT_ENV = "DISABLE_LOGIN_LOCKOUT"

/** Warn once per process, not once per request. This must be noisy, not spam. */
let disabledWarningLogged = false

function lockoutDisabledByEnv(): boolean {
  // Read per call rather than at module load: the value is captured in the
  // process environment, and reading it here keeps the flag observable to tests
  // without a module-cache dance.
  if (process.env[DISABLE_LOCKOUT_ENV] !== "true") return false

  // Warned whenever the variable is armed, not only when it actually swallows a
  // lockout. A temporary rescue switch left set forever would otherwise be
  // completely silent on a healthy instance, which is the failure this guards.
  if (!disabledWarningLogged) {
    disabledWarningLogged = true
    log.warn(
      { event: "login_lockout_disabled", envVar: DISABLE_LOCKOUT_ENV },
      `${DISABLE_LOCKOUT_ENV}=true — failed-login lockout is NOT being enforced. This is a recovery switch: unset it and restart once you are back in.`
    )
  }
  return true
}

export function checkLockout(settings: LockoutSettings): NextResponse | null {
  if (lockoutDisabledByEnv()) return null
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
