// src/lib/tracker-events.ts
//
// Functions: checkRatioBelowMinimum, checkRatioDelta, checkRatioBelowMinimumTransition,
//            checkTrackerError, checkWarned, checkWarnedTransition, checkZeroSeeding,
//            checkHnrIncrease, checkBufferMilestoneCrossed, checkRankChange,
//            checkAnniversaryMilestone, checkBonusCapReached, checkVipExpiringSoon,
//            checkUnsatisfiedLimitApproaching, checkActiveHnrs, EVENT_SNOOZE_MS
//
// Shared pure-function event detection checks. No framework imports, no DB imports.
// Importable from both client-side dashboard code and server-side scheduler code.

import type { NotificationEventType } from "@/lib/notifications/types"
import { isRedacted } from "@/lib/privacy"

// ─── Ratio ───────────────────────────────────────────────────────────────────

export function checkRatioBelowMinimum(
  ratio: number | null | undefined,
  minimumRatio: number | undefined
): boolean {
  if (ratio === null || ratio === undefined) return false
  if (minimumRatio === undefined) return false
  return Number.isFinite(minimumRatio) && ratio < minimumRatio
}

export function checkRatioDelta(
  previousRatio: number | null,
  currentRatio: number | null,
  delta: number
): boolean {
  if (previousRatio === null || currentRatio === null) return false
  return previousRatio - currentRatio >= delta
}

export function checkRatioBelowMinimumTransition(
  previousRatio: number | null,
  currentRatio: number | null,
  minimumRatio: number | undefined
): boolean {
  if (currentRatio === null || minimumRatio === undefined) return false
  if (!Number.isFinite(minimumRatio)) return false
  const belowNow = currentRatio < minimumRatio
  const wasAbove = previousRatio === null || previousRatio >= minimumRatio
  return belowNow && wasAbove
}

// ─── Tracker state ───────────────────────────────────────────────────────────

export function checkTrackerError(
  lastError: string | null,
  pausedAt: string | null,
  userPausedAt?: string | null
): { paused: boolean; pausedByUser: boolean; hasError: boolean } {
  if (userPausedAt) return { paused: true, pausedByUser: true, hasError: false }
  if (pausedAt) return { paused: true, pausedByUser: false, hasError: false }
  if (lastError) return { paused: false, pausedByUser: false, hasError: true }
  return { paused: false, pausedByUser: false, hasError: false }
}

export function checkWarned(warned: boolean | null | undefined): boolean {
  return warned === true
}

export function checkWarnedTransition(
  previousWarned: boolean | null | undefined,
  currentWarned: boolean | null | undefined
): boolean {
  if (currentWarned !== true) return false
  return previousWarned !== true // fires on false→true AND null→true (first poll)
}

export function checkZeroSeeding(
  seedingCount: number | null | undefined,
  isActive: boolean
): boolean {
  if (!isActive) return false
  return seedingCount === 0
}

// ─── Comparative (delta-based, server-side only) ─────────────────────────────

export function checkHnrIncrease(previousHnrs: number | null, currentHnrs: number | null): boolean {
  if (previousHnrs === null || currentHnrs === null) return false
  return currentHnrs > previousHnrs
}

export function checkBufferMilestoneCrossed(
  currentBufferBytes: bigint | null,
  previousBufferBytes: bigint | null,
  milestoneBytes: bigint
): boolean {
  if (currentBufferBytes === null) return false
  const previous = previousBufferBytes ?? 0n
  return currentBufferBytes >= milestoneBytes && previous < milestoneBytes
}

export function checkRankChange(
  currentGroup: string | null | undefined,
  previousGroup: string | null | undefined
): string | null {
  if (!currentGroup || !previousGroup) return null
  if (isRedacted(currentGroup) || isRedacted(previousGroup)) return null
  if (currentGroup === previousGroup) return null
  return currentGroup
}

// ─── Time-based ──────────────────────────────────────────────────────────────

const ANNIVERSARY_WINDOW_DAYS = 3

