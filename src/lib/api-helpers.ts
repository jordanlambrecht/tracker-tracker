// src/lib/api-helpers.ts
//
// Functions: authenticate, parseRouteId, parseTrackerId, parseJsonBody,
//            validateHttpUrl, validateHexColor, validatePort, validateJoinedAt,
//            validateIntRange, validateMaxLength, decodeKey

import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { localDateStr } from "@/lib/formatters"
import { isUnsafeNetworkHost } from "@/lib/network"
import { DATE_RE, isValidHex, isValidPort } from "@/lib/validators"

/** Shared route handler context for dynamic [id] segments */
export type RouteContext<P = { id: string }> = {
  params: Promise<P>
}

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

export function validateHttpUrl(url: string, label = "baseUrl"): NextResponse | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: `${label} must use https:// or http://` }, { status: 400 })
    }
    if (isUnsafeNetworkHost(parsed.hostname)) {
      return NextResponse.json(
        { error: `${label} must not target localhost or a private network address` },
        { status: 400 }
      )
    }
    return null
  } catch {
    return NextResponse.json({ error: `Invalid ${label} format` }, { status: 400 })
  }
}

export function validateHexColor(color: string): NextResponse | null {
  if (!isValidHex(color, true)) {
    return NextResponse.json(
      { error: "Color must be a valid hex color (i.e #00d4ff)" },
      { status: 400 }
    )
  }
  return null
}

export function validatePort(port: number): NextResponse | null {
  if (!isValidPort(port)) {
    return NextResponse.json(
      { error: "Port must be an integer between 1 and 65535" },
      { status: 400 }
    )
  }
  return null
}

export function validateJoinedAt(value: string): NextResponse | null {
  if (!DATE_RE.test(value)) {
    return NextResponse.json({ error: "joinedAt must be YYYY-MM-DD" }, { status: 400 })
  }
  if (value > localDateStr()) {
    return NextResponse.json({ error: "Join date cannot be in the future" }, { status: 400 })
  }
  return null
}

export function validateIntRange(
  value: number,
  min: number,
  max: number,
  label: string
): NextResponse | null {
  if (!Number.isInteger(value) || value < min || value > max) {
    return NextResponse.json(
      { error: `${label} must be between ${min} and ${max}` },
      { status: 400 }
    )
  }
  return null
}

export function validateMaxLength(value: string, max: number, label: string): NextResponse | null {
  if (value.length > max) {
    return NextResponse.json(
      { error: `${label} must be ${max} characters or fewer` },
      { status: 400 }
    )
  }
  return null
}

export function decodeKey(auth: { encryptionKey: string }): Buffer {
  return Buffer.from(auth.encryptionKey, "hex")
}
