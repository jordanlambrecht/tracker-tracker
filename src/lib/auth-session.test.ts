// src/lib/auth-session.test.ts
//
// Functions: resetCookieState, getCookieOptions, createCookieStore, loadAuthModule

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

type CookieEntry = {
  value: string
  options?: Record<string, unknown>
}

const cookieState = new Map<string, CookieEntry>()
const deletedCookies: string[] = []

function resetCookieState() {
  cookieState.clear()
  deletedCookies.length = 0
}

function getCookieOptions(name: string): Record<string, unknown> | undefined {
  return cookieState.get(name)?.options
}

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
      deletedCookies.push(name)
      cookieState.delete(name)
    },
  }
}

async function loadAuthModule() {
  vi.resetModules()
  return import("./auth")
}

let tokenCounter = 0

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => createCookieStore()),
}))

vi.mock("jose", () => ({
  EncryptJWT: class EncryptJWT {
    private payload: Record<string, unknown>

    constructor(payload: Record<string, unknown>) {
      this.payload = payload
    }

    setProtectedHeader() {
      return this
    }

    setIssuedAt() {
      return this
    }

    setExpirationTime() {
      return this
    }

    async encrypt() {
      tokenCounter += 1
      return JSON.stringify({ payload: this.payload, tokenCounter })
    }
  },
  jwtDecrypt: vi.fn(async (token: string) => ({ payload: JSON.parse(token).payload })),
}))

vi.mock("@/lib/cookie-security", async () => {
  return {
    shouldSecureCookies: () => {
      if (process.env.SECURE_COOKIES === "true") return true
      if (process.env.BASE_URL?.toLowerCase().startsWith("https://")) return true
      return false
    },
  }
})

describe("auth session cookies", () => {
  beforeEach(() => {
    resetCookieState()
    tokenCounter = 0
    vi.unstubAllEnvs()
    vi.stubEnv("SESSION_SECRET", "x".repeat(32))
    vi.stubEnv("NODE_ENV", "test")
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it("sets HttpOnly strict session cookies and decrypts them through getSession", async () => {
    const { createSession, getSession } = await loadAuthModule()

    const token = await createSession("a".repeat(64), 30)

    expect(cookieState.get("tt_session")?.value).toBe(token)
    expect(cookieState.get("tt_max_age")?.value).toBe("1800")
    expect(getCookieOptions("tt_session")).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      maxAge: 1800,
      path: "/",
    })
    expect(getCookieOptions("tt_max_age")).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      maxAge: 1800,
      path: "/",
    })

    await expect(getSession()).resolves.toEqual({ encryptionKey: "a".repeat(64) })
  })

  it("uses secure cookies when SECURE_COOKIES=true and different tokens per session", async () => {
    vi.stubEnv("SECURE_COOKIES", "true")
    const { createSession } = await loadAuthModule()

    const first = await createSession("b".repeat(64), null)
    const second = await createSession("b".repeat(64), null)

    expect(first).not.toBe(second)
    expect(getCookieOptions("tt_session")).toMatchObject({
      secure: true,
      maxAge: 60 * 60 * 24 * 7,
    })
  })

  it("enables secure cookies when BASE_URL uses https", async () => {
    vi.stubEnv("BASE_URL", "https://trackertracker.example.com")
    const { createSession } = await loadAuthModule()

    await createSession("f".repeat(64), null)

    expect(getCookieOptions("tt_session")).toMatchObject({
      secure: true,
    })
  })

  it("does not set secure cookies when NODE_ENV is production but no SECURE_COOKIES or HTTPS BASE_URL", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { createSession } = await loadAuthModule()

    await createSession("g".repeat(64), null)

    expect(getCookieOptions("tt_session")).toMatchObject({
      secure: false,
    })
  })

  it("does not set secure cookies when BASE_URL uses http://", async () => {
    vi.stubEnv("BASE_URL", "http://trackertracker.local")
    const { createSession } = await loadAuthModule()

    await createSession("h".repeat(64), null)

    expect(getCookieOptions("tt_session")).toMatchObject({
      secure: false,
    })
    expect(getCookieOptions("tt_max_age")).toMatchObject({
      secure: false,
    })
  })

  it("does not set secure cookies when SECURE_COOKIES is the string 'false'", async () => {
    vi.stubEnv("SECURE_COOKIES", "false")
    const { createSession } = await loadAuthModule()

    await createSession("i".repeat(64), null)

    expect(getCookieOptions("tt_session")).toMatchObject({
      secure: false,
    })
  })

  it("sets secure cookies when BASE_URL uses HTTPS:// with uppercase scheme", async () => {
    vi.stubEnv("BASE_URL", "HTTPS://trackertracker.example.com")
    const { createSession } = await loadAuthModule()

    await createSession("j".repeat(64), null)

    expect(getCookieOptions("tt_session")).toMatchObject({
      secure: true,
    })
  })

  it("clears both cookies on logout", async () => {
    const { clearSession, createSession } = await loadAuthModule()

    await createSession("c".repeat(64), 15)
    await clearSession()

    expect(deletedCookies).toEqual(["tt_session", "tt_max_age"])
    expect(cookieState.size).toBe(0)
  })

  it("returns null when session decryption fails and verifies pending tokens separately", async () => {
    const { createPendingToken, createSession, getSession, verifyPendingToken } =
      await loadAuthModule()

    const pendingToken = await createPendingToken("d".repeat(64))
    await expect(verifyPendingToken(pendingToken)).resolves.toEqual({
      encryptionKey: "d".repeat(64),
    })

    await createSession("e".repeat(64), 10)
    cookieState.set("tt_session", { value: "not-a-real-jwe" })

    await expect(getSession()).resolves.toBeNull()
    await expect(verifyPendingToken(cookieState.get("tt_session")?.value ?? "")).resolves.toBeNull()
  })
})
