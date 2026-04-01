// src/app/api/clients/route.ts
//
// Functions: GET, POST

import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody, validatePort } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { downloadClients } from "@/lib/db/schema"
import { sanitizeHost } from "@/lib/helpers"
import { log } from "@/lib/logger"
import { PROXY_HOST_PATTERN } from "@/lib/proxy"
import { parseCrossSeedTags } from "@/lib/qbt"
import { VALID_CLIENT_TYPES } from "@/lib/qbt/types"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clients = await db
    .select({
      id: downloadClients.id,
      name: downloadClients.name,
      type: downloadClients.type,
      enabled: downloadClients.enabled,
      host: downloadClients.host,
      port: downloadClients.port,
      useSsl: downloadClients.useSsl,
      encryptedUsername: downloadClients.encryptedUsername,
      encryptedPassword: downloadClients.encryptedPassword,
      pollIntervalSeconds: downloadClients.pollIntervalSeconds,
      isDefault: downloadClients.isDefault,
      crossSeedTags: downloadClients.crossSeedTags,
      lastPolledAt: downloadClients.lastPolledAt,
      lastError: downloadClients.lastError,
      errorSince: downloadClients.errorSince,
      createdAt: downloadClients.createdAt,
      updatedAt: downloadClients.updatedAt,
    })
    .from(downloadClients)
    .orderBy(downloadClients.createdAt)

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
    crossSeedTags: parseCrossSeedTags(client.crossSeedTags),
    lastPolledAt: client.lastPolledAt?.toISOString() ?? null,
    lastError: client.lastError,
    errorSince: client.errorSince?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  }))

  return NextResponse.json(safe)
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const {
    name,
    host,
    username,
    password,
    type,
    port,
    useSsl,
    pollIntervalSeconds,
    isDefault,
    crossSeedTags,
  } = body as {
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

  if (
    typeof name !== "string" ||
    typeof host !== "string" ||
    typeof username !== "string" ||
    typeof password !== "string"
  ) {
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

  const sanitizedHost = sanitizeHost(host)
  if (!PROXY_HOST_PATTERN.test(sanitizedHost)) {
    return NextResponse.json({ error: "Invalid host format" }, { status: 400 })
  }

  const resolvedType = typeof type === "string" ? type : "qbittorrent"
  if (!(VALID_CLIENT_TYPES as readonly string[]).includes(resolvedType)) {
    return NextResponse.json({ error: "Invalid client type" }, { status: 400 })
  }

  const resolvedPort = typeof port === "number" ? port : 8080
  const portErr = validatePort(resolvedPort)
  if (portErr) return portErr

  if (
    typeof pollIntervalSeconds === "number" &&
    (pollIntervalSeconds < 60 || pollIntervalSeconds > 86400)
  ) {
    return NextResponse.json(
      { error: "Poll interval must be between 60 and 86400 seconds" },
      { status: 400 }
    )
  }

  const key = decodeKey(auth)
  const encryptedUsername = encrypt(username, key)
  const encryptedPassword = encrypt(password, key)

  const resolvedIsDefault = typeof isDefault === "boolean" ? isDefault : false
  const resolvedTags = Array.isArray(crossSeedTags) ? crossSeedTags : []

  if (resolvedTags.length > 50) {
    return NextResponse.json(
      { error: "Cannot specify more than 50 cross-seed tags" },
      { status: 400 }
    )
  }

  if (
    resolvedTags.length > 0 &&
    !resolvedTags.every((t: unknown) => typeof t === "string" && t.length > 0 && t.length <= 100)
  ) {
    return NextResponse.json(
      { error: "Each cross-seed tag must be a non-empty string of 100 characters or fewer" },
      { status: 400 }
    )
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
      pollIntervalSeconds: typeof pollIntervalSeconds === "number" ? pollIntervalSeconds : 300,
      isDefault: resolvedIsDefault,
      crossSeedTags: resolvedTags,
    })
    .returning()

  // SECURITY: Only return safe fields
  log.info({ route: "POST /api/clients", clientId: client.id }, "download client created")
  return NextResponse.json({ id: client.id, name: client.name }, { status: 201 })
}
