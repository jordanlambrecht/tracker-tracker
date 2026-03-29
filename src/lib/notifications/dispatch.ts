// src/lib/notifications/dispatch.ts
//
// Functions: dispatchNotifications, detectEvents, buildEventData

import { eq } from "drizzle-orm"
import { MAM_BONUS_CAP } from "@/lib/adapters/constants"
import { db } from "@/lib/db"
import type { NotificationTargetRow } from "@/lib/db/schema"
import { notificationDeliveryState, notificationTargets } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { decryptNotificationConfig } from "@/lib/notifications/decrypt"
import { deliverDiscordWebhook } from "@/lib/notifications/deliver"
import { buildDiscordEmbed } from "@/lib/notifications/payload"
import {
  type DiscordConfig,
  type NotificationEventType,
  type NotificationThresholds,
  parseThresholds,
  type SnapshotContext,
} from "@/lib/notifications/types"
import {
  checkActiveHnrs,
  checkAnniversaryMilestone,
  checkBonusCapReached,
  checkBufferMilestoneCrossed,
  checkHnrIncrease,
  checkRankChange,
  checkRatioBelowMinimumTransition,
  checkRatioDelta,
  checkUnsatisfiedLimitApproaching,
  checkVipExpiringSoon,
  checkWarnedTransition,
  checkZeroSeeding,
  EVENT_SNOOZE_MS,
} from "@/lib/tracker-events"

export async function dispatchNotifications(
  ctx: SnapshotContext,
  encryptionKey: Buffer,
  enabledTargets?: NotificationTargetRow[]
): Promise<void> {
  // Use pre-fetched targets if provided, otherwise query (backward-compat)
  let targets: NotificationTargetRow[]
  if (enabledTargets) {
    targets = enabledTargets
  } else {
    try {
      targets = await db
        .select()
        .from(notificationTargets)
        .where(eq(notificationTargets.enabled, true))
    } catch (err) {
      log.error(
        `dispatchNotifications: failed to query targets: ${err instanceof Error ? err.message : "Unknown"}`
      )
      return
    }
  }

  if (targets.length === 0) return

  // Batch-fetch all cooldown state for this tracker in one query
  const cooldownRows = await db
    .select({
      targetId: notificationDeliveryState.targetId,
      eventType: notificationDeliveryState.eventType,
      snoozedUntil: notificationDeliveryState.snoozedUntil,
    })
    .from(notificationDeliveryState)
    .where(eq(notificationDeliveryState.trackerId, ctx.trackerId))

  const cooldownMap = new Map(
    cooldownRows.map((r) => [`${r.targetId}:${r.eventType}`, r.snoozedUntil])
  )

  const now = new Date()

  for (const target of targets) {
    try {
      // Scope filter — null means all trackers, array means specific tracker IDs
      if (target.scope !== null && !target.scope.includes(ctx.trackerId)) continue

      const events = detectEvents(ctx, target)
      if (events.length === 0) continue

      // Pre-compute anniversary label once per target (avoid double-calling checkAnniversaryMilestone)
      const anniversaryLabel = events.includes("anniversary")
        ? checkAnniversaryMilestone(ctx.trackerJoinedAt)?.label
        : undefined
      const targetThresholds = parseThresholds(target.thresholds)

      // Only Discord is currently supported — skip unknown types
      if (target.type !== "discord") {
        log.warn(
          `dispatchNotifications: skipping unsupported target type "${target.type}" for "${target.name}" (id=${target.id})`
        )
        continue
      }

      let config: DiscordConfig
      try {
        config = decryptNotificationConfig(target, encryptionKey) as DiscordConfig
      } catch {
        log.error(
          `dispatchNotifications: cannot decrypt config for notification target "${target.name}" (id=${target.id})`
        )
        continue
      }

      // Collect per-target delivery results — write once after the event loop
      let finalStatus: "delivered" | "failed" | "rate_limited" | null = null
      let finalError: string | null = null

      for (const event of events) {
        try {
          // Cooldown check — in-memory lookup from batched query
          const snoozedUntil = cooldownMap.get(`${target.id}:${event}`)
          if (snoozedUntil && now < snoozedUntil) continue

          const embed = buildDiscordEmbed({
            eventType: event,
            trackerName: ctx.trackerName,
            includeTrackerName: target.includeTrackerName,
            storeUsernames: ctx.storeUsernames,
            data: buildEventData(event, ctx, targetThresholds, anniversaryLabel),
          })

          const result = await deliverDiscordWebhook(target.id, config.webhookUrl, [embed])

          // Track worst-case status for this target: failed > rate_limited > delivered
          if (
            !finalStatus ||
            result.status === "failed" ||
            (result.status === "rate_limited" && finalStatus === "delivered")
          ) {
            finalStatus = result.status
            finalError = result.error ?? null
          }

          // Record cooldown only if delivered successfully
          if (result.success) {
            const snoozedUntilDate = new Date(now.getTime() + EVENT_SNOOZE_MS[event])
            await db
              .insert(notificationDeliveryState)
              .values({
                targetId: target.id,
                trackerId: ctx.trackerId,
                eventType: event,
                lastNotifiedAt: now,
                snoozedUntil: snoozedUntilDate,
              })
              .onConflictDoUpdate({
                target: [
                  notificationDeliveryState.targetId,
                  notificationDeliveryState.trackerId,
                  notificationDeliveryState.eventType,
                ],
                set: { lastNotifiedAt: now, snoozedUntil: snoozedUntilDate },
              })
          }
        } catch (err) {
          log.error(
            `dispatchNotifications: failed to deliver event "${event}" for target "${target.name}" (id=${target.id}): ${err instanceof Error ? err.message : "Unknown"}`
          )
        }
      }

      // Write delivery status once per target, not per event
      if (finalStatus) {
        await db
          .update(notificationTargets)
          .set({
            lastDeliveryStatus: finalStatus,
            lastDeliveryAt: now,
            lastDeliveryError: finalError,
          })
          .where(eq(notificationTargets.id, target.id))
      }
    } catch (err) {
      log.error(
        `dispatchNotifications: failed processing target "${target.name}" (id=${target.id}): ${err instanceof Error ? err.message : "Unknown"}`
      )
    }
  }
}

