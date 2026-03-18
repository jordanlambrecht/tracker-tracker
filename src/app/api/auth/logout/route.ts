// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server"
import { clearSession, getSession } from "@/lib/auth"
import { log } from "@/lib/logger"
import { stopScheduler } from "@/lib/scheduler"

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  stopScheduler()
  await clearSession()
  log.info({ event: "logout" }, "User logged out")
  return NextResponse.json({ success: true })
}
