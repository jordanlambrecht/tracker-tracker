// src/lib/__tests__/privacy-db.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(),
  },
}))

import { scrubSnapshotUsernames } from "../privacy-db"

const { db } = await import("@/lib/db")

describe("scrubSnapshotUsernames", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("executes a batch UPDATE query", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rowCount: 5 } as never)

    const count = await scrubSnapshotUsernames()

    expect(db.execute).toHaveBeenCalledTimes(1)
    expect(count).toBe(5)
  })

  it("returns 0 when no rows match", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rowCount: 0 } as never)

    const count = await scrubSnapshotUsernames()

    expect(count).toBe(0)
  })

  it("returns 0 when rowCount is undefined", async () => {
    vi.mocked(db.execute).mockResolvedValue({} as never)

    const count = await scrubSnapshotUsernames()

    expect(count).toBe(0)
  })
})
