// src/lib/auth.ts
//
// Functions: hashPassword, verifyPassword, createSession, getSession, clearSession, requireAuth
import argon2 from "argon2"
import { jwtVerify, SignJWT } from "jose"
import { cookies } from "next/headers"

const SESSION_COOKIE = "tt_session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set")
  return new TextEncoder().encode(secret)
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

export async function createSession(encryptionKey: string): Promise<string> {
  const token = await new SignJWT({ ek: encryptionKey })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSessionSecret())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  })

  return token
}

export async function getSession(): Promise<{ encryptionKey: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    return { encryptionKey: payload.ek as string }
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function requireAuth(): Promise<{ encryptionKey: string }> {
  const session = await getSession()
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}