export function checkAnniversaryMilestone(
  joinedAt: string | null | undefined
): { label: string } | null {
  if (!joinedAt) return null
  const joined = new Date(`${joinedAt}T00:00:00`)
  if (Number.isNaN(joined.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const candidates: { date: Date; label: string }[] = []

  // 1 month
  const m1 = new Date(joined)
  m1.setMonth(m1.getMonth() + 1)
  candidates.push({ date: m1, label: "1 month anniversary" })

  // 6 months
  const m6 = new Date(joined)
  m6.setMonth(m6.getMonth() + 6)
  candidates.push({ date: m6, label: "6 month anniversary" })

  // Annual milestones
  const yearsSinceJoin = today.getFullYear() - joined.getFullYear()
  for (let y = 1; y <= Math.max(yearsSinceJoin + 1, 1); y++) {
    const ann = new Date(joined)
    ann.setFullYear(ann.getFullYear() + y)
    candidates.push({ date: ann, label: `${y} year anniversary` })
  }

  for (const { date, label } of candidates) {
    const diffMs = Math.abs(today.getTime() - date.getTime())
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffDays <= ANNIVERSARY_WINDOW_DAYS) {
      return { label }
    }
  }

  return null
}

// ─── MAM-specific events ──────────────────────────────────────────────────────

/** Fires when seedbonus hits or exceeds the cap. Transition-based: only fires if previous was below cap. */
export function checkBonusCapReached(
  currentBonus: number | null | undefined,
  previousBonus: number | null | undefined,
  capLimit: number
): boolean {
  if (currentBonus == null) return false
  if (previousBonus != null && previousBonus >= capLimit) return false
  return currentBonus >= capLimit
}

/** Fires when VIP expiry is within N days from now. */
export function checkVipExpiringSoon(
  vipUntil: string | null | undefined,
  thresholdDays: number
): boolean {
  if (!vipUntil) return false
  const expiry = new Date(vipUntil)
  if (Number.isNaN(expiry.getTime())) return false
  const daysRemaining = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return daysRemaining > 0 && daysRemaining <= thresholdDays
}

/** Fires when unsatisfied count reaches or exceeds the percent threshold of the limit. */
export function checkUnsatisfiedLimitApproaching(
  unsatisfiedCount: number | null | undefined,
  unsatisfiedLimit: number | null | undefined,
  percentThreshold: number
): boolean {
  if (unsatisfiedCount == null || unsatisfiedLimit == null || unsatisfiedLimit === 0) return false
  return (unsatisfiedCount / unsatisfiedLimit) * 100 >= percentThreshold
}

/** Fires when inactive HnR count increases (transition-based). */
export function checkActiveHnrs(
  inactiveHnrCount: number | null | undefined,
  previousInactiveHnrCount: number | null | undefined
): boolean {
  if (inactiveHnrCount == null || inactiveHnrCount <= 0) return false
  if (previousInactiveHnrCount != null && previousInactiveHnrCount >= inactiveHnrCount) return false
  return true
}

// ─── Snooze durations ────────────────────────────────────────────────────────

// Per-event-type snooze duration map. Events with different urgency/frequency profiles
// get different cooldown windows to avoid notification spam.
export const EVENT_SNOOZE_MS: Record<NotificationEventType, number> = {
  ratio_drop: 6 * 60 * 60 * 1000, // 6 hours
  hit_and_run: 6 * 60 * 60 * 1000, // 6 hours
  tracker_down: 6 * 60 * 60 * 1000, // 6 hours
  buffer_milestone: 6 * 60 * 60 * 1000, // 6 hours
  warned: 6 * 60 * 60 * 1000, // 6 hours
  ratio_danger: 24 * 60 * 60 * 1000, // 24 hours — state-based, fires while below minimum
  zero_seeding: 24 * 60 * 60 * 1000, // 24 hours — state-based, fires while at 0 seeds
  rank_change: 7 * 24 * 60 * 60 * 1000, // 7 days — rare event, one notification per change
  anniversary: 7 * 24 * 60 * 60 * 1000, // 7 days — longer than the ±3-day detection window
  bonus_cap: 24 * 60 * 60 * 1000, // 24 hours
  vip_expiring: 24 * 60 * 60 * 1000, // 24 hours
  unsatisfied_limit: 6 * 60 * 60 * 1000, // 6 hours
  active_hnrs: 6 * 60 * 60 * 1000, // 6 hours
}
