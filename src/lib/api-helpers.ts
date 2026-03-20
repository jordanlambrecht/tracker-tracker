// src/lib/api-helpers.ts
//
// Functions: authenticate, parseRouteId, parseTrackerId, parseJsonBody,
//            validateHttpUrl, validateHexColor, validatePort, validateJoinedAt, decodeKey

import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isUnsafeNetworkHost } from "@/lib/network"

export async function authenticate(): Promise<NextResponse | { encryptionKey: string }> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return session
}

export async function parseRouteId(
  params: Promise<{ id: string }>,
  label: string
): Promise<NextResponse | number> {
  const { id } = await params
  const parsed = parseInt(id, 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    return NextResponse.json({ error: `Invalid ${label}` }, { status: 400 })
  }
  return parsed
}

export async function parseTrackerId(
  params: Promise<{ id: string }>
): Promise<NextResponse | number> {
  return parseRouteId(params, "tracker ID")
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

export function validateHttpUrl(url: string): NextResponse | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "baseUrl must use https:// or http://" }, { status: 400 })
    }
    if (isUnsafeNetworkHost(parsed.hostname)) {
      return NextResponse.json(
        { error: "baseUrl must not target localhost or a private network address" },
        { status: 400 }
      )
    }
    return null
  } catch {
    return NextResponse.json({ error: "Invalid baseUrl format" }, { status: 400 })
  }
}

export function validateHexColor(color: string): NextResponse | null {
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) {
    return NextResponse.json(
      { error: "Color must be a valid hex color (i.e #00d4ff)" },
      { status: 400 }
    )
  }
  return null
}

export function validatePort(port: number): NextResponse | null {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return NextResponse.json(
      { error: "Port must be an integer between 1 and 65535" },
      { status: 400 }
    )
  }
  return null
}

export function validateJoinedAt(value: string): NextResponse | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return NextResponse.json({ error: "joinedAt must be YYYY-MM-DD" }, { status: 400 })
  }
  if (value > new Date().toISOString().split("T")[0]) {
    return NextResponse.json({ error: "Join date cannot be in the future" }, { status: 400 })
  }
  return null
}

export function decodeKey(auth: { encryptionKey: string }): Buffer {
  return Buffer.from(auth.encryptionKey, "hex")
}
