// src/app/api/prowlarr/[id]/route.ts
//
// Functions: PATCH, DELETE

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  parseRouteId,
  type RouteContext,
} from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { prowlarrInstances } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { normalizeProwlarrUrl } from "@/lib/prowlarr/client"
import {
  validateProwlarrApiKey,
  validateProwlarrName,
  validateProwlarrUrl,
} from "@/lib/prowlarr/validate"
import { requestProwlarrPoll } from "@/lib/prowlarr-scheduler"

export async function PATCH(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const instanceId = await parseRouteId(props.params, "Prowlarr instance ID")
  if (instanceId instanceof NextResponse) return instanceId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const [existing] = await db
    .select({ id: prowlarrInstances.id })
    .from(prowlarrInstances)
    .where(eq(prowlarrInstances.id, instanceId))
    .limit(1)
  if (!existing) {
    return NextResponse.json({ error: "Prowlarr instance not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof body.name === "string") {
    const nameErr = validateProwlarrName(body.name)
    if (nameErr) return nameErr
    updates.name = body.name.trim()
  }
  if (typeof body.url === "string") {
    const urlErr = validateProwlarrUrl(body.url)
    if (urlErr) return urlErr
    updates.url = normalizeProwlarrUrl(body.url)
  }
  // Without a key in the body the stored key is unchanged; there is no way to clear it.
  if (typeof body.apiKey === "string") {
    const apiKeyErr = validateProwlarrApiKey(body.apiKey)
    if (apiKeyErr) return apiKeyErr
    updates.encryptedApiKey = encrypt(body.apiKey.trim(), decodeKey(auth))
  }
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled
  if (typeof body.affectsHealth === "boolean") updates.affectsHealth = body.affectsHealth

  // The last error applies to the old address or key, so changing either clears
  // it and the next poll records a new one.
  const connectionChanged = "url" in updates || "encryptedApiKey" in updates
  if (connectionChanged) {
    updates.lastError = null
    updates.errorSince = null
  }

  try {
    await db.update(prowlarrInstances).set(updates).where(eq(prowlarrInstances.id, instanceId))
  } catch (err) {
    log.error(
      { route: "PATCH /api/prowlarr/[id]", prowlarrInstanceId: instanceId, error: errMsg(err) },
      "Failed to update Prowlarr instance"
    )
    return NextResponse.json({ error: "Failed to update Prowlarr instance" }, { status: 500 })
  }

  if (connectionChanged || body.enabled === true) {
    requestProwlarrPoll(instanceId, decodeKey(auth), { readIndexers: true }).catch((err) => {
      log.warn({ prowlarrInstanceId: instanceId, error: errMsg(err) }, "Prowlarr refresh failed")
    })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const instanceId = await parseRouteId(props.params, "Prowlarr instance ID")
  if (instanceId instanceof NextResponse) return instanceId

  try {
    // The foreign key clears trackers' pins to this instance.
    const deleted = await db
      .delete(prowlarrInstances)
      .where(eq(prowlarrInstances.id, instanceId))
      .returning({ id: prowlarrInstances.id })
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Prowlarr instance not found" }, { status: 404 })
    }
  } catch (err) {
    log.error(
      { route: "DELETE /api/prowlarr/[id]", prowlarrInstanceId: instanceId, error: errMsg(err) },
      "Failed to delete Prowlarr instance"
    )
    return NextResponse.json({ error: "Failed to delete Prowlarr instance" }, { status: 500 })
  }

  log.info(
    { route: "DELETE /api/prowlarr/[id]", prowlarrInstanceId: instanceId },
    "Prowlarr removed"
  )
  return NextResponse.json({ success: true })
}
