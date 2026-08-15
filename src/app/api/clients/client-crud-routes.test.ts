// src/app/api/clients/client-crud-routes.test.ts
//
// Covers POST /api/clients and PATCH /api/clients/[id], focused on the
// authMethod (password vs apikey) validation and credential-encryption paths.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { PATCH } from "./[id]/route"
import { POST } from "./route"

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}))

const VALID_KEY = "abcd1234".repeat(8) // 64-char hex = 32-byte key

function mockPostTransaction(returning: unknown) {
  const mockReturning = vi.fn().mockResolvedValue(returning)
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
  const tx = {
    update: vi.fn().mockReturnValue({ set: vi.fn().mockResolvedValue(undefined) }),
    insert: vi.fn().mockReturnValue({ values: mockValues }),
  }
  ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)
  )
  return { tx, mockValues }
}

function mockPatchDbCalls(existingClient: { id: number } | null) {
  const mockLimit = vi.fn().mockResolvedValue(existingClient ? [existingClient] : [])
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

  const tx = {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
  }
  ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)
  )
  return { tx }
}

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makePatchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/clients/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/clients — authMethod", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: VALID_KEY })
  })

  it("defaults to password auth and requires username+password", async () => {
    const response = await POST(makePostRequest({ name: "Home qBT", host: "localhost" }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/username and password are required/i)
  })

  it("rejects an unknown authMethod value", async () => {
    const response = await POST(
      makePostRequest({
        name: "Home qBT",
        host: "localhost",
        authMethod: "carrier-pigeon",
        username: "admin",
        password: "pass",
      })
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/authMethod must be one of/i)
  })

  it("requires apiKey when authMethod is apikey", async () => {
    const response = await POST(
      makePostRequest({ name: "Home qBT", host: "localhost", authMethod: "apikey" })
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/apiKey is required/i)
  })

  it("creates a password-auth client without requiring apiKey", async () => {
    mockPostTransaction([{ id: 1, name: "Home qBT" }])

    const response = await POST(
      makePostRequest({
        name: "Home qBT",
        host: "localhost",
        authMethod: "password",
        username: "admin",
        password: "secret",
      })
    )

    expect(response.status).toBe(201)
  })

  it("creates an apikey-auth client, encrypting the key into encryptedPassword", async () => {
    const { mockValues } = mockPostTransaction([{ id: 2, name: "Home qBT" }])

    const response = await POST(
      makePostRequest({
        name: "Home qBT",
        host: "localhost",
        authMethod: "apikey",
        apiKey: "qbt_abcdefghijklmnopqrstuvwxyz01",
      })
    )

    expect(response.status).toBe(201)
    const insertedValues = mockValues.mock.calls[0][0]
    expect(insertedValues.authMethod).toBe("apikey")
    // encryptedUsername/encryptedPassword are ciphertext (never plaintext), but
    // must both be present — apikey mode still populates both notNull columns.
    expect(typeof insertedValues.encryptedUsername).toBe("string")
    expect(typeof insertedValues.encryptedPassword).toBe("string")
    expect(insertedValues.encryptedPassword).not.toContain("qbt_abcdefghijklmnopqrstuvwxyz01")
  })
})

describe("PATCH /api/clients/[id] — authMethod", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: VALID_KEY })
  })

  function patchParams() {
    return Promise.resolve({ id: "1" })
  }

  it("rejects an unknown authMethod value", async () => {
    mockPatchDbCalls({ id: 1 })

    const response = await PATCH(makePatchRequest({ authMethod: "carrier-pigeon" }), {
      params: patchParams(),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/authMethod must be one of/i)
  })

  it("switching to apikey via apiKey field sets authMethod even without an explicit authMethod field", async () => {
    const { tx } = mockPatchDbCalls({ id: 1 })

    const response = await PATCH(makePatchRequest({ apiKey: "qbt_newkeyvalue0123456789abcd" }), {
      params: patchParams(),
    })

    expect(response.status).toBe(200)
    const setCall = (tx.update("").set as ReturnType<typeof vi.fn>).mock.calls
    // Last call is the real update (first, if isDefault, would be a separate reset-default call)
    const updates = setCall[setCall.length - 1][0]
    expect(updates.authMethod).toBe("apikey")
    expect(typeof updates.encryptedPassword).toBe("string")
    expect(updates.encryptedPassword).not.toContain("qbt_newkeyvalue0123456789abcd")
  })

  it("switching credentials via username/password sets authMethod to password", async () => {
    const { tx } = mockPatchDbCalls({ id: 1 })

    const response = await PATCH(
      makePatchRequest({ username: "admin", password: "newpass" }),
      { params: patchParams() }
    )

    expect(response.status).toBe(200)
    const setCall = (tx.update("").set as ReturnType<typeof vi.fn>).mock.calls
    const updates = setCall[setCall.length - 1][0]
    expect(updates.authMethod).toBe("password")
  })
})
