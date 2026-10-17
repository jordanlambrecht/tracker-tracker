// src/types/tracker-stats.ts
//
// What a poll returns. Declarations only. Its one import is the platform
// vocabulary, which has no imports of its own, so a React component can read
// these without pulling the adapter barrel (and with it server-only) into the
// client bundle.

import type { PlatformType } from "@/data/platform-types"

export interface TrackerStats {
  username: string
  group: string
  uploadedBytes: bigint
  downloadedBytes: bigint
  ratio: number
  bufferBytes: bigint
  // Nullable: some platforms (i.e. BTN) don't report these at all. The DB
  // columns and the charts already treat them as optional, null means
  // "unknown", which must stay distinguishable from a measured 0.
  seedingCount: number | null
  leechingCount: number | null
  seedbonus: number | null
  hitAndRuns: number | null
  requiredRatio: number | null
  warned: boolean | null
  freeleechTokens: number | null
  remoteUserId?: number
  joinedDate?: string
  lastAccessDate?: string
  shareScore?: number
  avatarUrl?: string
  // Declared once, below, so a new meta type cannot be added to one list and
  // missed in another.
  platformMeta?: PlatformMeta
}

export interface GGnPlatformMeta {
  achievements?: {
    userLevel: string
    nextLevel: string
    totalPoints: number
    pointsToNextLvl: number
  }
  buffs?: Record<string, number>
  donor?: boolean
  parked?: boolean
  enabled?: boolean
  invites?: number
  onIRC?: boolean
  hourlyGold?: number
  snatched?: number
  uniqueSnatched?: number
}

export interface GazelleRanks {
  uploaded: number
  downloaded: number
  uploads: number
  requests: number
  bounty: number
  posts: number
  artists: number
  overall: number
}

export interface GazelleCommunity {
  posts: number
  torrentComments: number
  // Optional because some Gazelle builds omit them, and a 0 would read as a
  // measured count.
  artistComments?: number
  collageComments?: number
  requestComments?: number
  collagesStarted: number
  collagesContrib: number
  requestsFilled: number
  requestsVoted: number
  perfectFlacs: number
  uploaded: number
  groups: number
  snatched: number
  invited: number
  bountyEarned: number | null
  bountySpent: number | null
}

export interface GazellePlatformMeta {
  donor?: boolean
  enabled?: boolean
  paranoia?: number
  paranoiaText?: string
  ranks?: GazelleRanks
  community?: GazelleCommunity
  notifications?: {
    messages: number
    notifications: number
    newAnnouncement: boolean
    newBlog: boolean
  }
  giftTokens?: number
  meritTokens?: number
}

export interface NebulancePlatformMeta {
  snatched?: number
  grabbed?: number
  forumPosts?: number
  invites?: number
}

export interface MamPlatformMeta {
  vipUntil?: string
  connectable?: string
  unsatisfiedCount?: number
  unsatisfiedLimit?: number
  inactiveSatisfiedCount?: number
  seedingHnrCount?: number
  inactiveUnsatisfiedCount?: number
  trackerErrorCount?: number
  recentlyDeleted?: number
  unreadPMs?: number
  openTickets?: number
  pendingRequests?: number
  unreadTopics?: number
}

export interface DigitalCorePlatformMeta {
  donor?: boolean
  seedboxDonor?: boolean
  parked?: boolean
  enabled?: boolean
  invites?: number
  invitees?: number
  leechBonus?: number
  uploadedReal?: number
  downloadedReal?: number
  torrents?: number
  requests?: number
  forumPosts?: number
  torrentComments?: number
  hnr?: number
  hnrWarned?: boolean
  downloadBan?: boolean
  uploadBan?: boolean
  connectable?: boolean
  crown?: boolean
  skull?: boolean
  pokal?: boolean
  coin?: boolean
  hearts?: number
}

export interface AvistazPlatformMeta {
  donor?: boolean
  vipExpiry?: string | null
  invites?: number
  canDownload?: boolean
  canUpload?: boolean
  totalUploads?: number
  totalDownloads?: number
  reseedRequests?: number
  twoFactorEnabled?: boolean
  bonusPerHour?: number
  bonusBreakdown?: {
    totalTorrents: { count: number; points: number }
    oldTorrents: { count: number; points: number }
    bigTorrents: { count: number; points: number }
    hugeTorrents: { count: number; points: number }
  }
}

