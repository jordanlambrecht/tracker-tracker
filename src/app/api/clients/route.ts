// src/app/api/clients/route.ts
//
// Functions: GET, POST

import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody, validatePort } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { downloadClients } from "@/lib/db/schema"
import { PROXY_HOST_PATTERN } from "@/lib/proxy"

const VALID_TYPES = ["qbittorrent"]

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clients = await db.select().from(downloadClients).orderBy(downloadClients.createdAt)

  // SECURITY: Never return encryptedUsername or encryptedPassword
  const safe = clients.map((client) => ({
    id: client.id,
    name: client.name,
    type: client.type,
    enabled: client.enabled,
    host: client.host,
    port: client.port,
    useSsl: client.useSsl,
    hasCredentials: !!(client.encryptedUsername && client.encryptedPassword),
    pollIntervalSeconds: client.pollIntervalSeconds,
    isDefault: client.isDefault,
    crossSeedTags: (() => {
      try {
        return JSON.parse(client.crossSeedTags)
      } catch {
        return []
      }
    })(),
    lastPolledAt: client.lastPolledAt,
    lastError: client.lastError,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  }))

  return NextResponse.json(safe)
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { name, host, username, password, type, port, useSsl, pollIntervalSeconds, isDefault, crossSeedTags } =
    body as {
      name?: string
      host?: string
      username?: string
      password?: string
      type?: string
      port?: number
      useSsl?: boolean
      pollIntervalSeconds?: number
      isDefault?: boolean
      crossSeedTags?: string[]
    }

  if (!name || !host || !username || !password) {
    return NextResponse.json(
      { error: "name, host, username, and password are required" },
      { status: 400 }
    )
  }

  if (typeof name !== "string" || typeof host !== "string" || typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid field types" }, { status: 400 })
  }

  if (name.length > 255) {
    return NextResponse.json({ error: "Name must be 255 characters or fewer" }, { status: 400 })
  }

  if (host.length > 255) {
    return NextResponse.json({ error: "Host must be 255 characters or fewer" }, { status: 400 })
  }

  if (username.length > 255) {
    return NextResponse.json({ error: "Username must be 255 characters or fewer" }, { status: 400 })
  }

  if (password.length > 255) {
    return NextResponse.json({ error: "Password must be 255 characters or fewer" }, { status: 400 })
  }

  const sanitizedHost = host.trim().replace(/^https?:\/\//, "")
  if (!PROXY_HOST_PATTERN.test(sanitizedHost)) {
    return NextResponse.json({ error: "Invalid host format" }, { status: 400 })
  }

  const resolvedType = typeof type === "string" ? type : "qbittorrent"
  if (!VALID_TYPES.includes(resolvedType)) {
    return NextResponse.json({ error: "Invalid client type" }, { status: 400 })
  }

  const resolvedPort = typeof port === "number" ? port : 8080
  const portErr = validatePort(resolvedPort)
  if (portErr) return portErr

  if (typeof pollIntervalSeconds === "number" && (pollIntervalSeconds < 10 || pollIntervalSeconds > 86400)) {
    return NextResponse.json({ error: "Poll interval must be between 10 and 86400 seconds" }, { status: 400 })
  }

  const key = decodeKey(auth)
  const encryptedUsername = encrypt(username, key)
  const encryptedPassword = encrypt(password, key)

  const resolvedIsDefault = typeof isDefault === "boolean" ? isDefault : false
  const resolvedTags = Array.isArray(crossSeedTags) ? crossSeedTags : []

  if (resolvedTags.length > 50) {
    return NextResponse.json({ error: "Cannot specify more than 50 cross-seed tags" }, { status: 400 })
  }

  if (resolvedTags.length > 0 && !resolvedTags.every((t: unknown) => typeof t === "string" && t.length > 0 && t.length <= 100)) {
    return NextResponse.json({ error: "Each cross-seed tag must be a non-empty string of 100 characters or fewer" }, { status: 400 })
  }

  if (resolvedIsDefault) {
    await db.update(downloadClients).set({ isDefault: false })
  }

  const [client] = await db
    .insert(downloadClients)
    .values({
      name: name.trim(),
      host: sanitizedHost,
      type: resolvedType,
      port: resolvedPort,
      useSsl: typeof useSsl === "boolean" ? useSsl : false,
      encryptedUsername,
      encryptedPassword,
      pollIntervalSeconds: typeof pollIntervalSeconds === "number" ? pollIntervalSeconds : 30,
      isDefault: resolvedIsDefault,
      crossSeedTags: JSON.stringify(resolvedTags),
    })
    .returning()

  // SECURITY: Only return safe fields
  return NextResponse.json({ id: client.id, name: client.name }, { status: 201 })
}
