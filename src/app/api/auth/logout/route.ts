// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server"
import { clearSession, readSession, type SessionRead } from "@/lib/auth"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"

export async function POST() {
  // A cross-site request carries no SameSite=strict cookie, so it gets the 401
  // below and cannot sign anyone out. A stale session still signs out here.
  let session: SessionRead
  try {
    session = await readSession()
  } catch (err) {
    // readSession only throws once a cookie was sent. Clear it anyway, or a
    // database outage leaves a working cookie behind the login screen.
    log.error(
      { route: "POST /api/auth/logout", error: errMsg(err) },
      "logout could not check the session, clearing it anyway"
    )
    await clearSession()
    return NextResponse.json({ success: true })
  }
  if (!session) {
    log.warn({ route: "POST /api/auth/logout" }, "logout attempted without valid session")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await clearSession()
  log.info({ event: "logout" }, "User logged out")
  return NextResponse.json({ success: true })
}
