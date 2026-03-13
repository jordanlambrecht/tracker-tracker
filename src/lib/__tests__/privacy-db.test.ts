// src/lib/__tests__/privacy-db.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    execute: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: { storeUsernames: "storeUsernames" },
}))

import { REDACTED_PREFIX } from "../privacy"
import { createPrivacyMask, scrubSnapshotUsernames } from "../privacy-db"

const { db } = await import("@/lib/db")

function mockSettingsQuery(storeUsernames: boolean) {
  const mockLimit = vi.fn().mockResolvedValue([{ storeUsernames }])
  const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit })
  vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never)
}

function mockSettingsQueryEmpty() {
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit })
  vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never)
}

describe("createPrivacyMask", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns identity-like function when privacy mode is off (storeUsernames=true)", async () => {
    mockSettingsQuery(true)
    const mask = await createPrivacyMask()
    expect(mask("JohnDoe")).toBe("JohnDoe")
  })

  it("returns masking function when privacy mode is on (storeUsernames=false)", async () => {
    mockSettingsQuery(false)
    const mask = await createPrivacyMask()
    expect(mask("JohnDoe")).toBe(`${REDACTED_PREFIX}7`)
  })

  it("mask returns null for null input", async () => {
    mockSettingsQuery(false)
    const mask = await createPrivacyMask()
    expect(mask(null)).toBeNull()
  })

  it("mask returns null for undefined input", async () => {
    mockSettingsQuery(false)
    const mask = await createPrivacyMask()
    expect(mask(undefined)).toBeNull()
  })

  it("mask passes through already-redacted values", async () => {
    mockSettingsQuery(false)
    const mask = await createPrivacyMask()
    const redacted = `${REDACTED_PREFIX}7`
    expect(mask(redacted)).toBe(redacted)
  })

  it("defaults to privacy off when no settings exist", async () => {
    mockSettingsQueryEmpty()
    const mask = await createPrivacyMask()
    expect(mask("JohnDoe")).toBe("JohnDoe")
  })
})

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
