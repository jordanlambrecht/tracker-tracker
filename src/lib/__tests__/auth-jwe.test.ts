// src/lib/__tests__/auth-jwe.test.ts
//
// Tests JWE (AES-256-GCM) encryption round-trips via jose.
// Only next/headers is mocked; jose is NOT mocked.
//
// jose v6 uses the Web Crypto API internally. The jsdom environment ships its
// own Uint8Array which fails jose's instanceof check, so we opt into the
// native Node environment for this file.

// @vitest-environment node

import crypto from "node:crypto"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Cookie store — shared across all calls within a single test
// ---------------------------------------------------------------------------

type CookieEntry = { value: string; options?: Record<string, unknown> }

let cookieState: Map<string, CookieEntry>

function createCookieStore() {
  return {
    get(name: string) {
      const entry = cookieState.get(name)
      return entry ? { name, value: entry.value } : undefined
    },
    set(name: string, value: string, options?: Record<string, unknown>) {
      cookieState.set(name, { value, options })
    },
    delete(name: string) {
      cookieState.delete(name)
    },
  }
}

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => createCookieStore()),
}))

// ---------------------------------------------------------------------------
// Fresh module import per test — avoids stale env cache in getSessionKey()
// ---------------------------------------------------------------------------

async function loadAuth() {
  vi.resetModules()
  return import("../auth")
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET_A = crypto.randomBytes(32).toString("hex") // 64 hex chars
const TEST_SECRET_B = crypto.randomBytes(32).toString("hex")
const SAMPLE_KEY = "a]3$kF9!mZq2vR7xLp0wN5sT8yU1eH4j" // 32-char encryption key

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("auth JWE real crypto", () => {
  beforeEach(() => {
    cookieState = new Map()
    vi.stubEnv("SESSION_SECRET", TEST_SECRET_A)
    vi.stubEnv("NODE_ENV", "test")
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  // ---- 1. createSession -> getSession round-trip -------------------------

  it("should round-trip an encryption key through real JWE encrypt/decrypt", async () => {
    const { createSession, getSession } = await loadAuth()

    await createSession(SAMPLE_KEY, 30)

    const session = await getSession()
    expect(session).not.toBeNull()
    expect(session?.encryptionKey).toBe(SAMPLE_KEY)
  })

  it("should round-trip with default maxAge when timeoutMinutes is null", async () => {
    const { createSession, getSession } = await loadAuth()

    await createSession(SAMPLE_KEY, null)

    const session = await getSession()
    expect(session).not.toBeNull()
    expect(session?.encryptionKey).toBe(SAMPLE_KEY)
  })

  // ---- 2. Token is not plain JSON ----------------------------------------

  it("should produce a compact JWE token, not plain JSON", async () => {
    const { createSession } = await loadAuth()

    const token = await createSession(SAMPLE_KEY, 10)

    // JWE compact serialization has 5 dot-separated base64url segments
    expect(token.split(".")).toHaveLength(5)

    // Starts with a base64url-encoded protected header
    expect(token).toMatch(/^eyJ/)

    // Must NOT be parseable as JSON — the encryption key must not be visible
    expect(() => JSON.parse(token)).toThrow()

    // The raw encryption key must not appear anywhere in the token string
    expect(token).not.toContain(SAMPLE_KEY)
  })

  // ---- 3. Wrong secret cannot decrypt ------------------------------------

  it("should return null from getSession when SESSION_SECRET changes", async () => {
    const { createSession } = await loadAuth()

    await createSession(SAMPLE_KEY, 30)

    // Confirm the cookie was set
    expect(cookieState.has("tt_session")).toBe(true)

    // Switch secret and reload module so getSessionKey() picks up the new value
    vi.stubEnv("SESSION_SECRET", TEST_SECRET_B)
    const { getSession } = await loadAuth()

    const session = await getSession()
    expect(session).toBeNull()
  })

  // ---- 4. Pending token round-trip ---------------------------------------

  it("should round-trip a pending token with real JWE", async () => {
    const { createPendingToken, verifyPendingToken } = await loadAuth()

    const token = await createPendingToken(SAMPLE_KEY)

    const result = await verifyPendingToken(token)
    expect(result).not.toBeNull()
    expect(result?.encryptionKey).toBe(SAMPLE_KEY)
  })

  it("should reject a pending token when purpose does not match", async () => {
    const { createSetupToken, verifyPendingToken } = await loadAuth()

    // Create a setup token (purpose: "setup") and try to verify as pending
    const setupToken = await createSetupToken("JBSWY3DPEHPK3PXP", "[]")

    const result = await verifyPendingToken(setupToken)
    expect(result).toBeNull()
  })

  it("should reject a session JWE as a pending token (no purpose claim)", async () => {
    const { createSession, verifyPendingToken } = await loadAuth()

    const sessionToken = await createSession(SAMPLE_KEY, 10)

    // Session tokens have no purpose field — verifyPendingToken should reject
    const result = await verifyPendingToken(sessionToken)
    expect(result).toBeNull()
  })

  it("should reject a pending token as a session (getSession ignores purpose tokens)", async () => {
    const { createPendingToken, getSession } = await loadAuth()

    const pendingToken = await createPendingToken(SAMPLE_KEY)

    // Simulate an attacker manually setting the pending token as the session cookie
    cookieState.set("tt_session", { value: pendingToken })

    const session = await getSession()
    expect(session).toBeNull()
  })

  it("should reject a setup token as a session (getSession ignores purpose tokens)", async () => {
    const { createSetupToken, getSession } = await loadAuth()

    const setupToken = await createSetupToken("JBSWY3DPEHPK3PXP", "[]")
    cookieState.set("tt_session", { value: setupToken })

    const session = await getSession()
    expect(session).toBeNull()
  })

  // ---- 5. Setup token round-trip -----------------------------------------

  it("should round-trip a setup token preserving totpSecret and backupCodesJson", async () => {
    const { createSetupToken, verifySetupToken } = await loadAuth()

    const totpSecret = "JBSWY3DPEHPK3PXP"
    const backupCodes = JSON.stringify(["a1b2-c3d4", "e5f6-7890"])

    const token = await createSetupToken(totpSecret, backupCodes)

    const result = await verifySetupToken(token)
    expect(result).not.toBeNull()
    expect(result?.totpSecret).toBe(totpSecret)
    expect(result?.backupCodesJson).toBe(backupCodes)
  })

  it("should reject a pending token when verified as a setup token", async () => {
    const { createPendingToken, verifySetupToken } = await loadAuth()

    const pendingToken = await createPendingToken(SAMPLE_KEY)

    const result = await verifySetupToken(pendingToken)
    expect(result).toBeNull()
  })

  it("should reject a setup token decrypted with the wrong secret", async () => {
    const { createSetupToken } = await loadAuth()

    const token = await createSetupToken("SECRET123", "[]")

    vi.stubEnv("SESSION_SECRET", TEST_SECRET_B)
    const { verifySetupToken } = await loadAuth()

    const result = await verifySetupToken(token)
    expect(result).toBeNull()
  })

  // ---- Additional edge cases ---------------------------------------------

  it("should return null from getSession when no cookie exists", async () => {
    const { getSession } = await loadAuth()

    const session = await getSession()
    expect(session).toBeNull()
  })

  it("should return null from getSession when cookie holds garbage", async () => {
    const { getSession } = await loadAuth()

    cookieState.set("tt_session", { value: "not-a-jwe-at-all" })

    const session = await getSession()
    expect(session).toBeNull()
  })

  it("should produce distinct JWE tokens for the same payload (different iat/iv)", async () => {
    const { createSession } = await loadAuth()

    const token1 = await createSession(SAMPLE_KEY, 10)
    const token2 = await createSession(SAMPLE_KEY, 10)

    expect(token1).not.toBe(token2)
  })
})

// ---------------------------------------------------------------------------
// getSessionKey config error propagation
// ---------------------------------------------------------------------------

describe("getSession config error propagation", () => {
  it("should throw (not return null) when SESSION_SECRET is unset", async () => {
    // Create a valid token with a good secret first
    vi.stubEnv("SESSION_SECRET", TEST_SECRET_A)
    const { createSession: createWithGoodKey } = await loadAuth()
    const token = await createWithGoodKey(SAMPLE_KEY, 10)

    // Now unset the secret and try to read the session
    vi.stubEnv("SESSION_SECRET", "")
    cookieState.set("tt_session", { value: token })
    const { getSession } = await loadAuth()

    // getSession must throw (config error), not return null (expired/invalid token)
    await expect(getSession()).rejects.toThrow("SESSION_SECRET")
  })

  it("should throw (not return null) when SESSION_SECRET is too short", async () => {
    // Create a valid token with a good secret
    vi.stubEnv("SESSION_SECRET", TEST_SECRET_A)
    const { createSession } = await loadAuth()
    const token = await createSession(SAMPLE_KEY, 10)

    // Now set a short secret
    vi.stubEnv("SESSION_SECRET", "tooshort")
    cookieState.set("tt_session", { value: token })
    const { getSession } = await loadAuth()

    await expect(getSession()).rejects.toThrow("at least 32 characters")
  })
})
