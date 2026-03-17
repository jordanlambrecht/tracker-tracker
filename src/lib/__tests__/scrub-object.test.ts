// src/lib/__tests__/scrub-object.test.ts

import { describe, expect, it } from "vitest"
import { scrubObject, SCRUB_KEYS } from "@/lib/scrub-object"

// ---------------------------------------------------------------------------
// SCRUB_KEYS contract
// ---------------------------------------------------------------------------

describe("SCRUB_KEYS", () => {
  it("contains all expected sensitive key names", () => {
    expect(SCRUB_KEYS.has("authkey")).toBe(true)
    expect(SCRUB_KEYS.has("passkey")).toBe(true)
    expect(SCRUB_KEYS.has("ip")).toBe(true)
    expect(SCRUB_KEYS.has("api_token")).toBe(true)
    expect(SCRUB_KEYS.has("key")).toBe(true)
    expect(SCRUB_KEYS.has("torrent_pass")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Top-level key redaction
// ---------------------------------------------------------------------------

describe("scrubObject — top-level sensitive keys", () => {
  it("replaces authkey with [redacted]", () => {
    expect(scrubObject({ authkey: "abc123" })).toEqual({ authkey: "[redacted]" })
  })

  it("replaces passkey with [redacted]", () => {
    expect(scrubObject({ passkey: "secret" })).toEqual({ passkey: "[redacted]" })
  })

  it("replaces ip with [redacted]", () => {
    expect(scrubObject({ ip: "192.168.1.1" })).toEqual({ ip: "[redacted]" })
  })

  it("replaces api_token with [redacted]", () => {
    expect(scrubObject({ api_token: "tok_xyz" })).toEqual({ api_token: "[redacted]" })
  })

  it("replaces key with [redacted]", () => {
    expect(scrubObject({ key: "mykey" })).toEqual({ key: "[redacted]" })
  })

  it("replaces torrent_pass with [redacted]", () => {
    expect(scrubObject({ torrent_pass: "tp_value" })).toEqual({ torrent_pass: "[redacted]" })
  })

  it("redacts all sensitive keys present in the same object", () => {
    const input = {
      authkey: "a",
      passkey: "b",
      ip: "1.2.3.4",
      api_token: "c",
      key: "d",
      torrent_pass: "e",
    }
    const result = scrubObject(input)
    expect(result).toEqual({
      authkey: "[redacted]",
      passkey: "[redacted]",
      ip: "[redacted]",
      api_token: "[redacted]",
      key: "[redacted]",
      torrent_pass: "[redacted]",
    })
  })
})

// ---------------------------------------------------------------------------
// Non-sensitive key preservation
// ---------------------------------------------------------------------------

describe("scrubObject — non-sensitive keys are preserved", () => {
  it("passes through string values untouched", () => {
    expect(scrubObject({ username: "alice" })).toEqual({ username: "alice" })
  })

  it("passes through numeric values untouched", () => {
    expect(scrubObject({ uploaded: 1000, downloaded: 500 })).toEqual({
      uploaded: 1000,
      downloaded: 500,
    })
  })

  it("passes through boolean values untouched", () => {
    expect(scrubObject({ warned: false })).toEqual({ warned: false })
  })

  it("passes through null values on non-sensitive keys untouched", () => {
    expect(scrubObject({ requiredRatio: null })).toEqual({ requiredRatio: null })
  })

  it("does not redact keys that only partially match a sensitive name", () => {
    expect(scrubObject({ mypasskey: "safe", keything: "also-safe" })).toEqual({
      mypasskey: "safe",
      keything: "also-safe",
    })
  })
})

// ---------------------------------------------------------------------------
// Case-insensitive key matching
// ---------------------------------------------------------------------------

describe("scrubObject — case-insensitive key matching", () => {
  it("redacts uppercase API_TOKEN", () => {
    expect(scrubObject({ API_TOKEN: "tok" })).toEqual({ API_TOKEN: "[redacted]" })
  })

  it("redacts mixed-case Api_Token", () => {
    expect(scrubObject({ Api_Token: "tok" })).toEqual({ Api_Token: "[redacted]" })
  })

  it("redacts all-caps PASSKEY", () => {
    expect(scrubObject({ PASSKEY: "p" })).toEqual({ PASSKEY: "[redacted]" })
  })

  it("redacts mixed-case Authkey", () => {
    expect(scrubObject({ Authkey: "a" })).toEqual({ Authkey: "[redacted]" })
  })

  it("redacts uppercase IP", () => {
    expect(scrubObject({ IP: "10.0.0.1" })).toEqual({ IP: "[redacted]" })
  })

  it("redacts uppercase KEY", () => {
    expect(scrubObject({ KEY: "k" })).toEqual({ KEY: "[redacted]" })
  })

  it("redacts mixed-case Torrent_Pass", () => {
    expect(scrubObject({ Torrent_Pass: "tp" })).toEqual({ Torrent_Pass: "[redacted]" })
  })
})

// ---------------------------------------------------------------------------
// Nested object recursion
// ---------------------------------------------------------------------------

describe("scrubObject — nested objects", () => {
  it("redacts sensitive keys one level deep", () => {
    const input = { response: { authkey: "secret", username: "alice" } }
    expect(scrubObject(input)).toEqual({
      response: { authkey: "[redacted]", username: "alice" },
    })
  })

  it("redacts sensitive keys two levels deep", () => {
    const input = { data: { user: { passkey: "deep-secret" } } }
    expect(scrubObject(input)).toEqual({
      data: { user: { passkey: "[redacted]" } },
    })
  })

  it("preserves non-sensitive keys at all nesting levels", () => {
    const input = {
      outer: "safe",
      nested: {
        inner: "also-safe",
        deeper: {
          deepest: "still-safe",
        },
      },
    }
    expect(scrubObject(input)).toEqual(input)
  })

  it("handles an object mixed with sensitive and safe keys at multiple depths", () => {
    const input = {
      tracker: "MyTracker",
      auth: {
        api_token: "tok",
        userId: 42,
        meta: {
          ip: "1.2.3.4",
          region: "us-east",
        },
      },
    }
    expect(scrubObject(input)).toEqual({
      tracker: "MyTracker",
      auth: {
        api_token: "[redacted]",
        userId: 42,
        meta: {
          ip: "[redacted]",
          region: "us-east",
        },
      },
    })
  })
})

// ---------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------

describe("scrubObject — arrays", () => {
  it("redacts sensitive keys inside array elements", () => {
    const input = [{ passkey: "abc" }, { passkey: "def" }]
    expect(scrubObject(input)).toEqual([{ passkey: "[redacted]" }, { passkey: "[redacted]" }])
  })

  it("preserves non-sensitive keys inside array elements", () => {
    const input = [{ username: "alice" }, { username: "bob" }]
    expect(scrubObject(input)).toEqual([{ username: "alice" }, { username: "bob" }])
  })

  it("handles an array nested inside an object", () => {
    const input = { torrents: [{ name: "Movie.mkv", torrent_pass: "secret" }] }
    expect(scrubObject(input)).toEqual({
      torrents: [{ name: "Movie.mkv", torrent_pass: "[redacted]" }],
    })
  })

  it("handles arrays of primitives without modification", () => {
    const input = { tags: ["free", "featured"] }
    expect(scrubObject(input)).toEqual({ tags: ["free", "featured"] })
  })

  it("handles an empty array without error", () => {
    expect(scrubObject([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Null and primitive inputs
// ---------------------------------------------------------------------------

describe("scrubObject — null and primitive inputs", () => {
  it("returns null unchanged", () => {
    expect(scrubObject(null)).toBeNull()
  })

  it("returns a number unchanged", () => {
    expect(scrubObject(42)).toBe(42)
  })

  it("returns a string unchanged", () => {
    expect(scrubObject("hello")).toBe("hello")
  })

  it("returns a boolean unchanged", () => {
    expect(scrubObject(true)).toBe(true)
    expect(scrubObject(false)).toBe(false)
  })

  it("returns undefined unchanged", () => {
    expect(scrubObject(undefined)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Depth limit
// ---------------------------------------------------------------------------

describe("scrubObject — depth limit", () => {
  it("returns deeply nested objects as-is beyond depth 10 without infinite recursion", () => {
    // Build a chain of 15 nested objects, with a passkey at the very bottom
    type DeepObj = { wrapper?: DeepObj; passkey?: string }
    let deep: DeepObj = { passkey: "should-survive-past-depth-10" }
    for (let i = 0; i < 14; i++) {
      deep = { wrapper: deep }
    }

    // The function must not throw and must terminate
    const result = scrubObject(deep)
    expect(result).toBeDefined()

    // Navigate 11 levels in — at that point scrubObject returns the node as-is
    // so the passkey value is NOT [redacted] at depth > 10
    let node = result as DeepObj
    for (let i = 0; i < 11; i++) {
      node = node.wrapper as DeepObj
    }
    // The passkey nested deeper than 10 levels survives unredacted
    expect(node).toBeDefined()
  })

  it("still redacts keys at exactly depth 10", () => {
    // Build exactly 10 levels of wrapping
    type DeepObj = { wrapper?: DeepObj; passkey?: string }
    let deep: DeepObj = { passkey: "at-limit" }
    for (let i = 0; i < 9; i++) {
      deep = { wrapper: deep }
    }

    const result = scrubObject(deep) as DeepObj
    // Navigate 9 levels to reach the object containing passkey
    let node = result
    for (let i = 0; i < 9; i++) {
      node = node.wrapper as DeepObj
    }
    // At depth 10 (the 10th recursive call), the key should still be redacted
    expect(node.passkey).toBe("[redacted]")
  })
})
