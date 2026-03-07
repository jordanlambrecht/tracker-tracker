// src/lib/crypto.ts
//
// Functions: deriveKey, encrypt, decrypt, generateSalt
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"

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

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
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

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

export function generateSalt(): string {
  return randomBytes(32).toString("hex")
}
