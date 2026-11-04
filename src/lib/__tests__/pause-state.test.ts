// src/lib/__tests__/pause-state.test.ts
import { describe, expect, it } from "vitest"
import {
  BTN_RATE_LIMITED_CAUSE,
  BTN_RATE_LIMITED_ERROR,
  sanitizeNetworkError,
  TRACKER_CREDENTIALS_UNREADABLE_ERROR,
} from "@/lib/error-utils"
import {
  getPauseState,
  isRetryablePollError,
  isRetryingPause,
  pauseRetryDueAt,
  UNLINKED_RESTORE_ERROR,
} from "@/lib/tracker-status"

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

describe("isRetryablePollError", () => {
  // What adapters throw for a status, through the sanitizer that stores it.
  const stored = (status: number) =>
    sanitizeNetworkError(`Tracker API error: ${status} `, "Poll failed")

  it.each([502, 503, 504, 520, 524])("retries a gateway or CDN failure, HTTP %i", (status) => {
    expect(isRetryablePollError(stored(status))).toBe(true)
  })

  it.each([500, 429, 401, 525])("does not retry HTTP %i", (status) => {
    expect(isRetryablePollError(stored(status))).toBe(false)
  })

  it("retries a host that never answered", () => {
    expect(isRetryablePollError("Request timed out")).toBe(true)
  })

  it("does not retry BTN's rate limit", () => {
    const message = sanitizeNetworkError(BTN_RATE_LIMITED_CAUSE, "Poll failed")
    expect(message).toBe(BTN_RATE_LIMITED_ERROR)
    expect(isRetryablePollError(message)).toBe(false)
  })

  it("does not retry the catch-all", () => {
    expect(isRetryablePollError("Poll failed")).toBe(false)
  })

  it("retries a DNS lookup that failed for now", () => {
    const message = sanitizeNetworkError("Failed to connect to aither.cc: EAI_AGAIN", "Poll failed")
    expect(isRetryablePollError(message)).toBe(true)
  })

  it.each(["ENETUNREACH", "ECONNABORTED", "EPIPE", "UND_ERR_SOCKET"])(
    "retries a socket fault, %s",
    (code) => {
      const message = sanitizeNetworkError(`Failed to connect to aither.cc: ${code}`, "Poll failed")
      expect(isRetryablePollError(message)).toBe(true)
    }
  )

  it("does not retry a refused key whose message mentions a timeout", () => {
    const message = sanitizeNetworkError(
      "Tracker API error: 401 Unauthorized: token timed out",
      "Poll failed"
    )
    expect(message).toBe("Authentication failed")
    expect(isRetryablePollError(message)).toBe(false)
  })
})

type PauseRow = Parameters<typeof isRetryingPause>[0]

// Aither auto-paused at the fourth timeout of the 11-01 outage.
const RETRYING: PauseRow = {
  pausedAt: "2026-11-01T02:30:00Z",
  userPausedAt: null,
  isActive: true,
  registrySlug: "aither",
  lastError: "Request timed out",
}

describe("isRetryingPause", () => {
  it("retries a failure pause the tracker never answered", () => {
    expect(isRetryingPause(RETRYING)).toBe(true)
  })

  it("retries a failure pause left by a gateway failure", () => {
    expect(isRetryingPause({ ...RETRYING, lastError: "API returned 502" })).toBe(true)
  })

  it.each<[string, Partial<PauseRow>]>([
    ["that is not paused", { pausedAt: null }],
    ["the user paused", { userPausedAt: "2026-11-01T03:00:00Z" }],
    ["that is archived", { isActive: false }],
    ["that is not in the tracker list", { registrySlug: null }],
    ["holding a slug the list no longer carries", { registrySlug: "gone" }],
    ["that has shut down", { registrySlug: "fearnopeer" }],
    ["a backup restore paused", { lastError: UNLINKED_RESTORE_ERROR }],
    ["paused by a rejected key", { lastError: "Authentication failed" }],
    ["paused by invalid credentials", { lastError: "Invalid credentials" }],
    ["paused by a stored key it cannot read", { lastError: TRACKER_CREDENTIALS_UNREADABLE_ERROR }],
    ["paused by the catch-all", { lastError: "Poll failed" }],
    // Older versions refused a row set to use the proxy while it was off.
    ["paused by that old refusal", { lastError: "Proxy is required but not set up" }],
    ["paused with no error on record", { lastError: null }],
  ])("never retries a tracker %s", (_, change) => {
    expect(isRetryingPause({ ...RETRYING, ...change })).toBe(false)
  })
})

describe("pauseRetryDueAt", () => {
  const failedAt = "2026-11-01T02:30:00Z"
  const minutesAfter = (minutes: number) => new Date(Date.parse(failedAt) + minutes * 60_000)
  const dueAt = (consecutiveFailures: number, intervalMinutes: number) =>
    pauseRetryDueAt({ lastErrorAt: failedAt, consecutiveFailures }, intervalMinutes)

  it("waits one poll interval after the failure that paused it", () => {
    expect(dueAt(4, 60)).toEqual(minutesAfter(60))
  })

  it.each([
    [5, 30],
    [6, 60],
    [7, 120],
    [8, 240],
  ])(
    "doubles the wait with each failed retry: %i failures wait %i minutes",
    (failures, minutes) => {
      expect(dueAt(failures, 15)).toEqual(minutesAfter(minutes))
    }
  )

  it("stops doubling at six hours", () => {
    expect(dueAt(9, 15)).toEqual(minutesAfter(360))
    expect(dueAt(2000, 15)).toEqual(minutesAfter(360))
  })

  it("never retries sooner than a once-a-day tracker polls", () => {
    expect(dueAt(4, 1440)).toEqual(minutesAfter(1440))
    expect(dueAt(7, 1440)).toEqual(minutesAfter(1440))
  })

  it("never retries sooner than one interval, whatever the failure count", () => {
    expect(dueAt(0, 60)).toEqual(minutesAfter(60))
  })

  it("has no due time without a failure time", () => {
    expect(pauseRetryDueAt({ lastErrorAt: null, consecutiveFailures: 4 }, 60)).toBeNull()
  })

  it("reads the server's Date the same as the client's ISO string", () => {
    const fromDate = pauseRetryDueAt(
      { lastErrorAt: new Date(failedAt), consecutiveFailures: 5 },
      15
    )
    expect(fromDate).toEqual(minutesAfter(30))
  })
})
