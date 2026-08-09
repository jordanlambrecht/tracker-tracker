// src/lib/__tests__/tracker-events.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import { VALID_EVENT_TYPES } from "@/lib/notifications/types"
import {
  checkActiveHnrs,
  checkAnniversaryMilestone,
  checkBonusCapReached,
  checkBufferMilestoneCrossed,
  checkHnrIncrease,
  checkHnrSustained,
  checkRankChange,
  checkRatioBelowMinimum,
  checkRatioBelowMinimumTransition,
  checkRatioDelta,
  checkTrackerError,
  checkUnsatisfiedLimitApproaching,
  checkVipExpiringSoon,
  checkWarnedTransition,
  checkZeroSeeding,
  EVENT_SNOOZE_MS,
} from "@/lib/tracker-events"

describe("checkRatioBelowMinimum", () => {
  it("returns true when ratio < minimumRatio", () => {
    expect(checkRatioBelowMinimum(0.5, 0.6)).toBe(true)
  })
  it("returns false when ratio === minimumRatio", () => {
    expect(checkRatioBelowMinimum(0.6, 0.6)).toBe(false)
  })
  it("returns false when ratio > minimumRatio", () => {
    expect(checkRatioBelowMinimum(1.0, 0.6)).toBe(false)
  })
  it("returns false when ratio is null", () => {
    expect(checkRatioBelowMinimum(null, 0.6)).toBe(false)
  })
  it("returns false when minimumRatio is undefined", () => {
    expect(checkRatioBelowMinimum(0.5, undefined)).toBe(false)
  })
})

describe("checkTrackerError", () => {
  it("returns paused=true when pausedAt is set", () => {
    expect(checkTrackerError("some error", "2026-03-19")).toEqual({
      paused: true,
      pausedByUser: false,
      hasError: false,
    })
  })
  it("returns hasError=true when lastError is set and not paused", () => {
    expect(checkTrackerError("some error", null)).toEqual({
      paused: false,
      pausedByUser: false,
      hasError: true,
    })
  })
  it("returns all false when clean", () => {
    expect(checkTrackerError(null, null)).toEqual({
      paused: false,
      pausedByUser: false,
      hasError: false,
    })
  })
  it("auto-pause takes priority over hasError", () => {
    const result = checkTrackerError("error", "2026-03-19")
    expect(result.paused).toBe(true)
    expect(result.pausedByUser).toBe(false)
    expect(result.hasError).toBe(false)
  })
  it("returns pausedByUser=true when userPausedAt is set", () => {
    expect(checkTrackerError(null, null, "2026-03-21T12:00:00Z")).toEqual({
      paused: true,
      pausedByUser: true,
      hasError: false,
    })
  })
  it("userPausedAt takes priority over pausedAt", () => {
    const result = checkTrackerError(null, "2026-03-19", "2026-03-21")
    expect(result.paused).toBe(true)
    expect(result.pausedByUser).toBe(true)
  })
  it("userPausedAt takes priority over lastError", () => {
    const result = checkTrackerError("some error", null, "2026-03-21")
    expect(result.paused).toBe(true)
    expect(result.pausedByUser).toBe(true)
    expect(result.hasError).toBe(false)
  })
})

describe("checkWarnedTransition", () => {
  it("returns true when previous is false and current is true", () => {
    expect(checkWarnedTransition(false, true)).toBe(true)
  })
  it("returns true when previous is null and current is true (first poll)", () => {
    expect(checkWarnedTransition(null, true)).toBe(true)
  })
  it("returns false when current is false", () => {
    expect(checkWarnedTransition(false, false)).toBe(false)
  })
  it("returns false when previous is already true (sustained)", () => {
    expect(checkWarnedTransition(true, true)).toBe(false)
  })
  it("returns false when current is null", () => {
    expect(checkWarnedTransition(false, null)).toBe(false)
  })
})

describe("checkZeroSeeding", () => {
  it("returns true when seedingCount is 0 and isActive", () => {
    expect(checkZeroSeeding(0, true)).toBe(true)
  })
  it("returns false when seedingCount is 0 but not active", () => {
    expect(checkZeroSeeding(0, false)).toBe(false)
  })
  it("returns false when seedingCount > 0", () => {
    expect(checkZeroSeeding(5, true)).toBe(false)
  })
  it("returns false when seedingCount is null", () => {
    expect(checkZeroSeeding(null, true)).toBe(false)
  })
})

