// src/app/api/auth/auth-routes.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearSession, createSession, getSession, hashPassword, verifyPassword } from "@/lib/auth"
import { deriveKey, generateSalt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { startScheduler, stopScheduler } from "@/lib/scheduler"

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
}))

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
  getSession: vi.fn(),
  clearSession: vi.fn(),
}))

vi.mock("@/lib/crypto", () => ({
  generateSalt: vi.fn(),
  deriveKey: vi.fn(),
}))

vi.mock("@/lib/scheduler", () => ({
  startScheduler: vi.fn(),
  stopScheduler: vi.fn(),
}))

function makeSelectChain(resolvedValue: unknown) {
  const mockLimit = vi.fn().mockResolvedValue(resolvedValue)
  const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit })
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })
  return { mockLimit, mockFrom }
}

function makeInsertChain() {
  const mockValues = vi.fn().mockResolvedValue(undefined)
  ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })
  return { mockValues }
}

describe("POST /api/auth/setup", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 200 with success true when not yet configured", async () => {
    makeSelectChain([])
    const { mockValues } = makeInsertChain()
    ;(hashPassword as ReturnType<typeof vi.fn>).mockResolvedValue("hashed")
    ;(generateSalt as ReturnType<typeof vi.fn>).mockReturnValue("salt123")

    const { POST } = await import("./setup/route")
    const req = new Request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "valid-password-123" }),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: expect.any(String),
        encryptionSalt: expect.any(String),
      })
    )
  })

  it("returns 400 when already configured", async () => {
    makeSelectChain([{ id: 1, passwordHash: "hash", encryptionSalt: "salt" }])

    const { POST } = await import("./setup/route")
    const req = new Request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "valid-password-123" }),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Already configured" })
  })

  it("returns 400 for invalid JSON", async () => {
    makeSelectChain([])

    const { POST } = await import("./setup/route")
    const req = new Request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Invalid JSON" })
  })

  it("returns 400 when password is too short", async () => {
    makeSelectChain([])

    const { POST } = await import("./setup/route")
    const req = new Request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "short" }),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Password must be between 8 and 128 characters" })
  })

  it("returns 400 when password is too long", async () => {
    makeSelectChain([])

    const { POST } = await import("./setup/route")
    const req = new Request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "a".repeat(129) }),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Password must be between 8 and 128 characters" })
  })

  it("returns 400 when password is missing", async () => {
    makeSelectChain([])

    const { POST } = await import("./setup/route")
    const req = new Request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Password must be between 8 and 128 characters" })
  })

  it("accepts password of exactly 8 characters", async () => {
    makeSelectChain([])
    makeInsertChain()
    ;(hashPassword as ReturnType<typeof vi.fn>).mockResolvedValue("hashed")
    ;(generateSalt as ReturnType<typeof vi.fn>).mockReturnValue("salt123")

    const { POST } = await import("./setup/route")
    const req = new Request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "a".repeat(8) }),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
  })

  it("accepts password of exactly 128 characters", async () => {
    makeSelectChain([])
    makeInsertChain()
    ;(hashPassword as ReturnType<typeof vi.fn>).mockResolvedValue("hashed")
    ;(generateSalt as ReturnType<typeof vi.fn>).mockReturnValue("salt123")

    const { POST } = await import("./setup/route")
    const req = new Request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "a".repeat(128) }),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
  })
})

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 200 and calls createSession and startScheduler on success", async () => {
    const fakeSettings = { id: 1, passwordHash: "hash", encryptionSalt: "salt" }
    makeSelectChain([fakeSettings])
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    const fakeKey = Buffer.from("a".repeat(32))
    ;(deriveKey as ReturnType<typeof vi.fn>).mockResolvedValue(fakeKey)
    ;(createSession as ReturnType<typeof vi.fn>).mockResolvedValue("token")
    ;(startScheduler as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

    const { POST } = await import("./login/route")
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "valid-password-123" }),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(createSession).toHaveBeenCalledWith(fakeKey.toString("hex"))
    expect(startScheduler).toHaveBeenCalledWith(fakeKey)
  })

  it("returns 400 when not configured", async () => {
    makeSelectChain([])

    const { POST } = await import("./login/route")
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "valid-password-123" }),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Not configured. Run setup first." })
  })

  it("returns 400 for invalid JSON", async () => {
    const fakeSettings = { id: 1, passwordHash: "hash", encryptionSalt: "salt" }
    makeSelectChain([fakeSettings])

    const { POST } = await import("./login/route")
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Invalid JSON" })
  })

  it("returns 400 when password is missing", async () => {
    const fakeSettings = { id: 1, passwordHash: "hash", encryptionSalt: "salt" }
    makeSelectChain([fakeSettings])

    const { POST } = await import("./login/route")
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Invalid password" })
  })

  it("returns 400 when password is too long", async () => {
    const fakeSettings = { id: 1, passwordHash: "hash", encryptionSalt: "salt" }
    makeSelectChain([fakeSettings])

    const { POST } = await import("./login/route")
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "a".repeat(129) }),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Invalid password" })
  })

  it("returns 401 for wrong password", async () => {
    const fakeSettings = { id: 1, passwordHash: "hash", encryptionSalt: "salt" }
    makeSelectChain([fakeSettings])
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const { POST } = await import("./login/route")
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong-password-here" }),
    })
    const response = await POST(req)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: "Invalid password" })
  })
})

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("calls stopScheduler and clearSession and returns 200", async () => {
    ;(stopScheduler as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    ;(clearSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const { POST } = await import("./logout/route")
    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(stopScheduler).toHaveBeenCalledOnce()
    expect(clearSession).toHaveBeenCalledOnce()
  })
})

describe("GET /api/auth/status", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns configured false and authenticated false when neither is set", async () => {
    makeSelectChain([])
    ;(getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { GET } = await import("./status/route")
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ configured: false, authenticated: false })
  })

  it("returns configured true and authenticated false when configured but no session", async () => {
    makeSelectChain([{ id: 1, passwordHash: "hash", encryptionSalt: "salt" }])
    ;(getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { GET } = await import("./status/route")
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ configured: true, authenticated: false })
  })

  it("returns configured true and authenticated true when both are set", async () => {
    makeSelectChain([{ id: 1, passwordHash: "hash", encryptionSalt: "salt" }])
    ;(getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "abc123" })

    const { GET } = await import("./status/route")
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ configured: true, authenticated: true })
  })
})
