// src/lib/__tests__/tracker-events.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import type { NotificationEventType } from "@/lib/notifications/types"
import { VALID_EVENT_TYPES } from "@/lib/notifications/types"
import {
  checkAnniversaryMilestone,
  checkBufferMilestoneCrossed,
  checkHnrIncrease,
  checkRankChange,
  checkRatioBelowMinimum,
  checkRatioBelowMinimumTransition,
  checkRatioDelta,
  checkTrackerError,
  checkWarned,
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
    expect(checkTrackerError("some error", "2026-03-19")).toEqual({ paused: true, pausedByUser: false, hasError: false })
  })
  it("returns hasError=true when lastError is set and not paused", () => {
    expect(checkTrackerError("some error", null)).toEqual({ paused: false, pausedByUser: false, hasError: true })
  })
  it("returns all false when clean", () => {
    expect(checkTrackerError(null, null)).toEqual({ paused: false, pausedByUser: false, hasError: false })
  })
  it("auto-pause takes priority over hasError", () => {
    const result = checkTrackerError("error", "2026-03-19")
    expect(result.paused).toBe(true)
    expect(result.pausedByUser).toBe(false)
    expect(result.hasError).toBe(false)
  })
  it("returns pausedByUser=true when userPausedAt is set", () => {
    expect(checkTrackerError(null, null, "2026-03-21T12:00:00Z")).toEqual({ paused: true, pausedByUser: true, hasError: false })
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

describe("checkWarned", () => {
  it("returns true when warned is true", () => {
    expect(checkWarned(true)).toBe(true)
  })
  it("returns false when warned is false", () => {
    expect(checkWarned(false)).toBe(false)
  })
  it("returns false when warned is null", () => {
    expect(checkWarned(null)).toBe(false)
  })
  it("returns false when warned is undefined", () => {
    expect(checkWarned(undefined)).toBe(false)
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

  it("returns 1 year anniversary on exact date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-19T12:00:00"))
    expect(checkAnniversaryMilestone("2025-03-19")).toEqual({ label: "1 year anniversary" })
    vi.useRealTimers()
  })
  it("returns null for invalid date string", () => {
    expect(checkAnniversaryMilestone("not-a-date")).toBeNull()
  })
  it("matches within the +/-3 day window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-21T12:00:00")) // 2 days after 1yr anniversary
    expect(checkAnniversaryMilestone("2025-03-19")).toEqual({ label: "1 year anniversary" })
    vi.useRealTimers()
  })
  it("does not match outside the +/-3 day window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-25T12:00:00")) // 6 days after
    expect(checkAnniversaryMilestone("2025-03-19")).toBeNull()
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
  it("uses 6h for ratio_drop, hit_and_run, tracker_down, buffer_milestone, warned", () => {
    const sixHours = 6 * 60 * 60 * 1000
    for (const type of [
      "ratio_drop",
      "hit_and_run",
      "tracker_down",
      "buffer_milestone",
      "warned",
    ] as NotificationEventType[]) {
      expect(EVENT_SNOOZE_MS[type]).toBe(sixHours)
    }
  })
  it("uses 24h for ratio_danger and zero_seeding", () => {
    const twentyFourHours = 24 * 60 * 60 * 1000
    expect(EVENT_SNOOZE_MS.ratio_danger).toBe(twentyFourHours)
    expect(EVENT_SNOOZE_MS.zero_seeding).toBe(twentyFourHours)
  })
  it("uses 7 days for rank_change and anniversary", () => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    expect(EVENT_SNOOZE_MS.rank_change).toBe(sevenDays)
    expect(EVENT_SNOOZE_MS.anniversary).toBe(sevenDays)
  })
})
