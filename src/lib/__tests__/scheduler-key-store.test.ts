// src/lib/__tests__/scheduler-key-store.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: { id: "id", encryptedSchedulerKey: "encrypted_scheduler_key" },
}))

// Mock SESSION_SECRET
const MOCK_SECRET = "a]".repeat(24) // 48 chars, well above 32 min
vi.stubEnv("SESSION_SECRET", MOCK_SECRET)

import { db } from "@/lib/db"
import { clearSchedulerKey, loadSchedulerKey, persistSchedulerKey } from "@/lib/scheduler-key-store"

const mockSelect = db.select as ReturnType<typeof vi.fn>
const mockUpdate = db.update as ReturnType<typeof vi.fn>

function mockDbChain(returnValue: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
  }
}

describe("scheduler-key-store", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("persistSchedulerKey", () => {
    it("encrypts and stores the key in the DB", async () => {
      const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) }
      mockUpdate.mockReturnValue(chain)

      const key = Buffer.from("a]".repeat(16)) // 32 bytes
      await persistSchedulerKey(key, 1)

      expect(mockUpdate).toHaveBeenCalled()
      expect(chain.set).toHaveBeenCalled()
      const setArg = chain.set.mock.calls[0][0]
      expect(setArg.encryptedSchedulerKey).toBeDefined()
      expect(typeof setArg.encryptedSchedulerKey).toBe("string")
      expect(setArg.encryptedSchedulerKey.length).toBeGreaterThan(0)
    })

    it("does not throw when DB write fails", async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error("DB connection lost")
      })

      const key = Buffer.from("deadbeef".repeat(8), "hex")
      await expect(persistSchedulerKey(key, 1)).resolves.toBeUndefined()
    })
  })

  describe("loadSchedulerKey", () => {
    it("returns null when no key is stored", async () => {
      mockSelect.mockReturnValue(mockDbChain([{ encryptedSchedulerKey: null, id: 1 }]))
      const result = await loadSchedulerKey()
      expect(result).toBeNull()
    })

    it("returns null on decryption failure (simulates SESSION_SECRET rotation)", async () => {
      mockSelect.mockReturnValue(
        mockDbChain([{ encryptedSchedulerKey: "invalid-ciphertext", id: 1 }])
      )
      const result = await loadSchedulerKey()
      expect(result).toBeNull()
    })

    it("returns null when no settings row exists", async () => {
      mockSelect.mockReturnValue(mockDbChain([]))
      const result = await loadSchedulerKey()
      expect(result).toBeNull()
    })
  })

  describe("round-trip", () => {
    it("persisted key can be loaded back with identical bytes", async () => {
      let stored: string | null = null
      const persistChain = {
        set: vi.fn((v: { encryptedSchedulerKey: string }) => {
          stored = v.encryptedSchedulerKey
          return persistChain
        }),
        where: vi.fn().mockResolvedValue(undefined),
      }
      mockUpdate.mockReturnValue(persistChain)

      const key = Buffer.from("deadbeef".repeat(8), "hex") // 32 bytes
      await persistSchedulerKey(key, 1)

      expect(stored).not.toBeNull()

      mockSelect.mockReturnValue(mockDbChain([{ encryptedSchedulerKey: stored }]))
      const loaded = await loadSchedulerKey()

      expect(loaded).not.toBeNull()
      expect(loaded?.equals(key)).toBe(true)
    })
  })

  describe("clearSchedulerKey", () => {
    it("sets the column to null", async () => {
      const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) }
      mockUpdate.mockReturnValue(chain)

      await clearSchedulerKey(1)

      expect(chain.set).toHaveBeenCalledWith({ encryptedSchedulerKey: null })
    })

    it("does not throw when DB write fails", async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error("DB connection lost")
      })

      await expect(clearSchedulerKey(1)).resolves.toBeUndefined()
    })
  })
})
