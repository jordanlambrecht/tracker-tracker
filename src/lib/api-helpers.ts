// src/lib/api-helpers.ts
//
// Functions: authenticate, parseTrackerId, parseJsonBody

import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export async function authenticate(): Promise<NextResponse | { encryptionKey: string }> {
  try {
    return await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function parseTrackerId(
  params: Promise<{ id: string }>
): Promise<NextResponse | number> {
  const { id } = await params
  const trackerId = parseInt(id, 10)
  if (Number.isNaN(trackerId)) {
    return NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
  }
  return trackerId
}

export async function parseJsonBody(
  request: Request
): Promise<NextResponse | Record<string, unknown>> {
  try {
    return await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
}
