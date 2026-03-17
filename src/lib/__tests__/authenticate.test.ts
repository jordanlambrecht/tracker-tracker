// src/lib/__tests__/authenticate.test.ts
//
// Integration tests for the authenticate() function with JWE crypto.
// Only next/headers is mocked (infrastructure); jose, getSession, and
// authenticate are all exercised as-is.

// @vitest-environment node

import { hkdfSync } from "node:crypto"
import { EncryptJWT } from "jose"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Stub SESSION_SECRET before any module that depends on it can be loaded
const TEST_SECRET = "test-session-secret-at-least-32ch" // 34 chars
vi.stubEnv("SESSION_SECRET", TEST_SECRET)

// ---------------------------------------------------------------------------
// Constants — must match the values in src/lib/auth.ts
// ---------------------------------------------------------------------------
const SESSION_COOKIE = "tt_session"

/**
 * Derive the same key that auth.ts produces from SESSION_SECRET.
 * Duplicated here intentionally so the test doesn't import the private helper.
 * Must match the HKDF derivation in getSessionKey().
 */
function deriveKey(secret: string): Uint8Array {
  return new Uint8Array(hkdfSync("sha256", secret, "", "tracker-tracker:session-v1", 32))
}

// ---------------------------------------------------------------------------
// Cookie store mock — the only thing we fake
// ---------------------------------------------------------------------------
type CookieEntry = { name: string; value: string }
let cookieStore: Map<string, CookieEntry>

function setCookie(name: string, value: string) {
  cookieStore.set(name, { name, value })
}

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get(name: string) {
      return cookieStore.get(name)
    },
    set(name: string, value: string, _opts?: Record<string, unknown>) {
      cookieStore.set(name, { name, value })
    },
    delete(name: string) {
      cookieStore.delete(name)
    },
  })),
}))

// ---------------------------------------------------------------------------
// Module under test — imported AFTER the mock is registered
// ---------------------------------------------------------------------------
let authenticate: typeof import("@/lib/api-helpers").authenticate
let getSession: typeof import("@/lib/auth").getSession

beforeAll(async () => {
  vi.stubEnv("SESSION_SECRET", TEST_SECRET)
  vi.stubEnv("NODE_ENV", "test")
  vi.resetModules() // Discard any cached auth module from prior test files in the same worker

  const apiHelpers = await import("@/lib/api-helpers")
  const auth = await import("@/lib/auth")
  authenticate = apiHelpers.authenticate
  getSession = auth.getSession
})

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  cookieStore = new Map()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid JWE exactly the way createSession does. */
async function mintValidToken(encryptionKey: string, maxAgeSeconds = 604_800): Promise<string> {
  return new EncryptJWT({ ek: encryptionKey })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .encrypt(deriveKey(TEST_SECRET))
}

/** Build a JWE whose exp claim is already in the past. */
async function mintExpiredToken(encryptionKey: string): Promise<string> {
  const pastEpoch = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
  return new EncryptJWT({ ek: encryptionKey })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(pastEpoch)
    .encrypt(deriveKey(TEST_SECRET))
}

