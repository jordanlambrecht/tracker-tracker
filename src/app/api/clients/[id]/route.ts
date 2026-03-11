// src/app/api/clients/[id]/route.ts
//
// Functions: PATCH, DELETE

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody, parseRouteId, validatePort } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { downloadClients } from "@/lib/db/schema"
import { PROXY_HOST_PATTERN } from "@/lib/proxy"

const VALID_TYPES = ["qbittorrent"]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(params, "client ID")
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
  // Decoded lazily — only computed when username or password update is present
  let cachedKey: Buffer | null = null
  const getKey = () => {
    if (!cachedKey) cachedKey = decodeKey(auth)
    return cachedKey
  }

  if (typeof body.name === "string") {
    if (body.name.length > 255) {
      return NextResponse.json({ error: "Name must be 255 characters or fewer" }, { status: 400 })
    }
    updates.name = body.name.trim()
  }

  if (typeof body.host === "string") {
    if (body.host.length > 255) {
      return NextResponse.json({ error: "Host must be 255 characters or fewer" }, { status: 400 })
    }
    const sanitizedHost = body.host.trim().replace(/^https?:\/\//, "")
    if (!PROXY_HOST_PATTERN.test(sanitizedHost)) {
      return NextResponse.json({ error: "Invalid host format" }, { status: 400 })
    }
    updates.host = sanitizedHost
  }

  if (typeof body.type === "string") {
    if (!VALID_TYPES.includes(body.type)) {
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
    if (body.pollIntervalSeconds < 10 || body.pollIntervalSeconds > 86400) {
      return NextResponse.json({ error: "Poll interval must be between 10 and 86400 seconds" }, { status: 400 })
    }
    updates.pollIntervalSeconds = body.pollIntervalSeconds
  }

  if (typeof body.crossSeedTags !== "undefined") {
    if (!Array.isArray(body.crossSeedTags)) {
      return NextResponse.json({ error: "crossSeedTags must be an array" }, { status: 400 })
    }
    if (body.crossSeedTags.length > 50) {
      return NextResponse.json({ error: "Cannot specify more than 50 cross-seed tags" }, { status: 400 })
    }
    if (!body.crossSeedTags.every((t: unknown) => typeof t === "string" && t.length > 0 && t.length <= 100)) {
      return NextResponse.json({ error: "Each cross-seed tag must be a non-empty string of 100 characters or fewer" }, { status: 400 })
    }
    updates.crossSeedTags = JSON.stringify(body.crossSeedTags)
  }

  if (typeof body.username === "string") {
    if (body.username.length > 255) {
      return NextResponse.json({ error: "Username must be 255 characters or fewer" }, { status: 400 })
    }
    updates.encryptedUsername = encrypt(body.username, getKey())
  }

  if (typeof body.password === "string") {
    if (body.password.length > 255) {
      return NextResponse.json({ error: "Password must be 255 characters or fewer" }, { status: 400 })
    }
    updates.encryptedPassword = encrypt(body.password, getKey())
  }

  if (body.isDefault === true) {
    await db.update(downloadClients).set({ isDefault: false })
    updates.isDefault = true
  } else if (body.isDefault === false) {
    updates.isDefault = false
  }

  await db.update(downloadClients).set(updates).where(eq(downloadClients.id, clientId))

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(params, "client ID")
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

  return NextResponse.json({ success: true })
}
