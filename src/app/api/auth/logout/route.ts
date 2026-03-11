// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server"
import { clearSession, getSession } from "@/lib/auth"
import { stopScheduler } from "@/lib/scheduler"

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  stopScheduler()
  await clearSession()
  return NextResponse.json({ success: true })
}
