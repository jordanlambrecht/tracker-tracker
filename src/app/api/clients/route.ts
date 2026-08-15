// src/app/api/clients/route.ts
//
// Functions: GET, POST

import { NextResponse } from "next/server"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  validateIntRange,
  validateMaxLength,
  validatePort,
} from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { sanitizeHost } from "@/lib/data-transforms"
import { db } from "@/lib/db"
import { downloadClients } from "@/lib/db/schema"
import { VALID_AUTH_METHODS, VALID_CLIENT_TYPES } from "@/lib/download-clients"
import { errMsg } from "@/lib/error-utils"
import {
  CLIENT_POLL_INTERVAL_DEFAULT,
  CLIENT_POLL_INTERVAL_MAX,
  CLIENT_POLL_INTERVAL_MIN,
  CREDENTIAL_MAX,
  CROSS_SEED_TAG_MAX,
  CROSS_SEED_TAGS_MAX,
  HOST_MAX,
} from "@/lib/limits"
import { log } from "@/lib/logger"
import { fetchDownloadClients, serializeDownloadClientResponse } from "@/lib/server-data"
import { PROXY_HOST_PATTERN } from "@/lib/tunnel"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clients = await fetchDownloadClients()
  return NextResponse.json(clients.map(serializeDownloadClientResponse))
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
    apiKey,
    authMethod,
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
    apiKey?: string
    authMethod?: string
    type?: string
    port?: number
    useSsl?: boolean
    pollIntervalSeconds?: number
    isDefault?: boolean
    crossSeedTags?: string[]
  }

  if (!name || !host) {
    return NextResponse.json({ error: "name and host are required" }, { status: 400 })
  }

  if (typeof name !== "string" || typeof host !== "string") {
    return NextResponse.json({ error: "Invalid field types" }, { status: 400 })
  }

  const resolvedAuthMethod = typeof authMethod === "string" ? authMethod : "password"
  if (!(VALID_AUTH_METHODS as readonly string[]).includes(resolvedAuthMethod)) {
    return NextResponse.json(
      { error: `authMethod must be one of: ${VALID_AUTH_METHODS.join(", ")}` },
      { status: 400 }
    )
  }

  if (resolvedAuthMethod === "apikey") {
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "apiKey is required for apikey auth" }, { status: 400 })
    }
    const apiKeyErr = validateMaxLength(apiKey, CREDENTIAL_MAX, "API key")
    if (apiKeyErr) return apiKeyErr
  } else {
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "username and password are required for password auth" },
        { status: 400 }
      )
    }
    const usernameErr = validateMaxLength(username, CREDENTIAL_MAX, "Username")
    if (usernameErr) return usernameErr

    const passwordErr = validateMaxLength(password, CREDENTIAL_MAX, "Password")
    if (passwordErr) return passwordErr
  }

  const nameErr = validateMaxLength(name, CREDENTIAL_MAX, "Name")
  if (nameErr) return nameErr

  const hostErr = validateMaxLength(host, HOST_MAX, "Host")
  if (hostErr) return hostErr

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

  if (typeof pollIntervalSeconds === "number") {
    const pollErr = validateIntRange(
      pollIntervalSeconds,
      CLIENT_POLL_INTERVAL_MIN,
      CLIENT_POLL_INTERVAL_MAX,
      "pollIntervalSeconds",
      `Poll interval must be between ${CLIENT_POLL_INTERVAL_MIN} and ${CLIENT_POLL_INTERVAL_MAX} seconds`
    )
    if (pollErr) return pollErr
  }

  // apikey mode reuses encryptedUsername/encryptedPassword: the key goes in
  // encryptedPassword and encryptedUsername holds an encrypted empty string
  // (unused) — see schema.ts and download-clients/credentials.ts.
  const key = decodeKey(auth)
  const encryptedUsername = encrypt(resolvedAuthMethod === "apikey" ? "" : (username as string), key)
  const encryptedPassword = encrypt(
    resolvedAuthMethod === "apikey" ? (apiKey as string) : (password as string),
    key
  )

  const resolvedIsDefault = typeof isDefault === "boolean" ? isDefault : false
  const resolvedTags = Array.isArray(crossSeedTags) ? crossSeedTags : []

  if (resolvedTags.length > CROSS_SEED_TAGS_MAX) {
    return NextResponse.json(
      { error: "Cannot specify more than 50 cross-seed tags" },
      { status: 400 }
    )
  }

  if (
    resolvedTags.length > 0 &&
    !resolvedTags.every(
      (t: unknown) => typeof t === "string" && t.length > 0 && t.length <= CROSS_SEED_TAG_MAX
    )
  ) {
    return NextResponse.json(
      { error: "Each cross-seed tag must be a non-empty string of 100 characters or fewer" },
      { status: 400 }
    )
  }

  try {
    const [client] = await db.transaction(async (tx) => {
      if (resolvedIsDefault) {
        await tx.update(downloadClients).set({ isDefault: false })
      }
      return tx
        .insert(downloadClients)
        .values({
          name: name.trim(),
          host: sanitizedHost,
          type: resolvedType,
          port: resolvedPort,
          useSsl: typeof useSsl === "boolean" ? useSsl : false,
          authMethod: resolvedAuthMethod,
          encryptedUsername,
          encryptedPassword,
          pollIntervalSeconds:
            typeof pollIntervalSeconds === "number"
              ? pollIntervalSeconds
              : CLIENT_POLL_INTERVAL_DEFAULT,
          isDefault: resolvedIsDefault,
          crossSeedTags: resolvedTags,
        })
        .returning()
    })

    log.info({ route: "POST /api/clients", clientId: client.id }, "download client created")
    return NextResponse.json({ id: client.id, name: client.name }, { status: 201 })
  } catch (err) {
    log.error(
      { route: "POST /api/clients", error: errMsg(err) },
      "Failed to create download client"
    )
    return NextResponse.json({ error: "Failed to create download client" }, { status: 500 })
  }
}
