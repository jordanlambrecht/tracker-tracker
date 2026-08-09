// src/lib/tracker-events.ts
//
// Functions: checkRatioBelowMinimum, checkRatioDelta, checkRatioBelowMinimumTransition,
//            checkTrackerError, checkWarnedTransition, checkZeroSeeding,
//            checkHnrIncrease, checkBufferMilestoneCrossed, checkRankChange,
//            checkAnniversaryMilestone, checkBonusCapReached, checkVipExpiringSoon,
//            checkUnsatisfiedLimitApproaching, checkActiveHnrs, checkDownloadDisabled,
//            EVENT_SNOOZE_MS
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

/**
 * Default number of consecutive polls an HnR increase must survive before it notifies.
 *
 * Sized from measurement, not taste: across 11 days of hourly TorrentLeech polls the counter
 * blipped to 1 four separate times, for runs of 5, 4, 2 and 4 polls, self-clearing every time.
 * 6 is the smallest value that suppresses all of them. A genuine hit-and-run is a recorded
 * penalty that never clears, so the only cost of waiting is a few hours of notice on something
 * already irreversible.
 */
export const HNR_SUSTAINED_POLLS_DEFAULT = 6

/**
 * Upper bound on the configurable poll run. The scheduler fetches HNR_SUSTAINED_POLLS_MAX + 1
 * snapshots, so a larger threshold could never be satisfied — checkHnrSustained clamps to this
 * rather than silently never firing, which is the failure mode that would look like "no HnRs".
 */
export const HNR_SUSTAINED_POLLS_MAX = 12

/** How many prior snapshots the scheduler must load to satisfy HNR_SUSTAINED_POLLS_MAX. */
export const HNR_HISTORY_POLLS = HNR_SUSTAINED_POLLS_MAX + 1

/**
 * Debounced variant of checkHnrIncrease: fires only once an increase has HELD for
 * `requiredPolls` consecutive polls.
 *
 * Some trackers (confirmed on TorrentLeech) publish a LIVE "not currently satisfying"
 * counter rather than a permanent strike record. Stale tracker-side leech records age
 * out through it, so the count blips 0 -> 1 -> 0 over a few hours with nothing actually
 * wrong. checkHnrIncrease fires on every one of those blips. A real hit-and-run is a
 * recorded penalty and never clears, so requiring persistence separates the two without
 * risking a missed strike — it only delays the alert by `requiredPolls` poll intervals.
 *
 * `history` is newest-first and INCLUDES the current value: [current, prev, prev-1, ...].
 *
 * Fires exactly once per increase, on the poll where the run reaches `requiredPolls`:
 * the increase must sit at index requiredPolls-1 (against the value immediately before
 * it), and every newer sample must have held at or above that raised level. A later poll
 * shifts the increase past that index and stops matching, so an elevated-but-flat counter
 * does not re-notify.
 */
export function checkHnrSustained(
  history: (number | null)[],
  requiredPolls: number = HNR_SUSTAINED_POLLS_DEFAULT
): boolean {
  const requested = Number.isFinite(requiredPolls)
    ? Math.floor(requiredPolls)
    : HNR_SUSTAINED_POLLS_DEFAULT
  const n = Math.min(HNR_SUSTAINED_POLLS_MAX, Math.max(1, requested))

  // Need the n samples of the run plus the one before it to prove an increase happened.
  if (history.length < n + 1) return false

  const window = history.slice(0, n + 1)
  if (window.some((v) => v === null || v === undefined)) return false
  const values = window as number[]

  const raised = values[n - 1] // oldest sample of the candidate run
  const baseline = values[n] // the sample immediately before the run

  if (raised <= baseline) return false // no increase at that offset
  return values.slice(0, n - 1).every((v) => v >= raised) // and it held ever since
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
    candidates.push({ date: ann, label: `${y}-year anniversary` })
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

// ─── Download Privileges ────────────────────────────────────────────────────

export function checkDownloadDisabled(
  canDownload: boolean | null,
  previousCanDownload: boolean | null
): boolean {
  if (canDownload === null || previousCanDownload === null) return false
  return previousCanDownload === true && canDownload === false
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
  download_disabled: 6 * 60 * 60 * 1000, // 6 hours
}
