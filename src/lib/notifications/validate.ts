// src/lib/notifications/validate.ts
//
// Functions: validateNotificationConfig

import { isUnsafeNetworkHost } from "@/lib/network"
import {
  DISCORD_WEBHOOK_RE,
  type NotificationTargetType,
  VALID_NOTIFICATION_TYPES,
} from "@/lib/notifications/types"

/**
 * Validates a notification config object for a given type.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateNotificationConfig(
  type: NotificationTargetType,
  config: Record<string, unknown>
): string | null {
  if (!VALID_NOTIFICATION_TYPES.includes(type)) {
    return `Unsupported notification type: ${type}`
  }

  switch (type) {
    case "discord": {
      const url = config.webhookUrl
      if (typeof url !== "string" || !url.trim()) {
        return "Discord config requires a webhookUrl string"
      }
      if (!DISCORD_WEBHOOK_RE.test(url.trim())) {
        return "Invalid Discord webhook URL — must match https://discord.com/api/webhooks/{id}/{token}"
      }
      // Defense-in-depth SSRF check
      try {
        if (isUnsafeNetworkHost(new URL(url.trim()).hostname)) {
          return "Webhook URL points to a private or reserved network address"
        }
      } catch {
        return "Invalid webhook URL format"
      }
      return null
    }
    case "gotify":
    case "telegram":
    case "slack":
    case "email":
      return `${type} notifications are not yet supported`
    default:
      return `Unsupported notification type: ${type}`
  }
}
