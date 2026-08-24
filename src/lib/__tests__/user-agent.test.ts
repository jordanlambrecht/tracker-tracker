// src/lib/__tests__/user-agent.test.ts

import { describe, expect, it } from "vitest"
import { DEFAULT_USER_AGENT, withDefaultUserAgent } from "@/lib/user-agent"
import packageJson from "../../../package.json"

// ---------------------------------------------------------------------------
// DEFAULT_USER_AGENT
// ---------------------------------------------------------------------------

describe("DEFAULT_USER_AGENT", () => {
  it("identifies the app and its major.minor version", () => {
    const [major, minor] = packageJson.version.split(".")
    expect(DEFAULT_USER_AGENT).toBe(`tracker-tracker/${major}.${minor}`)
  })

  // Shape rather than segment count, since a count check also passes on
  // "2.undefined".
  it("is exactly two numeric segments, never an undefined one", () => {
    expect(DEFAULT_USER_AGENT).toMatch(/^tracker-tracker\/\d+\.\d+$/)
  })

  it("is a single header-safe token", () => {
    expect(DEFAULT_USER_AGENT).not.toMatch(/[\r\n]/)
  })
})

// ---------------------------------------------------------------------------
// withDefaultUserAgent
// ---------------------------------------------------------------------------

describe("withDefaultUserAgent", () => {
  it("adds a User-Agent when none is present", () => {
    expect(withDefaultUserAgent({ Accept: "application/json" })).toEqual({
      Accept: "application/json",
      "User-Agent": DEFAULT_USER_AGENT,
    })
  })

  it("adds a User-Agent when called with no headers at all", () => {
    expect(withDefaultUserAgent()).toEqual({ "User-Agent": DEFAULT_USER_AGENT })
  })

  it("leaves a caller-supplied User-Agent alone", () => {
    const browserUa = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    expect(withDefaultUserAgent({ "User-Agent": browserUa })).toEqual({ "User-Agent": browserUa })
  })

  // A scraping adapter must send back the exact UA its session cookie was
  // issued to. Matching case-sensitively would emit a second header rather
  // than replacing the first, which is the mismatch trackers fingerprint on.
  it("matches an existing User-Agent case-insensitively", () => {
    const result = withDefaultUserAgent({ "user-agent": "curl/8.0.1" })
    expect(result).toEqual({ "user-agent": "curl/8.0.1" })
    expect(Object.keys(result)).toHaveLength(1)
  })

  it("does not mutate the headers it was given", () => {
    const headers = { Accept: "application/json" }
    withDefaultUserAgent(headers)
    expect(headers).toEqual({ Accept: "application/json" })
  })
})
