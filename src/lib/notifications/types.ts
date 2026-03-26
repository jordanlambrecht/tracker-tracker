// src/lib/notifications/types.ts
//
// Functions: (types only — no runtime code)

export const VALID_NOTIFICATION_TYPES = ["discord", "gotify", "telegram", "slack", "email"] as const
export type NotificationTargetType = (typeof VALID_NOTIFICATION_TYPES)[number]

export const VALID_EVENT_TYPES = [
  "ratio_drop",
  "hit_and_run",
  "tracker_down",
  "buffer_milestone",
  "warned",
  "ratio_danger",
  "zero_seeding",
  "rank_change",
  "anniversary",
  "bonus_cap",
  "vip_expiring",
  "unsatisfied_limit",
  "active_hnrs",
] as const
export type NotificationEventType = (typeof VALID_EVENT_TYPES)[number]

export interface NotificationThresholds {
  ratioDropDelta?: number // i.e 0.1 — alert when ratio falls by ≥0.1
  bufferMilestoneBytes?: number //i.e 10737418240 — alert when buffer crosses 10 GiB
  bonusCapLimit?: number // default 99999 — fires when seedbonus hits or exceeds cap
  vipExpiringDays?: number // default 7 — fires when VIP expiry is within N days
  unsatisfiedLimitPercent?: number // default 80 — fires at 80% of unsatisfied limit
}

// Per-type config shapes (decrypted form — never stored plaintext)
export interface DiscordConfig {
  webhookUrl: string
}
export interface GotifyConfig {
  serverUrl: string
  appToken: string
}
export interface TelegramConfig {
  botToken: string
  chatId: string
}
export interface SlackConfig {
  webhookUrl: string
}
export interface EmailConfig {
  host: string
  port: number
  username: string
  password: string
  from: string
  to: string
}

export type NotificationConfig =
  | DiscordConfig
  | GotifyConfig
  | TelegramConfig
  | SlackConfig
  | EmailConfig

// Discord webhook URL pattern — used for validation
export const DISCORD_WEBHOOK_RE = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/
