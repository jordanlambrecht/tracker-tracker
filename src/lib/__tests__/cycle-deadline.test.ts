// src/lib/__tests__/cycle-deadline.test.ts
//
// The scheduler's cron tick sets an in-flight latch, awaits the whole poll
// cycle, and clears the latch in a finally. A cycle that never settles (one
// poll whose transport hung) therefore kept the latch set forever and every
// later tick returned at the door. withCycleDeadline bounds the await so the
// latch always clears, whatever the cycle's promise does.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { withCycleDeadline } from "@/lib/cycle-deadline"

describe("withCycleDeadline", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("passes a settled value through and leaves no timer behind", async () => {
    const result = withCycleDeadline(Promise.resolve("done"), 60_000, "poll cycle")
    await expect(result).resolves.toBe("done")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("passes a rejection through unchanged", async () => {
    const failure = new Error("adapter exploded")
    await expect(withCycleDeadline(Promise.reject(failure), 60_000, "poll cycle")).rejects.toBe(
      failure
    )
    expect(vi.getTimerCount()).toBe(0)
  })

  it("rejects a cycle that never settles once the deadline passes", async () => {
    const never = new Promise<void>(() => {})
    const bounded = withCycleDeadline(never, 60_000, "poll cycle")
    const outcome = bounded.then(
      () => "resolved",
      (err: Error) => err.message
    )

    await vi.advanceTimersByTimeAsync(59_999)
    let settled = false
    void outcome.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(outcome).resolves.toBe("poll cycle exceeded its 60000ms deadline")
  })
})
