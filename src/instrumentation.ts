// src/instrumentation.ts
//
// Next.js server boot hook. Recovers the scheduler from a persisted
// encryption key so polling survives container restarts without login.

export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { loadSchedulerKey } = await import("@/lib/scheduler-key-store")
  const { startScheduler } = await import("@/lib/scheduler")
  const { log } = await import("@/lib/logger")

  const { shouldSecureCookies } = await import("@/lib/cookie-security")
  if (!shouldSecureCookies()) {
    log.warn(
      "Session cookies are not marked Secure. If this instance is served over HTTPS, " +
        "set BASE_URL=https://... or SECURE_COOKIES=true in your environment."
    )
  }

  try {
    const key = await loadSchedulerKey()
    if (!key) {
      log.info("No persisted scheduler key — polling will start after first login")
      return
    }
    startScheduler(key)
    log.info("Scheduler restored from persisted key on boot")
  } catch (err) {
    log.warn({ err }, "Boot-time scheduler recovery failed — will start after next login")
  }
}
