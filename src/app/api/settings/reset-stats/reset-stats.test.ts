// src/app/api/settings/reset-stats/reset-stats.test.ts

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { verifyPassword } from "@/lib/auth"
import { db } from "@/lib/db"
import { POST } from "./route"

vi.mock("@/lib/api-helpers", () => ({
  authenticate: vi.fn(),
  parseJsonBody: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  verifyPassword: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
  trackerSnapshots: {},
  clientSnapshots: {},
  trackers: {},
}))

const VALID_KEY = "abcd1234".repeat(8)

function makeRequest() {
  return new Request("http://localhost/api/settings/reset-stats", { method: "POST" })
}

function mockSelectSettings(settings: Record<string, unknown>) {
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([settings]),
    }),
  })
}

describe("POST /api/settings/reset-stats", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 400 when password is missing", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: VALID_KEY })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
  })

  it("returns 401 when password is wrong", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: VALID_KEY })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ password: "wrong" })
    mockSelectSettings({ id: 1, passwordHash: "hash" })
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it("deletes all snapshots and resets tracker poll state with valid password", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: VALID_KEY })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ password: "correct" })
    mockSelectSettings({ id: 1, passwordHash: "hash" })
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    // Mock the transaction to invoke the callback with a tx mock
    const txDeleteCalls: unknown[] = []
    const txSetCalls: unknown[] = []
    const txMock = {
      delete: vi.fn().mockImplementation((table) => {
        txDeleteCalls.push(table)
        return Promise.resolve(undefined)
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((data) => {
          txSetCalls.push(data)
          return Promise.resolve(undefined)
        }),
      }),
    }
    ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock)
    )

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(txMock.delete).toHaveBeenCalledTimes(2)
    expect(txMock.update).toHaveBeenCalledTimes(1)
    expect(txSetCalls[0]).toEqual({ lastPolledAt: null, lastError: null })
  })
})
