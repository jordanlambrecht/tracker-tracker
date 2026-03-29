// src/lib/notifications/payload.ts
//
// Functions: buildDiscordEmbed, buildDescription

import { CHART_THEME } from "@/components/charts/lib/theme"
import { hexToInt } from "@/lib/color-utils"
import { formatBytesNum, formatCount, formatPercent, formatRatio } from "@/lib/formatters"
import type { NotificationEventType } from "@/lib/notifications/types"

interface EmbedInput {
  eventType: NotificationEventType
  trackerName: string
  includeTrackerName: boolean
  storeUsernames: boolean
  data: Record<string, unknown>
}

export interface DiscordEmbed {
  title: string
  description: string
  color: number
  timestamp: string
  fields?: { name: string; value: string; inline?: boolean }[]
}

const EVENT_COLORS: Record<NotificationEventType, number> = {
  ratio_drop: hexToInt(CHART_THEME.warn),
  hit_and_run: hexToInt(CHART_THEME.danger),
  tracker_down: hexToInt(CHART_THEME.danger),
  buffer_milestone: hexToInt(CHART_THEME.success),
  warned: hexToInt(CHART_THEME.warn),
  ratio_danger: hexToInt(CHART_THEME.danger),
  zero_seeding: hexToInt(CHART_THEME.warn),
  rank_change: hexToInt(CHART_THEME.accent),
  anniversary: hexToInt(CHART_THEME.accent),
  bonus_cap: hexToInt(CHART_THEME.warn),
  vip_expiring: hexToInt(CHART_THEME.warn),
  unsatisfied_limit: hexToInt(CHART_THEME.danger),
  active_hnrs: hexToInt(CHART_THEME.danger),
  download_disabled: hexToInt(CHART_THEME.danger),
}

const EVENT_TITLES: Record<NotificationEventType, string> = {
  ratio_drop: "Ratio Drop",
  hit_and_run: "New Hit & Run",
  tracker_down: "Tracker Unreachable",
  buffer_milestone: "Buffer Milestone",
  warned: "Account Warning",
  ratio_danger: "Ratio Below Minimum",
  zero_seeding: "Zero Active Seeds",
  rank_change: "Rank Change",
  anniversary: "Membership Anniversary",
  bonus_cap: "Bonus Cap Reached",
  vip_expiring: "VIP Expiring Soon",
  unsatisfied_limit: "Unsatisfied Limit Approaching",
  active_hnrs: "New Inactive Hit & Run",
  download_disabled: "Download Privileges Revoked",
}

export function buildDiscordEmbed(input: EmbedInput): DiscordEmbed {
  const { eventType, trackerName, includeTrackerName, storeUsernames, data } = input
  const source = includeTrackerName ? trackerName : "A tracker"

  const embed: DiscordEmbed = {
    title: EVENT_TITLES[eventType] ?? eventType,
    description: buildDescription(eventType, source, storeUsernames, data),
    color: EVENT_COLORS[eventType] ?? hexToInt(CHART_THEME.textTertiary),
    timestamp: new Date().toISOString(),
  }

  return embed
}

function buildDescription(
  eventType: NotificationEventType,
  source: string,
  _storeUsernames: boolean,
  data: Record<string, unknown>
): string {
  switch (eventType) {
    case "ratio_drop": {
      const prev = formatRatio(Number(data.previousRatio ?? 0))
      const curr = formatRatio(Number(data.currentRatio ?? 0))
      return `${source} ratio dropped from **${prev}** to **${curr}**`
    }
    case "hit_and_run":
      return `${source} received a new Hit & Run`
    case "tracker_down":
      return `${source} is unreachable: ${data.error ?? "Unknown error"}`
    case "buffer_milestone": {
      const bytes = data.bufferBytes as number | undefined
      const label = bytes ? formatBytesNum(bytes) : "unknown"
      return `${source} buffer reached **${label}**`
    }
    case "warned":
      return `${source} has been issued a warning by the tracker`
    case "ratio_danger": {
      const curr = formatRatio(Number(data.currentRatio ?? 0))
      const min = formatRatio(Number(data.minimumRatio ?? 0))
      return `${source} ratio **${curr}** is below the required minimum of **${min}**`
    }
    case "zero_seeding":
      return `${source} has no active seeds`
    case "rank_change": {
      const newGroup = data.newGroup as string | undefined
      const prevGroup = data.previousGroup as string | undefined
      if (prevGroup && newGroup)
        return `${source} rank changed from **${prevGroup}** to **${newGroup}**`
      if (newGroup) return `${source} rank is now **${newGroup}**`
      return `${source} rank has changed`
    }
    case "anniversary": {
      const label = data.label as string | undefined
      return label ? `${source} — ${label}` : `${source} membership anniversary`
    }
    case "bonus_cap": {
      const current = formatCount(Number(data.currentBonus ?? 0))
      const cap = formatCount(Number(data.capLimit ?? 0))
      return `${source} bonus points at **${current}** (cap: ${cap}). Spend them before they're wasted!`
    }
    case "vip_expiring": {
      const expiry = data.vipUntil ? new Date(String(data.vipUntil)) : null
      const days = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0
      return `${source} VIP status expires in **${days} day${days !== 1 ? "s" : ""}**`
    }
    case "unsatisfied_limit": {
      const count = Number(data.count ?? 0)
      const limit = Number(data.limit ?? 0)
      const pct = limit > 0 ? Math.round((count / limit) * 100) : 0
      return `${source} unsatisfied torrents at **${count}/${limit}** (${formatPercent(pct, 0)}). Download capacity running low.`
    }
    case "active_hnrs": {
      const count = Number(data.count ?? 0)
      return `${source} has **${count}** active Hit & Run${count !== 1 ? "s" : ""}. Seed them to avoid penalties.`
    }
    case "download_disabled":
      return `${source} has lost download privileges — ratio may have dropped or account was restricted`
    default:
      return `${source} triggered a notification`
  }
}