export function detectEvents(
  ctx: SnapshotContext,
  target: NotificationTargetRow
): NotificationEventType[] {
  const events: NotificationEventType[] = []
  const thresholds = parseThresholds(target.thresholds)

  if (
    target.notifyRatioDrop &&
    checkRatioDelta(ctx.previousRatio, ctx.currentRatio, thresholds.ratioDropDelta ?? 0.1)
  ) {
    events.push("ratio_drop")
  }

  if (target.notifyHitAndRun && checkHnrIncrease(ctx.previousHnrs, ctx.currentHnrs)) {
    events.push("hit_and_run")
  }

  if (target.notifyTrackerDown && ctx.trackerDown) {
    events.push("tracker_down")
  }

  if (
    target.notifyBufferMilestone &&
    checkBufferMilestoneCrossed(
      ctx.currentBufferBytes,
      ctx.previousBufferBytes,
      BigInt(thresholds.bufferMilestoneBytes ?? 10737418240)
    )
  ) {
    events.push("buffer_milestone")
  }

  if (target.notifyWarned && checkWarnedTransition(ctx.previousWarned, ctx.currentWarned)) {
    events.push("warned")
  }

  if (
    target.notifyRatioDanger &&
    checkRatioBelowMinimumTransition(ctx.previousRatio, ctx.currentRatio, ctx.minimumRatio)
  ) {
    events.push("ratio_danger")
  }

  if (target.notifyZeroSeeding && checkZeroSeeding(ctx.currentSeedingCount, ctx.trackerIsActive)) {
    events.push("zero_seeding")
  }

  if (target.notifyRankChange) {
    const newGroup = checkRankChange(ctx.currentGroup, ctx.previousGroup)
    if (newGroup) events.push("rank_change")
  }

  if (target.notifyAnniversary && checkAnniversaryMilestone(ctx.trackerJoinedAt)) {
    events.push("anniversary")
  }

  if (target.notifyBonusCap) {
    const capLimit = (thresholds?.bonusCapLimit as number | undefined) ?? MAM_BONUS_CAP
    if (
      checkBonusCapReached(
        ctx.mamContext?.currentSeedbonus ?? null,
        ctx.mamContext?.previousSeedbonus ?? null,
        capLimit
      )
    ) {
      events.push("bonus_cap")
    }
  }

  if (target.notifyVipExpiring) {
    const days = (thresholds?.vipExpiringDays as number | undefined) ?? 7
    if (checkVipExpiringSoon(ctx.mamContext?.vipUntil ?? null, days)) {
      events.push("vip_expiring")
    }
  }

  if (target.notifyUnsatisfiedLimit) {
    const pct = (thresholds?.unsatisfiedLimitPercent as number | undefined) ?? 80
    if (
      checkUnsatisfiedLimitApproaching(
        ctx.mamContext?.unsatisfiedCount ?? null,
        ctx.mamContext?.unsatisfiedLimit ?? null,
        pct
      )
    ) {
      events.push("unsatisfied_limit")
    }
  }

  if (target.notifyActiveHnrs) {
    if (
      checkActiveHnrs(
        ctx.mamContext?.inactiveHnrCount ?? null,
        ctx.mamContext?.previousInactiveHnrCount ?? null
      )
    ) {
      events.push("active_hnrs")
    }
  }

  return events
}

export function buildEventData(
  event: NotificationEventType,
  ctx: SnapshotContext,
  thresholds?: NotificationThresholds | null,
  anniversaryLabel?: string
): Record<string, unknown> {
  switch (event) {
    case "ratio_drop":
      return { previousRatio: ctx.previousRatio, currentRatio: ctx.currentRatio }
    case "hit_and_run":
      return { previousHnrs: ctx.previousHnrs, currentHnrs: ctx.currentHnrs }
    case "tracker_down":
      return { error: ctx.trackerError ?? "Unknown error" }
    case "buffer_milestone":
      return { bufferBytes: Number(ctx.currentBufferBytes ?? 0n) }
    case "warned":
      return {}
    case "ratio_danger":
      return { currentRatio: ctx.currentRatio, minimumRatio: ctx.minimumRatio }
    case "zero_seeding":
      return {}
    case "rank_change":
      return { newGroup: ctx.currentGroup, previousGroup: ctx.previousGroup }
    case "anniversary":
      return { label: anniversaryLabel ?? "Anniversary" }
    case "bonus_cap": {
      const effectiveCap = (thresholds?.bonusCapLimit as number | undefined) ?? MAM_BONUS_CAP
      return { currentBonus: ctx.mamContext?.currentSeedbonus ?? null, capLimit: effectiveCap }
    }
    case "vip_expiring":
      return { vipUntil: ctx.mamContext?.vipUntil ?? null }
    case "unsatisfied_limit":
      return {
        count: ctx.mamContext?.unsatisfiedCount ?? null,
        limit: ctx.mamContext?.unsatisfiedLimit ?? null,
      }
    case "active_hnrs":
      return { count: ctx.mamContext?.inactiveHnrCount ?? null }
    default:
      return {}
  }
}
