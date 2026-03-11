// src/lib/api-helpers.ts
//
// Functions: authenticate, parseRouteId, parseTrackerId, parseJsonBody,
//            validateHttpUrl, validateHexColor, validatePort, decodeKey, errorMessage

import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export async function authenticate(): Promise<NextResponse | { encryptionKey: string }> {
  try {
    return await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
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
      return NextResponse.json(
        { error: "baseUrl must use https:// or http://" },
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

export function decodeKey(auth: { encryptionKey: string }): Buffer {
  return Buffer.from(auth.encryptionKey, "hex")
}

export function errorMessage(err: unknown, fallback = "Unknown error"): string {
  return err instanceof Error ? err.message : fallback
}
