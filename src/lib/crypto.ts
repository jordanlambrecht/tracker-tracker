// src/lib/crypto.ts
//
// Functions: deriveKey, deriveWrappingKey, encrypt, decrypt, reencrypt, generateSalt
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, scryptSync } from "node:crypto"

const KEY_LENGTH = 32 // 256 bits for AES-256
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const IV_LENGTH = 12 // 96 bits for GCM
const AUTH_TAG_LENGTH = 16

export async function deriveKey(password: string, salt: string): Promise<Buffer> {
  return scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
}

/**
 * Derive a 32-byte wrapping key from SESSION_SECRET via HKDF.
 * Used to encrypt/decrypt the scheduler key at rest in the DB.
 * Domain-separated from session JWE key via the info label.
 */
export function deriveWrappingKey(): Buffer {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters")
  }
  return Buffer.from(hkdfSync("sha256", secret, "", "tracker-tracker:scheduler-key-v1", 32))
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Format: base64(iv + authTag + ciphertext)
  const combined = Buffer.concat([iv, authTag, encrypted])
  return combined.toString("base64")
}

export function decrypt(encryptedBase64: string, key: Buffer): string {
  const combined = Buffer.from(encryptedBase64, "base64")

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid ciphertext: too short")
  }

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  return decrypted.toString("utf8")
}

/**
 * Decrypt ciphertext with oldKey and re-encrypt with newKey.
 * Throws if decryption fails (wrong key, corrupt ciphertext).
 * Callers that need silent fallback should wrap in try/catch.
 */
export function reencrypt(ciphertext: string, oldKey: Buffer, newKey: Buffer): string {
  return encrypt(decrypt(ciphertext, oldKey), newKey)
}

export function generateSalt(): string {
  return randomBytes(32).toString("hex")
}
