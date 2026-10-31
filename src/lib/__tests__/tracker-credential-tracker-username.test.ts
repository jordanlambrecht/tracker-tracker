// src/lib/__tests__/tracker-credential-tracker-username.test.ts

import { describe, expect, it } from "vitest"
import { sanitizeNetworkError } from "@/lib/error-utils"
import { TRACKER_USERNAME_MAX } from "@/lib/limits"
import { validateTrackerUsername } from "@/lib/tracker-credentials/tracker-username"

describe("validateTrackerUsername", () => {
  it("returns working usernames trimmed, up to the bound", () => {
    // Too tight a check locks a real account out of the tracker.
    const longest = "a".repeat(TRACKER_USERNAME_MAX)
    expect(validateTrackerUsername("someone")).toBe("someone")
    expect(validateTrackerUsername("あにめ_fan.01")).toBe("あにめ_fan.01")
    // Bounded after trimming, so a pasted line break cannot push it over.
    expect(validateTrackerUsername(` ${longest}\n`)).toBe(longest)
  })

  it("rejects a control character inside the username, by code point and position", () => {
    expect(() => validateTrackerUsername("some\none")).toThrow(
      new Error("Invalid username: it contains a control character (U+000A) at position 4.")
    )
  })

  it("rejects a username over the bound", () => {
    expect(() => validateTrackerUsername("a".repeat(TRACKER_USERNAME_MAX + 1))).toThrow(
      new Error("Invalid username: it is longer than 100 characters.")
    )
  })

  it("words both rejections so the card reads as a credential fault", () => {
    // The card text comes from sanitizeNetworkError matching the message, so a
    // reword that drops "Invalid" turns it back into "Poll failed".
    for (const username of ["some\tone", "a".repeat(TRACKER_USERNAME_MAX + 1)]) {
      let message = ""
      try {
        validateTrackerUsername(username)
      } catch (err) {
        message = err instanceof Error ? err.message : ""
      }
      expect(sanitizeNetworkError(message, "Poll failed")).toBe("Invalid credentials")
    }
  })
})
