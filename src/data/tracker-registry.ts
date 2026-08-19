// src/data/tracker-registry.ts

import type { PlatformType } from "@/lib/adapters/constants"
import type { GazelleAuthStyle, Unit3dAuthStyle } from "@/lib/adapters/types"
import { normalizeUrl } from "@/lib/data-transforms"
import type { TrackerCredentialFieldDefinition } from "@/lib/tracker-credentials/types"
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
  /**
   * The tracker has permanently shut down. This is registry data, not adapter
   * data: a defunct tracker's API is gone, so nothing about it can be learned at
   * runtime. It has to be recorded here by hand alongside `warning`.
   */
  defunct?: boolean
  /** Short factual line about the shutdown, shown in the defunct banner. */
  defunctMessage?: string
  /** https:// link to the announcement (forum post, reddit thread, staff blog). */
  defunctLink?: string
  /**
   * Shutdown date as "YYYY-MM-DD".
   *
   * Deliberately the same shape as a tracker row's `joinedAt`, so it renders
   * through `formatJoinedDate()` ("2026-05-11" → "May 11, 2026") with no new
   * formatting code and no timezone drift. That helper parses at local
   * midnight. The free-form `stats.statsUpdatedAt` ("March 2026") is the other
   * precedent in this type, but it is an unparseable display string, and this
   * field has to be shown in a readable form, sorted on, and validated.
   *
   * Note this is authored data, never a stamped `new Date()`: the repo bans
   * `.toISOString().slice(0, 10)` for producing date strings (it silently
   * shifts the day across timezones) in favour of `localDateStr()`.
   */
  defunctDate?: string
  supportsTransitPapers?: boolean
  profileUrlPattern?: string
  gazelleAuthStyle?: GazelleAuthStyle
  gazelleEnrich?: boolean
  unit3dAuthStyle?: Unit3dAuthStyle
  /**
   * Which credential fields this tracker issues, overriding the platform defaults
   * in src/data/tracker-credential-defaults.ts. Resolve via
   * getDefaultCredentialFields(), never read directly.
   *
   * PUBLIC, GIT-COMMITTED DATA: these define which fields EXIST and must NEVER
   * hold a user's actual VALUES. TrackerCredentialFieldDefinition has no `value`
   * property precisely so a passkey cannot be pasted in here and leaked into git
   * history forever. User values live only in `trackers.encrypted_credentials`.
   */
  credentialFields?: readonly TrackerCredentialFieldDefinition[]
}

export const TRACKER_REGISTRY: TrackerRegistryEntry[] = ALL_TRACKERS.filter((t) => !t.draft)

export function getTrackerBySlug(slug: string): TrackerRegistryEntry | undefined {
  return TRACKER_REGISTRY.find((t) => t.slug === slug)
}

export function findRegistryEntry(baseUrl: string): TrackerRegistryEntry | undefined {
  const normalized = normalizeUrl(baseUrl)
  return TRACKER_REGISTRY.find((r) => normalizeUrl(r.url) === normalized)
}
