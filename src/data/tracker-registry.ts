// src/data/tracker-registry.ts

import type { PlatformType } from "@/lib/adapters/constants"
import type { GazelleAuthStyle, Unit3dAuthStyle } from "@/lib/adapters/types"
import { normalizeUrl } from "@/lib/data-transforms"
import { ALL_TRACKERS } from "./trackers"

export interface ReleaseGroup {
  name: string
  description?: string
}

export type RankPerkType =
  | "download-slots"
  | "upload"
  | "invite"
  | "freeleech"
  | "double-upload"
  | "hnr-immune"
  | "mod-bypass"
  | "custom"

export interface RankPerk {
  type: RankPerkType
  label: string
}

export interface TrackerUserClass {
  name: string
  requirements?: string
  perks?: RankPerk[]
  icon?: string
}

export interface TrackerRules {
  minimumRatio: number // 0 = no minimum
  seedTimeHours: number // 0 = no minimum
  loginIntervalDays: number // days until prune/disable
  fulfillmentPeriodHours?: number // null = not applicable
  hnrBanLimit?: number // null = not applicable
  fullRulesMarkdown?: string[]
}

export interface TrackerRegistryEntry {
  slug: string
  name: string
  abbreviation?: string
  url: string
  description: string
  platform: PlatformType
  apiPath: string
  specialty: string
  contentCategories: string[]
  userClasses: TrackerUserClass[]
  releaseGroups: (string | ReleaseGroup)[]
  notableMembers: string[]
  bannedGroups?: string[]
  stats?: {
    userCount?: number
    activeUsers?: number
    torrentCount?: number
    seedSize?: string
    statsUpdatedAt?: string
  }
  rules?: TrackerRules
  language?: string
  color: string
  logo?: string
  trackerHubSlug?: string
  statusPageUrl?: string
  draft?: boolean
  warning?: boolean
  warningNote?: string
  supportsTransitPapers?: boolean
  profileUrlPattern?: string
  gazelleAuthStyle?: GazelleAuthStyle
  gazelleEnrich?: boolean
  unit3dAuthStyle?: Unit3dAuthStyle
}

export const TRACKER_REGISTRY: TrackerRegistryEntry[] = ALL_TRACKERS.filter((t) => !t.draft)

export function getTrackerBySlug(slug: string): TrackerRegistryEntry | undefined {
  return TRACKER_REGISTRY.find((t) => t.slug === slug)
}

export function getAllTrackers(): TrackerRegistryEntry[] {
  return TRACKER_REGISTRY
}

export function findRegistryEntry(baseUrl: string): TrackerRegistryEntry | undefined {
  const normalized = normalizeUrl(baseUrl)
  return TRACKER_REGISTRY.find((r) => normalizeUrl(r.url) === normalized)
}
