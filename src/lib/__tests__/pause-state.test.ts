// src/lib/__tests__/pause-state.test.ts
import { describe, expect, it } from "vitest"
import { getPauseState } from "@/lib/tracker-status"

describe("getPauseState", () => {
  it("returns not paused when both null", () => {
    expect(getPauseState({ pausedAt: null, userPausedAt: null })).toEqual({ isPaused: false })
  })

  it("returns user pause when only userPausedAt is set", () => {
    const result = getPauseState({ pausedAt: null, userPausedAt: "2026-03-21T12:00:00Z" })
    expect(result).toEqual({ isPaused: true, reason: "user", since: expect.any(Date) })
  })

  it("returns failure pause when only pausedAt is set", () => {
    const result = getPauseState({ pausedAt: "2026-03-20T10:00:00Z", userPausedAt: null })
    expect(result).toEqual({ isPaused: true, reason: "failure", since: expect.any(Date) })
  })

  it("returns user pause (priority) when both are set", () => {
    const result = getPauseState({
      pausedAt: "2026-03-20T10:00:00Z",
      userPausedAt: "2026-03-21T12:00:00Z",
    })
    expect(result).toEqual({ isPaused: true, reason: "user", since: expect.any(Date) })
  })

  it("accepts Date objects (server-side)", () => {
    const result = getPauseState({ pausedAt: null, userPausedAt: new Date("2026-03-21") })
    expect(result.isPaused).toBe(true)
  })

  it("handles undefined fields", () => {
    expect(getPauseState({})).toEqual({ isPaused: false })
  })
})
