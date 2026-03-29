// src/lib/notifications/decrypt.ts
import "server-only"

import { decrypt } from "@/lib/crypto"
import { isNotificationConfig } from "@/lib/notifications/types"
import type { NotificationConfig } from "@/lib/notifications/types"

export function decryptNotificationConfig(
  target: { name: string; encryptedConfig: string },
  key: Buffer
): NotificationConfig {
  let parsed: unknown
  try {
    const json = decrypt(target.encryptedConfig, key)
    parsed = JSON.parse(json)
  } catch {
    // never surface raw crypto or parse error details
    throw new Error(`Config is missing or invalid for notification target "${target.name}"`)
  }
  if (!isNotificationConfig(parsed)) {
    throw new Error(`Config is missing or invalid for notification target "${target.name}"`)
  }
  return parsed
}