describe("checkRatioDelta", () => {
  it("returns true when drop >= delta", () => {
    expect(checkRatioDelta(1.5, 1.2, 0.1)).toBe(true)
  })
  it("returns false when drop < delta", () => {
    expect(checkRatioDelta(1.5, 1.45, 0.1)).toBe(false)
  })
  it("returns false when either ratio is null", () => {
    expect(checkRatioDelta(null, 1.2, 0.1)).toBe(false)
    expect(checkRatioDelta(1.5, null, 0.1)).toBe(false)
  })
})

describe("checkHnrIncrease", () => {
  it("returns true when current > previous", () => {
    expect(checkHnrIncrease(2, 3)).toBe(true)
  })
  it("returns false when equal", () => {
    expect(checkHnrIncrease(3, 3)).toBe(false)
  })
  it("returns false when either is null", () => {
    expect(checkHnrIncrease(null, 3)).toBe(false)
  })
})

describe("checkHnrSustained", () => {
  // history is newest-first and includes the current value: [current, prev, prev-1, ...]

  it("fires on the poll where a 3-poll run completes", () => {
    expect(checkHnrSustained([1, 1, 1, 0], 3)).toBe(true)
  })

  it("does not fire before the run is long enough", () => {
    expect(checkHnrSustained([1, 0, 0, 0], 3)).toBe(false)
    expect(checkHnrSustained([1, 1, 0, 0], 3)).toBe(false)
  })

  it("suppresses a transient blip that already cleared", () => {
    // the TorrentLeech pattern: 0 -> 1 -> 0 with nothing actually wrong
    expect(checkHnrSustained([0, 1, 0, 0], 3)).toBe(false)
    expect(checkHnrSustained([0, 1, 1, 0], 3)).toBe(false)
  })

  it("fires only once for a sustained elevation", () => {
    expect(checkHnrSustained([1, 1, 1, 0], 3)).toBe(true) // run reaches 3 — fire
    expect(checkHnrSustained([1, 1, 1, 1], 3)).toBe(false) // still elevated — stay quiet
    expect(checkHnrSustained([1, 1, 1, 1, 0], 3)).toBe(false)
  })

  it("fires again when the count climbs to a new level and holds", () => {
    expect(checkHnrSustained([2, 2, 2, 1], 3)).toBe(true)
  })

  it("does not fire when a further increase has not yet held", () => {
    expect(checkHnrSustained([2, 1, 1, 1], 3)).toBe(false)
  })

  it("still fires when the count keeps climbing during the run", () => {
    expect(checkHnrSustained([3, 2, 1, 0], 3)).toBe(true)
  })

  it("requires a full window — no firing on short history", () => {
    expect(checkHnrSustained([1, 1, 1], 3)).toBe(false)
    expect(checkHnrSustained([], 3)).toBe(false)
  })

  it("refuses to guess through null samples", () => {
    expect(checkHnrSustained([1, 1, null, 0], 3)).toBe(false)
    expect(checkHnrSustained([1, 1, 1, null], 3)).toBe(false)
  })

  it("defaults to a 6-poll run", () => {
    expect(checkHnrSustained([1, 1, 1, 1, 1, 1, 0])).toBe(true)
    expect(checkHnrSustained([1, 1, 1, 1, 1, 0, 0])).toBe(false)
  })

  it("supports an immediate (1-poll) gate", () => {
    expect(checkHnrSustained([1, 0], 1)).toBe(true)
    expect(checkHnrSustained([0, 0], 1)).toBe(false)
  })

  it("clamps an out-of-range run rather than never firing", () => {
    const longRun = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]
    expect(checkHnrSustained(longRun, 999)).toBe(true) // clamped to MAX (12)
    expect(checkHnrSustained([1, 0], 0)).toBe(true) // clamped up to 1
    expect(checkHnrSustained([1, 1, 1, 1, 1, 1, 0], Number.NaN)).toBe(true) // default
  })

  it("stays silent across every real TorrentLeech flicker", () => {
    // Verbatim hourly hit_and_runs from tracker_snapshots, 2026-07-29 -> 08-09.
    // Four separate blips (runs of 5, 4, 2, 4), each self-cleared. None is a real strike.
    const runs = [5, 4, 2, 4]
    for (const runLength of runs) {
      const series = [
        ...Array(10).fill(0),
        ...Array(runLength).fill(1),
        ...Array(10).fill(0),
      ] as number[]
      // Walk the series poll by poll, newest-first window at each step.
      for (let i = 0; i < series.length; i++) {
        const history = series.slice(0, i + 1).reverse()
        expect(checkHnrSustained(history)).toBe(false)
      }
    }
  })

  it("still catches a strike that does not clear", () => {
    const series = [...Array(10).fill(0), ...Array(10).fill(1)] as number[]
    const fired = series
      .map((_, i) => checkHnrSustained(series.slice(0, i + 1).reverse()))
      .filter(Boolean)
    expect(fired).toHaveLength(1) // exactly one alert, once the run reaches 6
  })
})

