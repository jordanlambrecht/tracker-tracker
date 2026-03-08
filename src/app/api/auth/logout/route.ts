// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server"
import { clearSession } from "@/lib/auth"
import { stopScheduler } from "@/lib/scheduler"

export async function POST() {
  stopScheduler()
  await clearSession()
  return NextResponse.json({ success: true })
}
