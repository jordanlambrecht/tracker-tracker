// src/lib/__tests__/client-decrypt.test.ts

import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((val: string) => `decrypted:${val}`),
}))

import { decrypt } from "@/lib/crypto"
import { isDecryptionError } from "@/lib/error-utils"

const { decryptClientCredentials } = await import("@/lib/download-clients/credentials")

describe("decryptClientCredentials", () => {
  it("returns decrypted username and password", () => {
    const client = {
      name: "Test",
      authMethod: "password",
      encryptedUsername: "enc-user",
      encryptedPassword: "enc-pass",
      encryptedApiKey: "",
    }
    const key = Buffer.from("a".repeat(64), "hex")
    const result = decryptClientCredentials(client, key)
    expect(result).toEqual({
      authMethod: "password",
      username: "decrypted:enc-user",
      password: "decrypted:enc-pass",
    })
  })

  it("returns only the decrypted API key for an apikey client", () => {
    const client = {
      name: "Test",
      authMethod: "apikey",
      encryptedUsername: "enc-blank",
      encryptedPassword: "enc-blank",
      encryptedApiKey: "enc-key",
    }
    const result = decryptClientCredentials(client, Buffer.alloc(32))
    expect(result).toEqual({ authMethod: "apikey", apiKey: "decrypted:enc-key" })
  })

  it("rejects an unrecognised auth method without disguising it as a decryption failure", () => {
    const client = {
      name: "MyClient",
      authMethod: "carrier-pigeon",
      encryptedUsername: "x",
      encryptedPassword: "y",
      encryptedApiKey: "",
    }
    let thrown: unknown
    expect(() => {
      try {
        decryptClientCredentials(client, Buffer.alloc(32))
      } catch (err) {
        thrown = err
        throw err
      }
    }).toThrow(/Unsupported auth method: "carrier-pigeon"/)
    // Must not be wrapped by the credential handler — a bad column value is a
    // data problem, and reporting it as a stale key would send the user to
    // re-enter a password that was never the issue.
    expect(isDecryptionError(thrown)).toBe(false)
    expect((thrown as Error).message).not.toMatch(/Failed to read credentials/)
  })

  it("throws an error that isDecryptionError() recognises when decrypt throws a crypto error", () => {
    // "bad decrypt" matches the /bad\s*decrypt/i pattern in isDecryptionError
    ;(decrypt as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("bad decrypt")
    })
    const client = {
      name: "MyClient",
      authMethod: "password",
      encryptedUsername: "x",
      encryptedPassword: "y",
      encryptedApiKey: "",
    }
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
    const client = {
      name: "MyClient",
      authMethod: "password",
      encryptedUsername: "x",
      encryptedPassword: "y",
      encryptedApiKey: "",
    }
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