describe("checkBufferMilestoneCrossed", () => {
  const milestone = 10737418240n // 10 GiB
  it("returns true when crossing threshold upward", () => {
    expect(checkBufferMilestoneCrossed(11000000000n, 9000000000n, milestone)).toBe(true)
  })
  it("returns false when both above (no re-fire)", () => {
    expect(checkBufferMilestoneCrossed(12000000000n, 11000000000n, milestone)).toBe(false)
  })
  it("returns false when current is null", () => {
    expect(checkBufferMilestoneCrossed(null, 9000000000n, milestone)).toBe(false)
  })
  it("handles 0n as previous (first poll)", () => {
    expect(checkBufferMilestoneCrossed(11000000000n, null, milestone)).toBe(true)
  })
})

describe("checkRankChange", () => {
  it("returns the new group when group changed", () => {
    expect(checkRankChange("Elite", "Power User")).toBe("Elite")
  })
  it("returns null when group unchanged", () => {
    expect(checkRankChange("Elite", "Elite")).toBeNull()
  })
  it("returns null when either is null", () => {
    expect(checkRankChange(null, "Elite")).toBeNull()
    expect(checkRankChange("Elite", null)).toBeNull()
  })
  it("returns null when current is a redacted mask", () => {
    expect(checkRankChange("▓5", "Power User")).toBeNull()
  })
  it("returns null when previous is a redacted mask", () => {
    expect(checkRankChange("Elite", "▓8")).toBeNull()
  })
})

describe("checkRatioBelowMinimumTransition", () => {
  it("returns true when crossing below minimum", () => {
    expect(checkRatioBelowMinimumTransition(0.7, 0.5, 0.6)).toBe(true)
  })
  it("returns false when already below minimum (sustained)", () => {
    expect(checkRatioBelowMinimumTransition(0.4, 0.3, 0.6)).toBe(false)
  })
  it("returns true when previous is null (first poll below minimum)", () => {
    expect(checkRatioBelowMinimumTransition(null, 0.5, 0.6)).toBe(true)
  })
  it("returns false when current is above minimum", () => {
    expect(checkRatioBelowMinimumTransition(0.7, 0.8, 0.6)).toBe(false)
  })
  it("returns false when minimumRatio is undefined", () => {
    expect(checkRatioBelowMinimumTransition(0.7, 0.5, undefined)).toBe(false)
  })
})

describe("checkAnniversaryMilestone", () => {
  it("returns null when joinedAt is null", () => {
    expect(checkAnniversaryMilestone(null)).toBeNull()
  })
  it("returns null when no milestone is near", () => {
    // Use a date that isn't near any milestone
    const farDate = new Date()
    farDate.setMonth(farDate.getMonth() - 3) // 3 months ago — not near 1mo, 6mo, or 1yr
    farDate.setDate(farDate.getDate() + 15) // shift away from window
    expect(checkAnniversaryMilestone(farDate.toISOString().split("T")[0])).toBeNull()
  })
  // Note: testing exact milestone hits requires date mocking — cover in integration
})

// ── Edge cases identified by test architect ──────────────────────────────────