/** Extract the JSON body from a NextResponse (status + parsed body). */
async function readResponse(res: Response): Promise<{ status: number; body: unknown }> {
  const body = await res.json()
  return { status: res.status, body }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("authenticate() with real JWE crypto", () => {
  it("should return 401 when no session cookie is present", async () => {
    // Cookie store is empty — no tt_session cookie
    const result = await authenticate()

    // authenticate returns either NextResponse (failure) or { encryptionKey }
    expect(result).toHaveProperty("status")
    const { status, body } = await readResponse(result as Response)
    expect(status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("should return 401 when session cookie contains garbage", async () => {
    setCookie(SESSION_COOKIE, "not-a-jwe-token")

    const result = await authenticate()

    expect(result).toHaveProperty("status")
    const { status, body } = await readResponse(result as Response)
    expect(status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("should return 401 when JWE is expired", async () => {
    const expiredToken = await mintExpiredToken("ab".repeat(32))
    setCookie(SESSION_COOKIE, expiredToken)

    const result = await authenticate()

    expect(result).toHaveProperty("status")
    const { status, body } = await readResponse(result as Response)
    expect(status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("should return session data from a valid JWE", async () => {
    const encryptionKey = "cf".repeat(32) // 64-char hex string
    const token = await mintValidToken(encryptionKey)
    setCookie(SESSION_COOKIE, token)

    const result = await authenticate()

    // On success, authenticate returns { encryptionKey } — not a Response
    expect(result).not.toHaveProperty("status")
    expect(result).toEqual({ encryptionKey })
  })

  it("should never leak raw JWE error details in the 401 response body", async () => {
    // Try several malformed tokens that will trigger different jose errors:
    // truncated JWE, wrong structure, partial base64
    const badTokens = [
      "not-a-jwe-token",
      "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..invalid..payload..tag",
      "a]]]b",
      "",
      "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0",
    ]

    for (const badToken of badTokens) {
      cookieStore = new Map()
      if (badToken) {
        setCookie(SESSION_COOKIE, badToken)
      }

      const result = await authenticate()
      expect(result).toHaveProperty("status")

      const { status, body } = await readResponse(result as Response)
      expect(status).toBe(401)

      // The body must be exactly { error: "Unauthorized" } — no jose internals
      expect(body).toEqual({ error: "Unauthorized" })

      // Stringify the entire body and verify it contains nothing jose-specific
      const bodyStr = JSON.stringify(body)
      expect(bodyStr).not.toMatch(/decrypt/i)
      expect(bodyStr).not.toMatch(/JWE/i)
      expect(bodyStr).not.toMatch(/compact/i)
      expect(bodyStr).not.toMatch(/invalid/i)
    }
  })

  it("should return 401 when JWE was encrypted with a different secret", async () => {
    // Encrypt with a different key than what getSession will use to decrypt
    const wrongSecret = "wrong-secret-that-is-32-chars!!!"
    const token = await new EncryptJWT({ ek: "ab".repeat(32) })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .encrypt(deriveKey(wrongSecret))

    setCookie(SESSION_COOKIE, token)

    const result = await authenticate()

    expect(result).toHaveProperty("status")
    const { status, body } = await readResponse(result as Response)
    expect(status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("should confirm getSession returns null for all invalid token scenarios", async () => {
    // Verify that getSession itself returns null (not throwing) for bad inputs
    // This tests the try/catch in getSession independently

    // Empty cookie store
    expect(await getSession()).toBeNull()

    // Garbage token
    setCookie(SESSION_COOKIE, "garbage")
    expect(await getSession()).toBeNull()

    // Expired token
    cookieStore = new Map()
    const expired = await mintExpiredToken("ab".repeat(32))
    setCookie(SESSION_COOKIE, expired)
    expect(await getSession()).toBeNull()

    // Wrong encryption key
    cookieStore = new Map()
    const wrongKey = await new EncryptJWT({ ek: "test" })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .encrypt(deriveKey("another-secret-that-is-32-chars!!"))
    setCookie(SESSION_COOKIE, wrongKey)
    expect(await getSession()).toBeNull()
  })

  it("should return the correct encryptionKey from getSession for a valid token", async () => {
    const key = "0123456789abcdef".repeat(4) // 64-char hex
    const token = await mintValidToken(key)
    setCookie(SESSION_COOKIE, token)

    const session = await getSession()
    expect(session).toEqual({ encryptionKey: key })
  })

  it("should handle the round-trip: different encryption keys yield different sessions", async () => {
    const key1 = "aa".repeat(32)
    const key2 = "bb".repeat(32)

    const token1 = await mintValidToken(key1)
    const token2 = await mintValidToken(key2)

    // First key
    setCookie(SESSION_COOKIE, token1)
    const result1 = await authenticate()
    expect(result1).toEqual({ encryptionKey: key1 })

    // Swap to second key
    setCookie(SESSION_COOKIE, token2)
    const result2 = await authenticate()
    expect(result2).toEqual({ encryptionKey: key2 })

    // They should be different
    expect(key1).not.toBe(key2)
  })
})
