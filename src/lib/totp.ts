// src/lib/totp.ts
//
// Functions: generateTotpSecret, verifyTotpCode, generateBackupCodes, hashBackupCode, verifyAndConsumeBackupCode
// Constants: BACKUP_CODE_PATTERN

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { Secret, TOTP } from "otpauth"

const ISSUER = "Tracker Tracker"
const TOTP_PERIOD = 30
const TOTP_DIGITS = 6
const TOTP_ALGORITHM = "SHA1"
const BACKUP_CODE_COUNT = 8
const BACKUP_CODE_LENGTH = 8

export const BACKUP_CODE_PATTERN = /^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$/

export interface BackupCodeEntry {
  hash: string
  salt: string
  used: boolean
}

export function generateTotpSecret(accountName: string): { secret: string; uri: string } {
  const totp = new TOTP({
    issuer: ISSUER,
    label: accountName,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: new Secret(),
  })

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  }
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(secret),
  })

  // Allow ±1 window (previous, current, next period)
  const delta = totp.validate({ token: code, window: 1 })
  return delta !== null
}

export function generateBackupCodes(): string[] {
  const codes: string[] = []
  const byteCount = BACKUP_CODE_LENGTH / 2
  const half = BACKUP_CODE_LENGTH / 2
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Generate hex characters, format as XXXX-XXXX
    const raw = randomBytes(byteCount).toString("hex").toUpperCase()
    codes.push(`${raw.slice(0, half)}-${raw.slice(half, BACKUP_CODE_LENGTH)}`)
  }
  return codes
}

export function hashBackupCode(code: string): BackupCodeEntry {
  const normalized = code.replace(/-/g, "").toUpperCase()
  const salt = randomBytes(16).toString("hex")
  const hash = createHash("sha256")
    .update(normalized + salt)
    .digest("hex")
  return { hash, salt, used: false }
}

export function verifyAndConsumeBackupCode(
  code: string,
  entries: BackupCodeEntry[]
): { valid: boolean; updatedEntries: BackupCodeEntry[] } {
  const normalized = code.replace(/-/g, "").toUpperCase()

  for (let i = 0; i < entries.length; i++) {
    if (entries[i].used) continue

    const candidate = createHash("sha256")
      .update(normalized + entries[i].salt)
      .digest("hex")

    const a = Buffer.from(candidate, "hex")
    const b = Buffer.from(entries[i].hash, "hex")
    if (a.length === b.length && timingSafeEqual(a, b)) {
      const updatedEntries = entries.map((entry, idx) =>
        idx === i ? { ...entry, used: true } : entry
      )
      return { valid: true, updatedEntries }
    }
  }

  return { valid: false, updatedEntries: entries }
}
