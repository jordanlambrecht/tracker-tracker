// src/app/api/clients/[id]/route.ts

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  parseRouteId,
  type RouteContext,
  validateAuthMethod,
  validateIntRange,
  validateMaxLength,
  validatePort,
} from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { sanitizeHost } from "@/lib/data-transforms"
import { db } from "@/lib/db"
import { downloadClients } from "@/lib/db/schema"
import { type AuthMethod, VALID_CLIENT_TYPES } from "@/lib/download-clients"
import { errMsg } from "@/lib/error-utils"
import { clearFailureLogKeysForClient } from "@/lib/failure-log-gate"
import {
  CLIENT_POLL_INTERVAL_MAX,
  CLIENT_POLL_INTERVAL_MIN,
  CREDENTIAL_MAX,
  CROSS_SEED_TAG_MAX,
  CROSS_SEED_TAGS_MAX,
  HOST_MAX,
} from "@/lib/limits"
import { log } from "@/lib/logger"
import { PROXY_HOST_PATTERN } from "@/lib/tunnel"
import { removeDownloadClientFromAccumulator } from "@/lib/uptime"

export async function PATCH(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(props.params, "client ID")
  if (clientId instanceof NextResponse) return clientId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  // Existence check before applying any updates
  const [existing] = await db
    .select({ id: downloadClients.id })
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  // Decoded lazily, only computed when username or password update is present
  let cachedKey: Buffer | null = null
  const getKey = () => {
    if (!cachedKey) cachedKey = decodeKey(auth)
    return cachedKey
  }

  if (typeof body.name === "string") {
    const nameErr = validateMaxLength(body.name, CREDENTIAL_MAX, "Name")
    if (nameErr) return nameErr
    updates.name = body.name.trim()
  }

  if (typeof body.host === "string") {
    const hostErr = validateMaxLength(body.host, HOST_MAX, "Host")
    if (hostErr) return hostErr
    const sanitizedHost = sanitizeHost(body.host)
    if (!PROXY_HOST_PATTERN.test(sanitizedHost)) {
      return NextResponse.json({ error: "Invalid host format" }, { status: 400 })
    }
    updates.host = sanitizedHost
  }

  if (typeof body.type === "string") {
    if (!(VALID_CLIENT_TYPES as readonly string[]).includes(body.type)) {
      return NextResponse.json({ error: "Invalid client type" }, { status: 400 })
    }
    updates.type = body.type
  }

  if (typeof body.port === "number") {
    const portErr = validatePort(body.port)
    if (portErr) return portErr
    updates.port = body.port
  }

  if (typeof body.useSsl === "boolean") updates.useSsl = body.useSsl
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled

  if (typeof body.pollIntervalSeconds === "number") {
    const pollErr = validateIntRange(
      body.pollIntervalSeconds,
      CLIENT_POLL_INTERVAL_MIN,
      CLIENT_POLL_INTERVAL_MAX,
      "pollIntervalSeconds",
      `Poll interval must be between ${CLIENT_POLL_INTERVAL_MIN} and ${CLIENT_POLL_INTERVAL_MAX} seconds`
    )
    if (pollErr) return pollErr
    updates.pollIntervalSeconds = body.pollIntervalSeconds
  }

  if (typeof body.crossSeedTags !== "undefined") {
    if (!Array.isArray(body.crossSeedTags)) {
      return NextResponse.json({ error: "crossSeedTags must be an array" }, { status: 400 })
    }
    if (body.crossSeedTags.length > CROSS_SEED_TAGS_MAX) {
      return NextResponse.json(
        { error: "Cannot specify more than 50 cross-seed tags" },
        { status: 400 }
      )
    }
    if (
      !body.crossSeedTags.every(
        (t: unknown) => typeof t === "string" && t.length > 0 && t.length <= CROSS_SEED_TAG_MAX
      )
    ) {
      return NextResponse.json(
        { error: "Each cross-seed tag must be a non-empty string of 100 characters or fewer" },
        { status: 400 }
      )
    }
    updates.crossSeedTags = body.crossSeedTags
  }

  // ── Credentials ────────────────────────────────────────────────────────
  //
  // The auth mode and the secret it describes are always written together.
  // Allowing them to move independently would let `{"authMethod":"apikey"}`
  // alone re-label an existing password as an API key, and the next poll would
  // put that password in an Authorization header. So: naming a mode requires
  // supplying that mode's credential in the same request, and switching modes
  // blanks the other mode's columns rather than leaving a secret at rest.
  const hasUsername = typeof body.username === "string"
  const hasPassword = typeof body.password === "string"
  const hasApiKey = typeof body.apiKey === "string"

  // Dispatched with a switch rather than an if/else chain on `===`: the mode is
  // a discriminant, and the security audit reads `x === "password"` as a secret
  // comparison regardless of what x is.
  let credentialMode: AuthMethod | null = null
  if (typeof body.authMethod === "string") {
    const authMethodErr = validateAuthMethod(body.authMethod)
    if (authMethodErr) return authMethodErr
    credentialMode = body.authMethod as AuthMethod
  } else if (hasApiKey && (hasUsername || hasPassword)) {
    // Both modes' secrets with no mode named. Inferring one would silently
    // discard the other, so make the caller say which they meant.
    return NextResponse.json(
      { error: "authMethod is required when sending both apiKey and username/password" },
      { status: 400 }
    )
  } else if (hasApiKey) {
    credentialMode = "apikey"
  } else if (hasUsername || hasPassword) {
    credentialMode = "password"
  }

  switch (credentialMode) {
    case "apikey": {
      if (!hasApiKey || !body.apiKey) {
        return NextResponse.json(
          { error: "apiKey is required when authMethod is apikey" },
          { status: 400 }
        )
      }
      const apiKeyErr = validateMaxLength(body.apiKey as string, CREDENTIAL_MAX, "API key")
      if (apiKeyErr) return apiKeyErr

      updates.authMethod = "apikey"
      updates.encryptedApiKey = encrypt(body.apiKey as string, getKey())
      updates.encryptedUsername = encrypt("", getKey())
      updates.encryptedPassword = encrypt("", getKey())
      break
    }
    case "password": {
      // Blank is allowed (localhost bypass), absent is not, because switching back to
      // password auth without saying what the password is would otherwise leave
      // the client authenticating with whatever happened to be there before.
      if (!hasUsername || !hasPassword) {
        return NextResponse.json(
          { error: "username and password are required when authMethod is password" },
          { status: 400 }
        )
      }
      const usernameErr = validateMaxLength(body.username as string, CREDENTIAL_MAX, "Username")
      if (usernameErr) return usernameErr
      const passwordErr = validateMaxLength(body.password as string, CREDENTIAL_MAX, "Password")
      if (passwordErr) return passwordErr

      updates.authMethod = "password"
      updates.encryptedUsername = encrypt(body.username as string, getKey())
      updates.encryptedPassword = encrypt(body.password as string, getKey())
      updates.encryptedApiKey = ""
      break
    }
    default:
      // No credential field in the body, so leave every credential column alone.
      break
  }

  if (body.isDefault === true) {
    updates.isDefault = true
  } else if (body.isDefault === false) {
    updates.isDefault = false
  }

  try {
    await db.transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx.update(downloadClients).set({ isDefault: false })
      }
      await tx.update(downloadClients).set(updates).where(eq(downloadClients.id, clientId))
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    log.error(
      { route: "PATCH /api/clients/[id]", clientId, error: errMsg(err) },
      "Failed to update download client"
    )
    return NextResponse.json({ error: "Failed to update download client" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(props.params, "client ID")
  if (clientId instanceof NextResponse) return clientId

  // Fetch to check if this client is the default before deleting
  const [target] = await db
    .select()
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!target) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 })
  }

  removeDownloadClientFromAccumulator(clientId)
  // The heartbeat sweep would clear this within 5s, but doing it here closes
  // the id-reuse window where a recreated client inherits the old one's outage
  // state and has its genuine first failure suppressed.
  clearFailureLogKeysForClient(clientId)

  await db.transaction(async (tx) => {
    await tx.delete(downloadClients).where(eq(downloadClients.id, clientId))

    // If the deleted client was the default, promote the first remaining client
    if (target.isDefault) {
      const [next] = await tx
        .select()
        .from(downloadClients)
        .orderBy(downloadClients.createdAt)
        .limit(1)

      if (next) {
        await tx
          .update(downloadClients)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(downloadClients.id, next.id))
      }
    }
  })

  log.info({ route: "DELETE /api/clients/[id]", clientId }, "download client deleted")
  return NextResponse.json({ success: true })
}
