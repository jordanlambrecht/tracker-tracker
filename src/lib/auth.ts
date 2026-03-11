// src/lib/auth.ts
//
// Functions: hashPassword, verifyPassword, createSession, getSession,
//            clearSession, requireAuth, createPendingToken, verifyPendingToken,
//            createSetupToken, verifySetupToken

import argon2 from "argon2"
import { EncryptJWT, jwtDecrypt } from "jose"
import { cookies } from "next/headers"

const SESSION_COOKIE = "tt_session"
const MAX_AGE_COOKIE = "tt_max_age"
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const PENDING_TOKEN_MAX_AGE = 60 // 60 seconds
const SETUP_TOKEN_MAX_AGE = 300 // 5 minutes

function getSessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set")
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters")
  // Use first 32 bytes as AES-256 key
  return new TextEncoder().encode(secret.slice(0, 32))
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

export async function createSession(
  encryptionKey: string,
  timeoutMinutes?: number | null
): Promise<string> {
  const cookieMaxAge = timeoutMinutes && timeoutMinutes > 0
    ? timeoutMinutes * 60
    : SESSION_MAX_AGE

  // JWE expiry is a generous safety net — the real timeout is controlled by
  // cookie maxAge + middleware sliding window refresh.
  const jweMaxAge = Math.max(cookieMaxAge * 2, SESSION_MAX_AGE)

  const token = await new EncryptJWT({ ek: encryptionKey })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${jweMaxAge}s`)
    .encrypt(getSessionKey())

  const isProduction = process.env.NODE_ENV === "production"
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: cookieMaxAge,
    path: "/",
  })

  // Companion cookie so middleware can refresh maxAge without decrypting the JWE
  cookieStore.set(MAX_AGE_COOKIE, String(cookieMaxAge), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: cookieMaxAge,
    path: "/",
  })

  return token
}

export async function getSession(): Promise<{ encryptionKey: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtDecrypt(token, getSessionKey())
    return { encryptionKey: payload.ek as string }
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete(MAX_AGE_COOKIE)
}

export async function requireAuth(): Promise<{ encryptionKey: string }> {
  const session = await getSession()
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

// ---------------------------------------------------------------------------
// Pending token — short-lived JWE holding the encryption key during 2FA login.
// Returned in the response body (NOT as a cookie) so the client holds it
// temporarily and sends it with the TOTP verification request.
// ---------------------------------------------------------------------------

export async function createPendingToken(encryptionKey: string): Promise<string> {
  return new EncryptJWT({ ek: encryptionKey, purpose: "pending" })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TOKEN_MAX_AGE}s`)
    .encrypt(getSessionKey())
}

export async function verifyPendingToken(token: string): Promise<{ encryptionKey: string } | null> {
  try {
    const { payload } = await jwtDecrypt(token, getSessionKey())
    if (payload.purpose !== "pending") return null
    return { encryptionKey: payload.ek as string }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Setup token — short-lived JWE holding the pending TOTP secret and hashed
// backup codes during enrollment. The client sends this back on confirm so
// the server can verify the TOTP code and save to DB without intermediate
// database writes.
// ---------------------------------------------------------------------------

export async function createSetupToken(
  totpSecret: string,
  backupCodesJson: string
): Promise<string> {
  return new EncryptJWT({ ts: totpSecret, bc: backupCodesJson, purpose: "setup" })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${SETUP_TOKEN_MAX_AGE}s`)
    .encrypt(getSessionKey())
}

export async function verifySetupToken(
  token: string
): Promise<{ totpSecret: string; backupCodesJson: string } | null> {
  try {
    const { payload } = await jwtDecrypt(token, getSessionKey())
    if (payload.purpose !== "setup") return null
    return {
      totpSecret: payload.ts as string,
      backupCodesJson: payload.bc as string,
    }
  } catch {
    return null
  }
}
