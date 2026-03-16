// src/lib/__tests__/client-decrypt.test.ts

import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((val: string) => `decrypted:${val}`),
}))

import { decrypt } from "@/lib/crypto"
const { decryptClientCredentials } = await import("@/lib/client-decrypt")

describe("decryptClientCredentials", () => {
  it("returns decrypted username and password", () => {
    const client = { name: "Test", encryptedUsername: "enc-user", encryptedPassword: "enc-pass" }
    const key = Buffer.from("a".repeat(64), "hex")
    const result = decryptClientCredentials(client, key)
    expect(result).toEqual({ username: "decrypted:enc-user", password: "decrypted:enc-pass" })
  })

  it("throws descriptive error when decrypt fails", () => {
    ;(decrypt as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("bad key")
    })
    const client = { name: "MyClient", encryptedUsername: "x", encryptedPassword: "y" }
    expect(() => decryptClientCredentials(client, Buffer.alloc(32))).toThrow(
      'Credentials are missing or invalid for client "MyClient"'
    )
  })
})
