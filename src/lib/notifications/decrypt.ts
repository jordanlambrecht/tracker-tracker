// src/lib/notifications/decrypt.ts
//
// Functions: decryptNotificationConfig

import "server-only"

import { decrypt } from "@/lib/crypto"
import type { NotificationConfig } from "@/lib/notifications/types"

export function decryptNotificationConfig(
  target: { name: string; encryptedConfig: string },
  key: Buffer
): NotificationConfig {
  try {
    const json = decrypt(target.encryptedConfig, key)
    return JSON.parse(json) as NotificationConfig
  } catch {
    throw new Error(`Config is missing or invalid for notification target "${target.name}"`)
  }
}
