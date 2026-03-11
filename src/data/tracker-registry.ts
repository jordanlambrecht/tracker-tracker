// src/data/tracker-registry.ts
//
// Exports: TrackerUserClass, TrackerRules, TrackerRegistryEntry, TRACKER_REGISTRY, getTrackerBySlug, getAllTrackers, findRegistryEntry
//
// Type definitions and public API for the tracker registry.
// Individual tracker data lives in src/data/trackers/.

import { ALL_TRACKERS } from "./trackers"

export interface ReleaseGroup {
  name: string
  description?: string
}

export interface TrackerUserClass {
  name: string
  requirements?: string
}

export interface TrackerRules {
  minimumRatio: number              // 0 = no minimum
  seedTimeHours: number             // 0 = no minimum
  loginIntervalDays: number         // days until prune/disable
  fulfillmentPeriodHours?: number   // null = not applicable
  hnrBanLimit?: number              // null = not applicable
  fullRulesMarkdown?: string
}

export interface TrackerRegistryEntry {
  slug: string
  name: string
  abbreviation?: string
  url: string
  description: string
  platform: "unit3d" | "gazelle" | "ggn" | "custom"
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
  gazelleAuthStyle?: "token" | "raw"
  gazelleEnrich?: boolean
}

export const TRACKER_REGISTRY: TrackerRegistryEntry[] = ALL_TRACKERS.filter((t) => !t.draft)

export function getTrackerBySlug(slug: string): TrackerRegistryEntry | undefined {
  return TRACKER_REGISTRY.find((t) => t.slug === slug)
}

export function getAllTrackers(): TrackerRegistryEntry[] {
  return TRACKER_REGISTRY
}

export function findRegistryEntry(baseUrl: string): TrackerRegistryEntry | undefined {
  const normalized = baseUrl.replace(/\/+$/, "").toLowerCase()
  return TRACKER_REGISTRY.find(
    (r) => r.url.replace(/\/+$/, "").toLowerCase() === normalized
  )
}
