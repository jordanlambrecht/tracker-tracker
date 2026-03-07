// src/lib/crypto.test.ts
import { describe, expect, it } from "vitest"
import { decrypt, deriveKey, encrypt, generateSalt } from "./crypto"

describe("generateSalt", () => {
  it("produces a hex string", () => {
    const salt = generateSalt()
    expect(salt).toMatch(/^[0-9a-f]+$/)
  })

  it("produces unique salts", () => {
    const salt1 = generateSalt()
    const salt2 = generateSalt()
    expect(salt1).not.toBe(salt2)
  })

  it("produces salt of sufficient length (32 bytes = 64 hex chars)", () => {
    const salt = generateSalt()
    expect(salt.length).toBe(64)
  })
})

describe("deriveKey", () => {
  it("derives a consistent key from password and salt", async () => {
    const salt = "test-salt-value"
    const key1 = await deriveKey("my-password", salt)
    const key2 = await deriveKey("my-password", salt)
    expect(Buffer.from(key1).toString("hex")).toBe(Buffer.from(key2).toString("hex"))
  })

  it("derives different keys for different passwords", async () => {
    const salt = "test-salt-value"
    const key1 = await deriveKey("password-a", salt)
    const key2 = await deriveKey("password-b", salt)
    expect(Buffer.from(key1).toString("hex")).not.toBe(Buffer.from(key2).toString("hex"))
  })

  it("derives different keys for different salts", async () => {
    const key1 = await deriveKey("same-password", "salt-a")
    const key2 = await deriveKey("same-password", "salt-b")
    expect(Buffer.from(key1).toString("hex")).not.toBe(Buffer.from(key2).toString("hex"))
  })

  it("produces a 32-byte key (256 bits for AES-256)", async () => {
    const key = await deriveKey("test", "salt")
    expect(key.length).toBe(32)
  })
})

describe("encrypt + decrypt", () => {
  it("round-trips a plaintext value", async () => {
    const key = await deriveKey("test-password", "test-salt")
    const plaintext = "my-secret-api-token-12345"
    const encrypted = encrypt(plaintext, key)
    const decrypted = decrypt(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  it("produces different ciphertexts for same input (random IV)", async () => {
    const key = await deriveKey("test-password", "test-salt")
    const plaintext = "same-token"
    const a = encrypt(plaintext, key)
    const b = encrypt(plaintext, key)
    expect(a).not.toBe(b)
  })

  it("fails to decrypt with wrong key", async () => {
    const key1 = await deriveKey("password-a", "salt")
    const key2 = await deriveKey("password-b", "salt")
    const encrypted = encrypt("secret", key1)
    expect(() => decrypt(encrypted, key2)).toThrow()
  })

  it("handles long API tokens", async () => {
    const key = await deriveKey("test", "salt")
    const longToken = "a".repeat(1000)
    const encrypted = encrypt(longToken, key)
    expect(decrypt(encrypted, key)).toBe(longToken)
  })

  it("handles special characters in plaintext", async () => {
    const key = await deriveKey("test", "salt")
    const specialChars = "token/with=special+chars&more!@#$%"
    const encrypted = encrypt(specialChars, key)
    expect(decrypt(encrypted, key)).toBe(specialChars)
  })
})

describe("crypto - security", () => {
  it("encrypted output is not plaintext or simple base64 of input", async () => {
    const key = await deriveKey("test", "salt")
    const plaintext = "my-api-token"
    const encrypted = encrypt(plaintext, key)

    // Encrypted output should not contain the plaintext
    expect(encrypted).not.toContain(plaintext)

    // Decoding the base64 should not reveal plaintext directly
    const decoded = Buffer.from(encrypted, "base64").toString("utf8")
    expect(decoded).not.toContain(plaintext)
  })

  it("ciphertext includes IV and auth tag (not just encrypted data)", async () => {
    const key = await deriveKey("test", "salt")
    const encrypted = encrypt("short", key)
    const decoded = Buffer.from(encrypted, "base64")

    // Should be at least IV (12) + auth tag (16) + 1 byte of ciphertext = 29 bytes
    expect(decoded.length).toBeGreaterThanOrEqual(29)
  })

  it("tampered ciphertext fails to decrypt", async () => {
    const key = await deriveKey("test", "salt")
    const encrypted = encrypt("secret", key)

    // Flip a byte in the middle of the ciphertext
    const buf = Buffer.from(encrypted, "base64")
    buf[20] = buf[20] ^ 0xff
    const tampered = buf.toString("base64")

    expect(() => decrypt(tampered, key)).toThrow()
  })

  it("truncated ciphertext fails to decrypt", async () => {
    const key = await deriveKey("test", "salt")
    const encrypted = encrypt("secret", key)

    // Truncate the base64 string
    const truncated = encrypted.slice(0, encrypted.length - 10)

    expect(() => decrypt(truncated, key)).toThrow()
  })
})
