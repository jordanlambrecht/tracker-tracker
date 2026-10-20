// src/lib/tracker-platforms/__tests__/poll-error.test.ts
//
// fetchRaw puts this in `error`, and the debug view marks a call failed only
// when `error` is set, so the poll's own message must come through unchanged.

import { describe, expect, it } from "vitest"
import { pollError } from "../helpers/poll-error"

describe("pollError", () => {
  it("is null when the reader returns", () => {
    expect(pollError(() => ({ uploadedBytes: 1n, downloadedBytes: 0n }))).toBeNull()
  })

  it("is the message the reader threw, word for word", () => {
    const message = "Unexpected response from tracker.example: missing uploaded"

    expect(
      pollError(() => {
        throw new Error(message)
      })
    ).toBe(message)
  })

  it("falls back to the fetchRaw catch wording for a throw that is not an Error", () => {
    expect(
      pollError(() => {
        throw "not an Error"
      })
    ).toBe("Request failed")
  })
})
