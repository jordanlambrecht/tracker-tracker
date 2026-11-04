// src/lib/__tests__/privacy-db.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(),
  },
}))

import { scrubSnapshotUsernames } from "../privacy-db"

const { db } = await import("@/lib/db")

// What postgres.js resolves an UPDATE with: the rows, none without RETURNING,
// and the changed-row count from the command tag as `count`.
function updateResult(count: number) {
  return Object.assign([], { command: "UPDATE", count })
}

describe("scrubSnapshotUsernames", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the number of rows the batch UPDATE changed", async () => {
    vi.mocked(db.execute).mockResolvedValue(updateResult(5) as never)

    const count = await scrubSnapshotUsernames()

    expect(db.execute).toHaveBeenCalledTimes(1)
    expect(count).toBe(5)
  })

  it("returns 0 when no rows match", async () => {
    vi.mocked(db.execute).mockResolvedValue(updateResult(0) as never)

    const count = await scrubSnapshotUsernames()

    expect(count).toBe(0)
  })
})
