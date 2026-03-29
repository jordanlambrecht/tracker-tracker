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

export interface SnapshotContext {
  trackerId: number
  trackerName: string
  storeUsernames: boolean
  currentRatio: number | null
  previousRatio: number | null
  currentHnrs: number | null
  previousHnrs: number | null
  currentBufferBytes: bigint | null
  previousBufferBytes: bigint | null
  trackerDown: boolean
  trackerError: string | null
  currentWarned: boolean | null
  previousWarned: boolean | null
  currentSeedingCount: number | null
  currentGroup: string | null
  previousGroup: string | null
  trackerIsActive: boolean
  trackerPausedAt: string | null
  trackerJoinedAt: string | null
  minimumRatio: number | undefined
  // MAM-specific fields grouped into sub-object; undefined for non-MAM trackers
  mamContext?: {
    currentSeedbonus: number | null
    previousSeedbonus: number | null
    vipUntil: string | null
    unsatisfiedCount: number | null
    unsatisfiedLimit: number | null
    inactiveHnrCount: number | null
    previousInactiveHnrCount: number | null
  }
}

/** Safely parse JSONB thresholds with runtime field validation */
export function parseThresholds(raw: unknown): NotificationThresholds {
  if (!raw || typeof raw !== "object") return {}
  const r = raw as Record<string, unknown>
  return {
    ...(typeof r.ratioDropDelta === "number" ? { ratioDropDelta: r.ratioDropDelta } : {}),
    ...(typeof r.bufferMilestoneBytes === "number"
      ? { bufferMilestoneBytes: r.bufferMilestoneBytes }
      : {}),
    ...(typeof r.bonusCapLimit === "number" ? { bonusCapLimit: r.bonusCapLimit } : {}),
    ...(typeof r.vipExpiringDays === "number" ? { vipExpiringDays: r.vipExpiringDays } : {}),
    ...(typeof r.unsatisfiedLimitPercent === "number"
      ? { unsatisfiedLimitPercent: r.unsatisfiedLimitPercent }
      : {}),
  }
}

// Type guards — validates shape only. Callers must also check target.type
// since DiscordConfig and SlackConfig share the same { webhookUrl } shape.
export function isDiscordConfig(config: NotificationConfig): config is DiscordConfig {
  return "webhookUrl" in config && typeof config.webhookUrl === "string"
}

export function isNotificationConfig(value: unknown): value is NotificationConfig {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  if (typeof obj.webhookUrl === "string") return true
  if (typeof obj.serverUrl === "string" && typeof obj.appToken === "string") return true
  if (typeof obj.botToken === "string" && typeof obj.chatId === "string") return true
  if (
    typeof obj.host === "string" &&
    typeof obj.port === "number" &&
    typeof obj.from === "string" &&
    typeof obj.to === "string"
  )
    return true
  return false
}

// Discord webhook URL pattern
export const DISCORD_WEBHOOK_RE = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/
