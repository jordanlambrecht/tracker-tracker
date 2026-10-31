// src/app/api/settings/reset-stats/reset-stats.test.ts

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { verifyPassword } from "@/lib/auth"
import { db } from "@/lib/db"
import { UNLINKED_RESTORE_ERROR } from "@/lib/tracker-status"
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
  // Column tokens are the row keys applyUpdates reads.
  trackers: { lastError: "lastError" },
}))

vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  ne: (column: unknown, value: unknown) => ({ ne: [column, value] }),
}))

const VALID_KEY = "abcd1234".repeat(8)

function makeRequest() {
  return new Request("http://localhost/api/settings/reset-stats", { method: "POST" })
}

interface TrackerUpdate {
  values: Record<string, unknown>
  where?: { ne: [string, unknown] }
}

/** Runs the route's transaction against a tx double and records its tracker updates. */
function mockResetTransaction() {
  const deletes: unknown[] = []
  const updates: TrackerUpdate[] = []
  const tx = {
    delete: vi.fn((table: unknown) => {
      deletes.push(table)
      return Promise.resolve(undefined)
    }),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        const update: TrackerUpdate = { values }
        updates.push(update)
        return Object.assign(Promise.resolve(undefined), {
          where: (where: TrackerUpdate["where"]) => {
            update.where = where
            return Promise.resolve(undefined)
          },
        })
      },
    })),
  }
  ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)
  )
  return { deletes, updates }
}

/** Applies the updates to rows as Postgres would, where NULL <> x matches nothing. */
function applyUpdates(updates: TrackerUpdate[], rows: Record<string, unknown>[]) {
  for (const { values, where } of updates) {
    for (const row of rows) {
      const matches =
        where === undefined || (row[where.ne[0]] !== null && row[where.ne[0]] !== where.ne[1])
      if (matches) Object.assign(row, values)
    }
  }
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

    const { deletes, updates } = mockResetTransaction()

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(deletes).toHaveLength(2)
    const row = { lastPolledAt: new Date(), lastError: "HTTP 503" }
    applyUpdates(updates, [row])
    expect(row).toEqual({ lastPolledAt: null, lastError: null })
  })

  // Without its marker, a restore-paused tracker reads as an ordinary failure
  // pause, and a manual poll would send its token to the backup's address.
  it("keeps the restore marker on a restore-paused tracker", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: VALID_KEY })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ password: "correct" })
    mockSelectSettings({ id: 1, passwordHash: "hash" })
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    const { updates } = mockResetTransaction()

    expect((await POST(makeRequest())).status).toBe(200)

    const restored = { lastPolledAt: new Date(), lastError: UNLINKED_RESTORE_ERROR }
    const failing = { lastPolledAt: new Date(), lastError: "HTTP 503" }
    applyUpdates(updates, [restored, failing])
    expect(restored).toEqual({ lastPolledAt: null, lastError: UNLINKED_RESTORE_ERROR })
    expect(failing).toEqual({ lastPolledAt: null, lastError: null })
  })
})