describe("checkRatioBelowMinimum edge cases", () => {
  it("returns false when minimumRatio is NaN", () => {
    expect(checkRatioBelowMinimum(0.5, Number.NaN)).toBe(false)
  })
  it("returns false when minimumRatio is Infinity", () => {
    expect(checkRatioBelowMinimum(0.5, Infinity)).toBe(false)
  })
})

describe("checkRatioBelowMinimumTransition edge cases", () => {
  it("returns false when minimumRatio is NaN", () => {
    expect(checkRatioBelowMinimumTransition(0.7, 0.5, Number.NaN)).toBe(false)
  })
  it("returns false when minimumRatio is Infinity", () => {
    expect(checkRatioBelowMinimumTransition(0.7, 0.5, Infinity)).toBe(false)
  })
  it("returns false when current equals minimumRatio exactly", () => {
    expect(checkRatioBelowMinimumTransition(0.7, 0.6, 0.6)).toBe(false)
  })
  it("returns true when previous equals minimumRatio and current is below", () => {
    expect(checkRatioBelowMinimumTransition(0.6, 0.5, 0.6)).toBe(true)
  })
})

describe("checkRatioDelta edge cases", () => {
  it("returns true when drop exactly equals delta", () => {
    expect(checkRatioDelta(1.3, 1.2, 0.1)).toBe(true)
  })
})

describe("checkBufferMilestoneCrossed edge cases", () => {
  const milestone = 10737418240n
  it("returns true when current exactly equals milestone", () => {
    expect(checkBufferMilestoneCrossed(milestone, 9000000000n, milestone)).toBe(true)
  })
  it("returns false when crossing downward", () => {
    expect(checkBufferMilestoneCrossed(9000000000n, 11000000000n, milestone)).toBe(false)
  })
})

describe("checkAnniversaryMilestone with date mocking", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns 1 month anniversary on exact date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-15"))
    expect(checkAnniversaryMilestone("2026-03-15")).toEqual({ label: "1 month anniversary" })
    vi.useRealTimers()
  })

  it("returns 6 month anniversary on exact date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-15"))
    expect(checkAnniversaryMilestone("2026-03-15")).toEqual({ label: "6 month anniversary" })
    vi.useRealTimers()
  })

  it("returns 1 year anniversary on exact date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-19T12:00:00"))
    expect(checkAnniversaryMilestone("2025-03-19")).toEqual({ label: "1-year anniversary" })
    vi.useRealTimers()
  })

  it("returns multi-year anniversary", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2031-03-15"))
    expect(checkAnniversaryMilestone("2026-03-15")).toEqual({ label: "5-year anniversary" })
    vi.useRealTimers()
  })

  it("returns null for invalid date string", () => {
    expect(checkAnniversaryMilestone("not-a-date")).toBeNull()
  })

  it("matches within the +/-3 day window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-21T12:00:00")) // 2 days after 1yr anniversary
    expect(checkAnniversaryMilestone("2025-03-19")).toEqual({ label: "1-year anniversary" })
    vi.useRealTimers()
  })

  it("does not match outside the +/-3 day window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-25T12:00:00")) // 6 days after
    expect(checkAnniversaryMilestone("2025-03-19")).toBeNull()
    vi.useRealTimers()
  })

  it("prefers 1 month over 1 year when both could match", () => {
    // Edge case: 1 month anniversary checked before annual milestones
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-15"))
    const result = checkAnniversaryMilestone("2026-03-15")
    expect(result?.label).toBe("1 month anniversary")
    vi.useRealTimers()
  })
})

describe("EVENT_SNOOZE_MS", () => {
  it("defines snooze durations for all event types", () => {
    for (const type of VALID_EVENT_TYPES) {
      expect(EVENT_SNOOZE_MS[type]).toBeDefined()
      expect(typeof EVENT_SNOOZE_MS[type]).toBe("number")
      expect(EVENT_SNOOZE_MS[type]).toBeGreaterThan(0)
    }
  })
})

