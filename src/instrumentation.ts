// src/instrumentation.ts
//
// Next.js server boot hook. Names the registry entry of any tracker row that
// predates the registry_slug column, then recovers the scheduler from a
// persisted encryption key so polling survives container restarts without login.

export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { loadSchedulerKey } = await import("@/lib/scheduler-key-store")
  const { startScheduler } = await import("@/lib/scheduler")
  const { log } = await import("@/lib/logger")
  const { backfillRegistrySlugs } = await import("@/lib/db/backfill-registry-slug")

  const { shouldSecureCookies } = await import("@/lib/cookie-security")
  if (!shouldSecureCookies()) {
    log.warn(
      "Session cookies are not marked Secure. If this instance is served over HTTPS, " +
        "set BASE_URL=https://... or SECURE_COOKIES=true in your environment."
    )
  }

  // Before the key check below, which returns early: a row that predates
  // trackers.registry_slug has to be named whether or not polling starts on
  // this boot. The call swallows its own failures and never throws.
  await backfillRegistrySlugs()

  try {
    const key = await loadSchedulerKey()
    if (!key) {
      log.info("No persisted scheduler key, polling will start after first login")
      return
    }
    startScheduler(key)
    log.info("Scheduler restored from persisted key on boot")
  } catch (err) {
    log.warn({ err }, "Boot-time scheduler recovery failed, will start after next login")
  }
}
