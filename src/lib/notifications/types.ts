// src/lib/notifications/types.ts

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
  ratioDropDelta?: number
  bufferMilestoneBytes?: number
  bonusCapLimit?: number // default 99999, used for MAM specifically
  vipExpiringDays?: number // default 7
  unsatisfiedLimitPercent?: number // default 80
}

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

// Discord webhook URL pattern
export const DISCORD_WEBHOOK_RE = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/
