// src/app/api/settings/reset-stats/reset-stats.test.ts

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { POST } from "./route"

vi.mock("@/lib/api-helpers", () => ({
  authenticate: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    delete: vi.fn(),
    update: vi.fn(),
  },
}))

const VALID_KEY = "abcd1234".repeat(8)

describe("POST /api/settings/reset-stats", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const res = await POST()
    expect(res.status).toBe(401)
  })

  it("deletes all snapshots and resets tracker poll state", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })

    const mockWhere = vi.fn().mockResolvedValue(undefined)
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })

    ;(db.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    const res = await POST()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    // Should delete from both snapshot tables
    expect(db.delete).toHaveBeenCalledTimes(2)

    // Should update trackers to clear lastPolledAt/lastError (full-table, no .where())
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledWith({
      lastPolledAt: null,
      lastError: null,
    })
    expect(mockWhere).not.toHaveBeenCalled()
  })
})
