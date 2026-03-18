// src/lib/__tests__/uptime.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
  },
}))

import { db } from "@/lib/db"
import { floorToFiveMin, flushCompletedBuckets, recordHeartbeat } from "@/lib/uptime"

function mockDbInsert() {
  const chain = {
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }),
  }
  vi.mocked(db.insert).mockReturnValue(chain as never)
  return chain
}

describe("floorToFiveMin", () => {
  it("floors 12:07:33 to 12:05:00", () => {
    const input = new Date("2026-03-14T12:07:33Z")
    const result = floorToFiveMin(input)
    expect(result.getTime()).toBe(new Date("2026-03-14T12:05:00Z").getTime())
  })

  it("keeps exact 5-min boundaries unchanged", () => {
    const input = new Date("2026-03-14T12:10:00Z")
    const result = floorToFiveMin(input)
    expect(result.getTime()).toBe(input.getTime())
  })

  it("floors 12:00:01 to 12:00:00", () => {
    const input = new Date("2026-03-14T12:00:01Z")
    const result = floorToFiveMin(input)
    expect(result.getTime()).toBe(new Date("2026-03-14T12:00:00Z").getTime())
  })

  it("floors 12:04:59 to 12:00:00", () => {
    const input = new Date("2026-03-14T12:04:59Z")
    const result = floorToFiveMin(input)
    expect(result.getTime()).toBe(new Date("2026-03-14T12:00:00Z").getTime())
  })
})

describe("recordHeartbeat + flushCompletedBuckets", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-14T12:05:00Z"))
    vi.clearAllMocks()
    const gAny = globalThis as Record<string, unknown>
    delete gAny.__uptimeAccumulator
    delete gAny.__uptimeFlushQueue
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not flush a bucket that is still in progress", async () => {
    mockDbInsert()

    recordHeartbeat(1, true)
    recordHeartbeat(1, true)
    recordHeartbeat(1, false)

    const flushed = await flushCompletedBuckets()
    expect(flushed).toBe(0)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("flushes a completed bucket when time advances past boundary", async () => {
    const insertChain = mockDbInsert()

    recordHeartbeat(1, true)
    recordHeartbeat(1, true)
    recordHeartbeat(1, false)

    // Advance past the 12:10 boundary
    vi.setSystemTime(new Date("2026-03-14T12:10:01Z"))

    // Record in the new bucket — this triggers the old bucket to enter the flush queue
    recordHeartbeat(1, true)

    const flushed = await flushCompletedBuckets()
    expect(flushed).toBe(1)
    // Batch: one insert call with an array of rows
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(insertChain.values).toHaveBeenCalledWith([
      expect.objectContaining({
        clientId: 1,
        ok: 2,
        fail: 1,
      }),
    ])
  })

  it("tracks multiple clients independently", async () => {
    const insertChain = mockDbInsert()

    recordHeartbeat(1, true)
    recordHeartbeat(2, false)

    vi.setSystemTime(new Date("2026-03-14T12:10:01Z"))
    recordHeartbeat(1, true)
    recordHeartbeat(2, true)

    const flushed = await flushCompletedBuckets()
    expect(flushed).toBe(2)
    // Batch: one insert call with 2 rows (not 2 separate insert calls)
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ clientId: 1, ok: 1, fail: 0 }),
        expect.objectContaining({ clientId: 2, ok: 0, fail: 1 }),
      ])
    )
  })

  it("returns 0 when flush queue is empty", async () => {
    const flushed = await flushCompletedBuckets()
    expect(flushed).toBe(0)
  })
})
