// src/lib/notifications/payload.ts
//
// Functions: hexToInt, buildDiscordEmbed, buildDescription

import { CHART_THEME } from "@/components/charts/lib/theme"
import { formatBytesNum } from "@/lib/formatters"
import type { NotificationEventType } from "@/lib/notifications/types"

interface EmbedInput {
  eventType: NotificationEventType
  trackerName: string
  includeTrackerName: boolean
  storeUsernames: boolean
  data: Record<string, unknown>
}

interface DiscordEmbed {
  title: string
  description: string
  color: number
  timestamp: string
  fields?: { name: string; value: string; inline?: boolean }[]
}

// Convert "#rrggbb" hex string to Discord embed integer
function hexToInt(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16)
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
      const prev = Number(data.previousRatio ?? 0).toFixed(2)
      const curr = Number(data.currentRatio ?? 0).toFixed(2)
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
      const curr = Number(data.currentRatio ?? 0).toFixed(2)
      const min = Number(data.minimumRatio ?? 0).toFixed(2)
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
    default:
      return `${source} triggered a notification`
  }
}