describe("checkBonusCapReached", () => {
  it("returns true when current >= capLimit and previous was below cap (transition)", () => {
    expect(checkBonusCapReached(1000, 800, 1000)).toBe(true)
  })
  it("returns true when current exceeds capLimit and previous was below cap", () => {
    expect(checkBonusCapReached(1200, 800, 1000)).toBe(true)
  })
  it("returns false when current is below capLimit", () => {
    expect(checkBonusCapReached(900, 800, 1000)).toBe(false)
  })
  it("returns false when previous was already at or above capLimit (already notified)", () => {
    expect(checkBonusCapReached(1100, 1000, 1000)).toBe(false)
  })
  it("returns false when currentBonus is null", () => {
    expect(checkBonusCapReached(null, 800, 1000)).toBe(false)
  })
  it("returns false when currentBonus is undefined", () => {
    expect(checkBonusCapReached(undefined, 800, 1000)).toBe(false)
  })
  it("returns true when previousBonus is null and current >= capLimit (first poll at cap fires)", () => {
    expect(checkBonusCapReached(1000, null, 1000)).toBe(true)
  })
})

describe("checkVipExpiringSoon", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns true when expiry is within threshold days", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-26T00:00:00Z"))
    // Expires in 3 days, threshold is 7
    expect(checkVipExpiringSoon("2026-03-29T00:00:00Z", 7)).toBe(true)
  })
  it("returns false when expiry is beyond threshold days", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-26T00:00:00Z"))
    // Expires in 30 days, threshold is 7
    expect(checkVipExpiringSoon("2026-04-25T00:00:00Z", 7)).toBe(false)
  })
  it("returns false when vipUntil is null", () => {
    expect(checkVipExpiringSoon(null, 7)).toBe(false)
  })
  it("returns false when vipUntil is undefined", () => {
    expect(checkVipExpiringSoon(undefined, 7)).toBe(false)
  })
  it("returns false when vipUntil is an invalid date string", () => {
    expect(checkVipExpiringSoon("not-a-date", 7)).toBe(false)
  })
  it("returns false when VIP has already expired (date in the past)", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-26T00:00:00Z"))
    expect(checkVipExpiringSoon("2026-03-20T00:00:00Z", 7)).toBe(false)
  })
})

describe("checkUnsatisfiedLimitApproaching", () => {
  it("returns true when count/limit ratio meets the percent threshold", () => {
    // 80/100 = 80% >= 80%
    expect(checkUnsatisfiedLimitApproaching(80, 100, 80)).toBe(true)
  })
  it("returns true when count/limit ratio exceeds the percent threshold", () => {
    // 90/100 = 90% >= 80%
    expect(checkUnsatisfiedLimitApproaching(90, 100, 80)).toBe(true)
  })
  it("returns false when count/limit ratio is below threshold", () => {
    // 50/100 = 50% < 80%
    expect(checkUnsatisfiedLimitApproaching(50, 100, 80)).toBe(false)
  })
  it("returns false when count is null", () => {
    expect(checkUnsatisfiedLimitApproaching(null, 100, 80)).toBe(false)
  })
  it("returns false when count is undefined", () => {
    expect(checkUnsatisfiedLimitApproaching(undefined, 100, 80)).toBe(false)
  })
  it("returns false when limit is null", () => {
    expect(checkUnsatisfiedLimitApproaching(80, null, 80)).toBe(false)
  })
  it("returns false when limit is 0 (division by zero guard)", () => {
    expect(checkUnsatisfiedLimitApproaching(80, 0, 80)).toBe(false)
  })
})

describe("checkActiveHnrs", () => {
  it("returns true when count increased from 0 to 2 (transition)", () => {
    expect(checkActiveHnrs(2, 0)).toBe(true)
  })
  it("returns true when count increased from a prior positive value", () => {
    expect(checkActiveHnrs(5, 3)).toBe(true)
  })
  it("returns false when count is 0", () => {
    expect(checkActiveHnrs(0, 0)).toBe(false)
  })
  it("returns false when count is null", () => {
    expect(checkActiveHnrs(null, 0)).toBe(false)
  })
  it("returns false when count is undefined", () => {
    expect(checkActiveHnrs(undefined, 0)).toBe(false)
  })
  it("returns false when count stayed the same (already notified)", () => {
    expect(checkActiveHnrs(3, 3)).toBe(false)
  })
  it("returns false when count decreased (resolving HnRs)", () => {
    expect(checkActiveHnrs(2, 5)).toBe(false)
  })
})
