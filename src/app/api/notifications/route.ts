// src/app/api/notifications/route.ts
//
// Functions: GET, POST

import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody, validateMaxLength } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { notificationTargets } from "@/lib/db/schema"
import { SHORT_NAME_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"
import { SUPPORTED_NOTIFICATION_TYPES } from "@/lib/notifications/types"
import { validateNotificationConfig } from "@/lib/notifications/validate"
import { fetchNotificationTargets, serializeNotificationTarget } from "@/lib/server-data"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const targets = await fetchNotificationTargets()
  return NextResponse.json(targets.map(serializeNotificationTarget))
}

export async function POST(req: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(req)
  if (body instanceof NextResponse) return body

  const { name, type, config } = body as { name?: unknown; type?: unknown; config?: unknown }

  if (typeof name !== "string" || !name.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  const nameErr = validateMaxLength(name, SHORT_NAME_MAX, "name")
  if (nameErr) return nameErr

  if (
    typeof type !== "string" ||
    !SUPPORTED_NOTIFICATION_TYPES.includes(type as (typeof SUPPORTED_NOTIFICATION_TYPES)[number])
  )
    return NextResponse.json(
      { error: `type must be one of: ${SUPPORTED_NOTIFICATION_TYPES.join(", ")}` },
      { status: 400 }
    )

  if (!config || typeof config !== "object")
    return NextResponse.json({ error: "config object is required" }, { status: 400 })

  const validationError = validateNotificationConfig(
    type as (typeof SUPPORTED_NOTIFICATION_TYPES)[number],
    config as Record<string, unknown>
  )
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const key = decodeKey(auth)
  const encryptedConfig = encrypt(JSON.stringify(config), key)

  const [inserted] = await db
    .insert(notificationTargets)
    .values({
      name: name.trim(),
      type,
      encryptedConfig,
    })
    .returning({ id: notificationTargets.id, name: notificationTargets.name })

  log.info(
    { route: "POST /api/notifications", targetId: inserted.id },
    "notification target created"
  )
  return NextResponse.json(inserted, { status: 201 })
}
