// src/lib/__tests__/client-decrypt.test.ts

import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((val: string) => `decrypted:${val}`),
}))

import { decrypt } from "@/lib/crypto"
import { isDecryptionError } from "@/lib/error-utils"

const { decryptClientCredentials } = await import("@/lib/client-decrypt")

describe("decryptClientCredentials", () => {
  it("returns decrypted username and password", () => {
    const client = { name: "Test", encryptedUsername: "enc-user", encryptedPassword: "enc-pass" }
    const key = Buffer.from("a".repeat(64), "hex")
    const result = decryptClientCredentials(client, key)
    expect(result).toEqual({ username: "decrypted:enc-user", password: "decrypted:enc-pass" })
  })

  it("throws an error that isDecryptionError() recognises when decrypt throws a crypto error", () => {
    // "bad decrypt" matches the /bad\s*decrypt/i pattern in isDecryptionError
    ;(decrypt as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("bad decrypt")
    })
    const client = { name: "MyClient", encryptedUsername: "x", encryptedPassword: "y" }
    let thrown: unknown
    expect(() => {
      try {
        decryptClientCredentials(client, Buffer.alloc(32))
      } catch (err) {
        thrown = err
        throw err
      }
    }).toThrow()
    expect(isDecryptionError(thrown)).toBe(true)
  })

  it("throws an error that isDecryptionError() does NOT recognise for non-crypto failures", () => {
    // "bad key" does not match any pattern in isDecryptionError
    ;(decrypt as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("bad key")
    })
    const client = { name: "MyClient", encryptedUsername: "x", encryptedPassword: "y" }
    let thrown: unknown
    expect(() => {
      try {
        decryptClientCredentials(client, Buffer.alloc(32))
      } catch (err) {
        thrown = err
        throw err
      }
    }).toThrow(/Failed to read credentials for client "MyClient"/)
    expect(isDecryptionError(thrown)).toBe(false)
  })
})
