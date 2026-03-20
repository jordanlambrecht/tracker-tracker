// src/app/api/notifications/[id]/test/route.ts
//
// Functions: POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseRouteId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { notificationTargets } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { decryptNotificationConfig } from "@/lib/notifications/decrypt"
import { deliverDiscordWebhook } from "@/lib/notifications/deliver"
import type { DiscordConfig } from "@/lib/notifications/types"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const id = await parseRouteId(params, "notification target ID")
  if (id instanceof NextResponse) return id

  const rows = await db
    .select()
    .from(notificationTargets)
    .where(eq(notificationTargets.id, id))
    .limit(1)

  if (rows.length === 0)
    return NextResponse.json({ error: "Notification target not found" }, { status: 404 })

  const target = rows[0]
  const key = decodeKey(auth)

  let config: DiscordConfig
  try {
    config = decryptNotificationConfig(target, key) as DiscordConfig
  } catch {
    log.error({ route: "POST /api/notifications/[id]/test", targetId: id }, "notification test failed — config decrypt error")
    return NextResponse.json({ error: "Failed to decrypt notification config" }, { status: 422 })
  }

  const testEmbed = {
    title: "Test Notification",
    description: "This is a test from Tracker Tracker. If you see this, your webhook is working.",
    color: 0x00d4ff,
    timestamp: new Date().toISOString(),
  }

  const result = await deliverDiscordWebhook(target.id, config.webhookUrl, [testEmbed])

  if (result.success) {
    await db
      .update(notificationTargets)
      .set({
        lastDeliveryStatus: "delivered",
        lastDeliveryAt: new Date(),
        lastDeliveryError: null,
      })
      .where(eq(notificationTargets.id, id))

    return NextResponse.json({ success: true })
  }

  log.warn({ route: "POST /api/notifications/[id]/test", targetId: id, error: result.error ?? "delivery failed" }, "notification test failed")
  return NextResponse.json({ error: result.error ?? "Test delivery failed" }, { status: 422 })
}
