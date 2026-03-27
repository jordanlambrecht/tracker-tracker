// src/app/api/notifications/route.ts
//
// Functions: GET, POST

import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { notificationTargets } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { VALID_NOTIFICATION_TYPES } from "@/lib/notifications/types"
import { validateNotificationConfig } from "@/lib/notifications/validate"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const targets = await db.select().from(notificationTargets)

  const safe = targets.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    enabled: t.enabled,
    hasConfig: !!t.encryptedConfig,
    notifyRatioDrop: t.notifyRatioDrop,
    notifyHitAndRun: t.notifyHitAndRun,
    notifyTrackerDown: t.notifyTrackerDown,
    notifyBufferMilestone: t.notifyBufferMilestone,
    notifyWarned: t.notifyWarned,
    notifyRatioDanger: t.notifyRatioDanger,
    notifyZeroSeeding: t.notifyZeroSeeding,
    notifyRankChange: t.notifyRankChange,
    notifyAnniversary: t.notifyAnniversary,
    notifyBonusCap: t.notifyBonusCap,
    notifyVipExpiring: t.notifyVipExpiring,
    notifyUnsatisfiedLimit: t.notifyUnsatisfiedLimit,
    notifyActiveHnrs: t.notifyActiveHnrs,
    thresholds: t.thresholds,
    includeTrackerName: t.includeTrackerName,
    scope: t.scope,
    lastDeliveryStatus: t.lastDeliveryStatus,
    lastDeliveryAt: t.lastDeliveryAt?.toISOString() ?? null,
    lastDeliveryError: t.lastDeliveryError,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    // SECURITY: encryptedConfig is NEVER included
  }))

  return NextResponse.json(safe)
}

export async function POST(req: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(req)
  if (body instanceof NextResponse) return body

  const { name, type, config } = body as { name?: unknown; type?: unknown; config?: unknown }

  if (typeof name !== "string" || !name.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  if (name.length > 100)
    return NextResponse.json({ error: "name must be ≤100 characters" }, { status: 400 })

  if (
    typeof type !== "string" ||
    !VALID_NOTIFICATION_TYPES.includes(type as (typeof VALID_NOTIFICATION_TYPES)[number])
  )
    return NextResponse.json(
      { error: `type must be one of: ${VALID_NOTIFICATION_TYPES.join(", ")}` },
      { status: 400 }
    )

  if (!config || typeof config !== "object")
    return NextResponse.json({ error: "config object is required" }, { status: 400 })

  const validationError = validateNotificationConfig(
    type as (typeof VALID_NOTIFICATION_TYPES)[number],
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
