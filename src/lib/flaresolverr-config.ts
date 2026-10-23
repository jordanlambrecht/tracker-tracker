// src/lib/flaresolverr-config.ts
//
// Functions: loadFlareSolverrConfig, flareSolverrFor

import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { FLARESOLVERR_TIMEOUT_DEFAULT_MS } from "@/lib/limits"
import type { FlareSolverrConfig } from "@/lib/tracker-platforms/contract"

/** The FlareSolverr set up in Settings, or null when there is none. */
export async function loadFlareSolverrConfig(): Promise<FlareSolverrConfig | null> {
  const [row] = await db
    .select({
      url: appSettings.flaresolverrUrl,
      maxTimeout: appSettings.flaresolverrMaxTimeout,
    })
    .from(appSettings)
    .limit(1)
  if (!row?.url) return null
  return { url: row.url, maxTimeout: row.maxTimeout ?? FLARESOLVERR_TIMEOUT_DEFAULT_MS }
}

/**
 * The FlareSolverr a tracker polls through, or undefined when it does not use
 * one. Throws when the tracker has FlareSolverr enabled but no URL is set, so the
 * poll fails instead of running without it.
 */
export async function flareSolverrFor(tracker: {
  useFlaresolverr: boolean
}): Promise<FlareSolverrConfig | undefined> {
  if (!tracker.useFlaresolverr) return undefined
  const config = await loadFlareSolverrConfig()
  if (!config) {
    throw new Error("FlareSolverr is enabled for this tracker but no FlareSolverr URL is set")
  }
  return config
}
