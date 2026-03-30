// src/app/api/notifications/[id]/route.ts
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
import { notificationTargets } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { validateNotificationConfig } from "@/lib/notifications/validate"

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const id = await parseRouteId(params, "notification target ID")
  if (id instanceof NextResponse) return id

  const [existing] = await db
    .select()
    .from(notificationTargets)
    .where(eq(notificationTargets.id, id))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Notification target not found" }, { status: 404 })
  }

  const body = await parseJsonBody(req)
  if (body instanceof NextResponse) return body
  const fields = body as Record<string, unknown>

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  // Key is decoded lazily and only when config update is present
  let cachedKey: Buffer | null = null
  const getKey = () => {
    if (!cachedKey) cachedKey = decodeKey(auth as Exclude<typeof auth, NextResponse>)
    return cachedKey
  }

  if ("name" in fields) {
    if (typeof fields.name !== "string" || !fields.name.trim()) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 })
    }
    if (fields.name.length > 100) {
      return NextResponse.json({ error: "name must be ≤100 characters" }, { status: 400 })
    }
    updates.name = fields.name.trim()
  }

  if ("enabled" in fields) {
    if (typeof fields.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 })
    }
    updates.enabled = fields.enabled
  }

  if ("config" in fields) {
    if (!fields.config || typeof fields.config !== "object") {
      return NextResponse.json({ error: "config must be an object" }, { status: 400 })
    }
    const type = typeof fields.type === "string" ? fields.type : existing.type
    const err = validateNotificationConfig(
      type as Parameters<typeof validateNotificationConfig>[0],
      fields.config as Record<string, unknown>
    )
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    updates.encryptedConfig = encrypt(JSON.stringify(fields.config), getKey())
  }

  // Boolean event toggles
  for (const key of [
    "notifyRatioDrop",
    "notifyHitAndRun",
    "notifyTrackerDown",
    "notifyBufferMilestone",
    "notifyWarned",
    "notifyRatioDanger",
    "notifyZeroSeeding",
    "notifyRankChange",
    "notifyAnniversary",
    "notifyBonusCap",
    "notifyVipExpiring",
    "notifyUnsatisfiedLimit",
    "notifyActiveHnrs",
    "includeTrackerName",
  ] as const) {
    if (key in fields) {
      if (typeof fields[key] !== "boolean") {
        return NextResponse.json({ error: `${key} must be a boolean` }, { status: 400 })
      }
      updates[key] = fields[key]
    }
  }

  if ("thresholds" in fields) {
    if (fields.thresholds === null) {
      updates.thresholds = null
    } else if (typeof fields.thresholds !== "object" || Array.isArray(fields.thresholds)) {
      return NextResponse.json({ error: "thresholds must be an object or null" }, { status: 400 })
    } else {
      const t = fields.thresholds as Record<string, unknown>
      const allowed = new Set([
        "ratioDropDelta",
        "bufferMilestoneBytes",
        "bonusCapLimit",
        "vipExpiringDays",
        "unsatisfiedLimitPercent",
      ])
      for (const key of Object.keys(t)) {
        if (!allowed.has(key)) {
          return NextResponse.json({ error: `thresholds: unknown key "${key}"` }, { status: 400 })
        }
      }
      if (
        "ratioDropDelta" in t &&
        (typeof t.ratioDropDelta !== "number" ||
          !Number.isFinite(t.ratioDropDelta) ||
          t.ratioDropDelta <= 0)
      ) {
        return NextResponse.json(
          { error: "thresholds.ratioDropDelta must be a positive number" },
          { status: 400 }
        )
      }
      if (
        "bufferMilestoneBytes" in t &&
        (typeof t.bufferMilestoneBytes !== "number" ||
          !Number.isInteger(t.bufferMilestoneBytes) ||
          t.bufferMilestoneBytes <= 0)
      ) {
        return NextResponse.json(
          { error: "thresholds.bufferMilestoneBytes must be a positive integer" },
          { status: 400 }
        )
      }
      if (
        "bonusCapLimit" in t &&
        (typeof t.bonusCapLimit !== "number" ||
          !Number.isInteger(t.bonusCapLimit) ||
          t.bonusCapLimit <= 0)
      ) {
        return NextResponse.json(
          { error: "thresholds.bonusCapLimit must be a positive integer" },
          { status: 400 }
        )
      }
      if (
        "vipExpiringDays" in t &&
        (typeof t.vipExpiringDays !== "number" ||
          !Number.isInteger(t.vipExpiringDays) ||
          t.vipExpiringDays <= 0)
      ) {
        return NextResponse.json(
          { error: "thresholds.vipExpiringDays must be a positive integer" },
          { status: 400 }
        )
      }
      if (
        "unsatisfiedLimitPercent" in t &&
        (typeof t.unsatisfiedLimitPercent !== "number" ||
          !Number.isFinite(t.unsatisfiedLimitPercent) ||
          t.unsatisfiedLimitPercent <= 0 ||
          t.unsatisfiedLimitPercent > 100)
      ) {
        return NextResponse.json(
          { error: "thresholds.unsatisfiedLimitPercent must be a number between 1 and 100" },
          { status: 400 }
        )
      }
      updates.thresholds = fields.thresholds
    }
  }

  if ("scope" in fields) {
    if (fields.scope !== null) {
      if (
        !Array.isArray(fields.scope) ||
        !fields.scope.every((v: unknown) => typeof v === "number" && Number.isInteger(v) && v > 0)
      ) {
        return NextResponse.json(
          { error: "scope must be null or an array of tracker IDs" },
          { status: 400 }
        )
      }
    }
    updates.scope = fields.scope
  }

  await db.update(notificationTargets).set(updates).where(eq(notificationTargets.id, id))

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const id = await parseRouteId(params, "notification target ID")
  if (id instanceof NextResponse) return id

  // notificationDeliveryState rows are cleaned up automatically via FK cascade
  // (onDelete: "cascade" on targetId)
  await db.delete(notificationTargets).where(eq(notificationTargets.id, id))

  log.info({ route: "DELETE /api/notifications/[id]", targetId: id }, "notification target deleted")
  return NextResponse.json({ success: true })
}
