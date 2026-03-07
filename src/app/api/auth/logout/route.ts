// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server"
import { clearSession } from "@/lib/auth"

export async function POST() {
  await clearSession()
  return NextResponse.json({ success: true })
}
