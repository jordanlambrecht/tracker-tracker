// src/lib/scheduler-key-store.ts
//
// Functions: persistSchedulerKey, loadSchedulerKey, clearSchedulerKey

import "server-only"

import { eq } from "drizzle-orm"

import { decrypt, deriveWrappingKey, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { log } from "@/lib/logger"

/**
 * Encrypt the scheduler key with the HKDF-derived wrapping key
 * and store it in appSettings. Called after successful login.
 */
export async function persistSchedulerKey(key: Buffer, settingsId: number): Promise<void> {
  try {
    const wrappingKey = deriveWrappingKey()
    const wrapped = encrypt(key.toString("hex"), wrappingKey)
    await db
      .update(appSettings)
      .set({ encryptedSchedulerKey: wrapped })
      .where(eq(appSettings.id, settingsId))
  } catch (err) {
    log.warn({ err }, "Failed to persist scheduler key — polling will not survive restart")
  }
}

/**
 * Read and decrypt the stored scheduler key. Returns null if:
 * - No settings row exists
 * - No key is stored (first boot or post-nuke/lockdown)
 * - Decryption fails (SESSION_SECRET rotated or corrupt data)
 */
export async function loadSchedulerKey(): Promise<Buffer | null> {
  try {
    const [settings] = await db
      .select({
        encryptedSchedulerKey: appSettings.encryptedSchedulerKey,
      })
      .from(appSettings)
      .limit(1)

    if (!settings?.encryptedSchedulerKey) return null

    const wrappingKey = deriveWrappingKey()
    const keyHex = decrypt(settings.encryptedSchedulerKey, wrappingKey)
    return Buffer.from(keyHex, "hex")
  } catch (err) {
    log.warn({ err }, "Could not unwrap scheduler key — will start after next login")
    return null
  }
}

/**
 * Clear the stored key from the DB. Called on lockdown, nuke,
 * password change, and restore. NOT called on logout — scheduler
 * persists through logout.
 */
export async function clearSchedulerKey(settingsId: number): Promise<void> {
  try {
    await db
      .update(appSettings)
      .set({ encryptedSchedulerKey: null })
      .where(eq(appSettings.id, settingsId))
  } catch (err) {
    log.warn({ err }, "Failed to clear scheduler key from DB")
  }
}