/**
 * Hawke reports a handful of fields no other platform has: a per-division seed
 * breakdown, a warning count (not a boolean. See below), and four capability
 * flags the site uses to gate actions.
 */
export interface HawkePlatformMeta {
  /**
   * Seed counts per Hawke seeding division (vanguard, squire, knight,
   * champion, legend, guardian). A Record rather than a fixed key set, so a
   * division added site-side flows through instead of being dropped.
   */
  seedDivisions?: Record<string, number>
  /**
   * Count of active warnings, not a boolean. TrackerStats.warned stays null
   * for Hawke because a count of 0 and "not warnable" aren't distinguishable
   * from this field alone.
   */
  warnings?: number
  canUpload?: boolean
  canDownload?: boolean
  canRequest?: boolean
  canInvite?: boolean
}

/**
 * FileList exposes a few figures that fit no TrackerStats field. All plain
 * numbers: platformMeta is JSON-serialized into the trackers row, and bigint
 * does not survive JSON.
 */
export interface FileListPlatformMeta {
  invites?: number
  reputation?: number
  /** Total size currently seeding, as reported ("total seed size of X GB"). */
  totalSeedSizeBytes?: number
}

/**
 * Stock UNIT3D reports nothing beyond TrackerStats. LST's fork adds the API
 * key's expiry next to the user resource (issue #214), which is the one thing
 * worth keeping, since a lapsed key fails every poll until it is replaced.
 */
export interface Unit3dPlatformMeta {
  /** ISO 8601, as the tracker sent it. Absent when the key does not expire. */
  apiKeyExpiresAt?: string
}

/**
 * RetroToon counts that fit no TrackerStats field. Plain numbers only:
 * platformMeta is JSON-serialized, and bigint does not survive JSON.
 */
export interface RetrotoonPlatformMeta {
  /** Torrents snatched, from the profile's "Snatchlist (N)" row label. */
  snatched?: number
  /** Torrents uploaded, from the profile's "Uploaded (N)" row label. */
  uploadedTorrents?: number
  torrentComments?: number
  forumPosts?: number
  /** Bonus points earned per hour, from the bonus shop's "Earning Rate" card. */
  bonusPerHour?: number
  /**
   * H&R removal tokens held. A separate currency from `freeleechTokens`: these
   * clear a hit and run, they do not make a download free.
   */
  hnrCleanupTokens?: number
}

/** Union of all platform-specific metadata types */
export type PlatformMeta =
  | GGnPlatformMeta
  | GazellePlatformMeta
  | NebulancePlatformMeta
  | MamPlatformMeta
  | AvistazPlatformMeta
  | DigitalCorePlatformMeta
  | HawkePlatformMeta
  | FileListPlatformMeta
  | Unit3dPlatformMeta
  | RetrotoonPlatformMeta

/** Maps platformType string → the corresponding PlatformMeta variant */
export interface PlatformMetaMap {
  ggn: GGnPlatformMeta
  gazelle: GazellePlatformMeta
  nebulance: NebulancePlatformMeta
  mam: MamPlatformMeta
  avistaz: AvistazPlatformMeta
  digitalcore: DigitalCorePlatformMeta
  hawke: HawkePlatformMeta
  filelist: FileListPlatformMeta
  unit3d: Unit3dPlatformMeta
  retrotoon: RetrotoonPlatformMeta
}

/**
 * Fails to compile if a PlatformMetaMap key is not a real platform.
 *
 * The constraint on `Assert` is what makes it fire: a bare conditional type
 * would evaluate to `false` and compile.
 *
 * Nothing imports this; the underscore says so to the linter.
 */
type Assert<T extends true> = T
type _PlatformMetaMapKeysAreValid = Assert<
  keyof PlatformMetaMap extends PlatformType ? true : false
>

/**
 * Type-safe narrowing of PlatformMeta using the existing platformType discriminant.
 * Returns the narrowed meta if `ctx.tracker.platformType` matches, otherwise `null`.
 */
export function metaFor<P extends keyof PlatformMetaMap>(
  ctx: { tracker: { platformType: string }; meta: PlatformMeta | null },
  platform: P
): PlatformMetaMap[P] | null {
  if (!ctx.meta || ctx.tracker.platformType !== platform) return null
  return ctx.meta as PlatformMetaMap[P]
}

export interface DebugApiCall {
  label: string
  endpoint: string
  data: unknown | null
  error: string | null
}
