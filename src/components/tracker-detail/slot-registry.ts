// src/components/tracker-detail/slot-registry.ts
//
// Exports: SLOT_DEFINITIONS, renderSlotElement, AnySlotDefinition
// Slot IDs defined:
//   stat-card: login-deadline, gold, snatched-nebulance, seedbonus, ggn-share-score-card,
//              gazelle-tokens, perfect-flacs, snatched-gazelle, torrents-uploaded,
//              requests-filled, groups-contributed, invited, gazelle-bounty, gazelle-comments,
//              mam-wedges, mam-completed, mam-tracker-errors
//   badge: warned, donor, disabled, ggn-parked, ggn-invites, ggn-irc,
//          gazelle-paranoia, gazelle-unread, gazelle-announcement,
//          mam-vip, mam-connectable, mam-unread
//   progress: ggn-achievement-progress, ggn-share-score-progress, ggn-buffs,
//             mam-health-overview
//   avistaz stat-card: avistaz-activity
//   avistaz badge: avistaz-download-disabled, avistaz-upload-disabled, avistaz-vip, avistaz-invites

import type { ComponentType, ReactNode } from "react"
import { createElement } from "react"
import {
  DownloadArrowIcon,
  ShareScoreIcon,
  ShieldIcon,
  StarIcon,
  UploadArrowIcon,
  UserIcon,
} from "@/components/ui/Icons"
import { PulseDot } from "@/components/ui/PulseDot"
import type {
  StatCardBasicProps,
  StatCardRingProps,
  StatCardRow,
  StatCardStackedProps,
} from "@/components/ui/StatCard"
import { StatCard } from "@/components/ui/StatCard"
import { metaFor } from "@/lib/adapters/types"
import { formatBytesNum, formatCount, formatRatio } from "@/lib/formatters"
import type { SlotCategory, SlotContext } from "@/lib/slot-types"
import type { GgnAchievementProgressProps } from "./platform/GgnAchievementProgress"
import { GgnAchievementProgress } from "./platform/GgnAchievementProgress"
import type { GgnBuffsDisplayProps } from "./platform/GgnBuffsDisplay"
import { GgnBuffsDisplay } from "./platform/GgnBuffsDisplay"
import type { GgnShareScoreProgressProps } from "./platform/GgnShareScoreProgress"
import { GgnShareScoreProgress } from "./platform/GgnShareScoreProgress"
import type { MamHealthOverviewProps } from "./platform/MamHealthOverview"
import { MamHealthOverview } from "./platform/MamHealthOverview"
import type { SlotBadgeProps } from "./slots/SlotBadge"
import { SlotBadge } from "./slots/SlotBadge"

// ---------------------------------------------------------------------------
// SlotDefinition type
// ---------------------------------------------------------------------------

interface SlotDefinition<P = Record<string, unknown>> {
  id: string
  category: SlotCategory
  component: ComponentType<P>
  resolve: (ctx: SlotContext) => P | null
  priority: number
  span?: 1 | 2
}

// Erased type used for the exported heterogeneous array — component and
// resolve are widened so that typed SlotDefinition<T> values can be placed
// in a single array without unsafe double-casts.
export interface AnySlotDefinition {
  id: string
  category: SlotCategory
  // biome-ignore lint/suspicious/noExplicitAny: intentional erasure for heterogeneous registry
  component: ComponentType<any>
  // biome-ignore lint/suspicious/noExplicitAny: intentional erasure for heterogeneous registry
  resolve: (ctx: SlotContext) => any
  priority: number
  span?: 1 | 2
}

// ---------------------------------------------------------------------------
// Helper — creates a 16x16 icon element
// ---------------------------------------------------------------------------

function icon16(
  Icon: ComponentType<{ width?: string | number; height?: string | number }>
): ReactNode {
  return createElement(Icon, { width: 16, height: 16 })
}

// ---------------------------------------------------------------------------
// Stat-card slot definitions
// ---------------------------------------------------------------------------

const goldSlot: SlotDefinition<StatCardStackedProps> = {
  id: "gold",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardStackedProps>,
  priority: 10,
  span: 2,
  resolve(ctx) {
    const ggMeta = metaFor(ctx, "ggn")
    if (!ggMeta) return null
    if (ctx.latestSnapshot?.seedbonus == null) return null
    const gold = Math.floor(ctx.latestSnapshot.seedbonus)
    return {
      type: "stacked" as const,
      title: "Gold",
      rows: [
        { label: "Balance", value: formatCount(gold) },
        {
          label: "Per Hour",
          value: ggMeta.hourlyGold != null ? `+${formatCount(Math.floor(ggMeta.hourlyGold))}` : "—",
          colorClass: ggMeta.hourlyGold ? "text-success" : undefined,
        },
      ],
      accentColor: ctx.accentColor,
    }
  },
}

const snatchedNebulanceSlot: SlotDefinition<StatCardBasicProps> = {
  id: "snatched-nebulance",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 10,
  resolve(ctx) {
    const nebMeta = metaFor(ctx, "nebulance")
    if (!nebMeta || nebMeta.snatched == null) return null
    return {
      label: "Snatched",
      value: nebMeta.snatched,
      accentColor: ctx.accentColor,
      icon: icon16(DownloadArrowIcon),
    }
  },
}

const seedbonusSlot: SlotDefinition<StatCardBasicProps> = {
  id: "seedbonus",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 10,
  resolve(ctx) {
    if (ctx.latestSnapshot?.seedbonus == null) return null
    if (metaFor(ctx, "ggn") || metaFor(ctx, "gazelle") || metaFor(ctx, "nebulance")) return null
    return {
      label: "Seedbonus",
      value: formatCount(Math.floor(ctx.latestSnapshot.seedbonus)),
      unit: "BON",
      accentColor: ctx.accentColor,
      icon: icon16(StarIcon),
    }
  },
}

const ggnShareScoreCardSlot: SlotDefinition<StatCardBasicProps> = {
  id: "ggn-share-score-card",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 15,
  resolve(ctx) {
    const ggMeta = metaFor(ctx, "ggn")
    if (!ggMeta) return null
    if (ctx.latestSnapshot?.shareScore == null) return null
    return {
      label: "Share Score",
      value: formatRatio(ctx.latestSnapshot.shareScore),
      accentColor: ctx.accentColor,
      icon: icon16(ShareScoreIcon),
    }
  },
}

const gazelleTokensSlot: SlotDefinition<StatCardStackedProps> = {
  id: "gazelle-tokens",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardStackedProps>,
  priority: 20,
  span: 2,
  resolve(ctx) {
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta) return null
    const hasGift = gazMeta.giftTokens != null
    const hasMerit = gazMeta.meritTokens != null
    if (!hasGift && !hasMerit) return null
    const gift = gazMeta.giftTokens ?? 0
    const merit = gazMeta.meritTokens ?? 0
    return {
      type: "stacked" as const,
      title: "Tokens",
      rows: [
        { label: "Freeleech", value: hasGift ? gift : "—" },
        { label: "Merit", value: hasMerit ? merit : "—" },
      ],
      total: { label: "Total", value: String(gift + merit) },
      accentColor: ctx.accentColor,
    }
  },
}

const perfectFlacsSlot: SlotDefinition<StatCardBasicProps> = {
  id: "perfect-flacs",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 22,
  resolve(ctx) {
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta) return null
    if (gazMeta.community?.perfectFlacs == null) return null
    if (gazMeta.community.perfectFlacs <= 0) return null
    return {
      label: "Perfect FLACs",
      value: gazMeta.community.perfectFlacs,
      accentColor: ctx.accentColor,
      icon: icon16(UploadArrowIcon),
    }
  },
}

const snatchedGazelleSlot: SlotDefinition<StatCardBasicProps> = {
  id: "snatched-gazelle",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 23,
  resolve(ctx) {
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta) return null
    if (gazMeta.community?.snatched == null) return null
    return {
      label: "Snatched",
      value: gazMeta.community.snatched,
      accentColor: ctx.accentColor,
      icon: icon16(DownloadArrowIcon),
    }
  },
}

const torrentsUploadedSlot: SlotDefinition<StatCardBasicProps> = {
  id: "torrents-uploaded",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 24,
  resolve(ctx) {
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta) return null
    if (gazMeta.community?.uploaded == null) return null
    if (gazMeta.community.uploaded <= 0) return null
    return {
      label: "Torrents Uploaded",
      value: gazMeta.community.uploaded,
      accentColor: ctx.accentColor,
      icon: icon16(UploadArrowIcon),
    }
  },
}

const requestsFilledSlot: SlotDefinition<StatCardBasicProps> = {
  id: "requests-filled",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 25,
  resolve(ctx) {
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta) return null
    if (gazMeta.community?.requestsFilled == null) return null
    if (gazMeta.community.requestsFilled <= 0) return null
    return {
      label: "Requests Filled",
      value: gazMeta.community.requestsFilled,
      accentColor: ctx.accentColor,
      icon: icon16(UploadArrowIcon),
    }
  },
}

const groupsContributedSlot: SlotDefinition<StatCardBasicProps> = {
  id: "groups-contributed",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 26,
  resolve(ctx) {
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta) return null
    if (gazMeta.community?.groups == null) return null
    if (gazMeta.community.groups <= 0) return null
    return {
      label: "Groups Contributed",
      value: gazMeta.community.groups,
      accentColor: ctx.accentColor,
      icon: icon16(ShieldIcon),
    }
  },
}

const invitedSlot: SlotDefinition<StatCardBasicProps> = {
  id: "invited",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 27,
  resolve(ctx) {
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta) return null
    if (gazMeta.community?.invited == null) return null
    if (gazMeta.community.invited <= 0) return null
    return {
      label: "Invited",
      value: gazMeta.community.invited,
      accentColor: ctx.accentColor,
      icon: icon16(UserIcon),
    }
  },
}

const gazelleBountySlot: SlotDefinition<StatCardStackedProps> = {
  id: "gazelle-bounty",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardStackedProps>,
  priority: 21,
  span: 2,
  resolve(ctx) {
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta) return null
    if (!gazMeta.community) return null
    if (gazMeta.community.bountyEarned == null && gazMeta.community.bountySpent == null) return null
    const earned = gazMeta.community.bountyEarned ?? 0
    const spent = gazMeta.community.bountySpent ?? 0
    return {
      type: "stacked" as const,
      title: "Bounty",
      rows: [
        {
          label: "Earned",
          value: earned > 0 ? formatBytesNum(earned) : "—",
          colorClass: earned > 0 ? "text-success" : undefined,
        },
        {
          label: "Spent",
          value: spent > 0 ? formatBytesNum(spent) : "—",
          colorClass: spent > 0 ? "text-warn" : undefined,
        },
      ],
      total: { label: "Net", value: formatBytesNum(earned - spent) },
      accentColor: ctx.accentColor,
    }
  },
}

const gazelleCommentsSlot: SlotDefinition<StatCardStackedProps> = {
  id: "gazelle-comments",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardStackedProps>,
  priority: 29,
  span: 2,
  resolve(ctx) {
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta) return null
    if (!gazMeta.community) return null
    const c = gazMeta.community
    const total =
      (c.torrentComments ?? 0) +
      (c.artistComments ?? 0) +
      (c.collageComments ?? 0) +
      (c.requestComments ?? 0)
    if (!total || total <= 0) return null
    return {
      type: "stacked" as const,
      title: "Comments",
      rows: [
        { label: "Torrent", value: c.torrentComments },
        { label: "Artist", value: c.artistComments },
        { label: "Collage", value: c.collageComments },
        { label: "Request", value: c.requestComments },
      ],
      accentColor: ctx.accentColor,
    }
  },
}

const loginDeadlineSlot: SlotDefinition<StatCardRingProps> = {
  id: "login-deadline",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardRingProps>,
  priority: 30,
  span: 2,
  resolve(ctx) {
    const lastAccess = ctx.tracker.lastAccessAt
    const loginDays = ctx.registry?.rules?.loginIntervalDays
    if (!lastAccess || !loginDays || loginDays === 0) return null
    return {
      type: "ring",
      lastAccessAt: lastAccess,
      loginIntervalDays: loginDays,
      accentColor: ctx.accentColor,
    }
  },
}

// ---------------------------------------------------------------------------
// Badge slot definitions
// ---------------------------------------------------------------------------

const warnedBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "warned",
  category: "badge",
  component: SlotBadge,
  priority: 10,
  resolve(ctx) {
    if (ctx.latestSnapshot?.warned !== true) return null
    return { variant: "danger", label: "Warned" }
  },
}

const donorBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "donor",
  category: "badge",
  component: SlotBadge,
  priority: 11,
  resolve(ctx) {
    const ggMeta = metaFor(ctx, "ggn")
    const gazMeta = metaFor(ctx, "gazelle")
    const isDonor = ggMeta?.donor ?? gazMeta?.donor
    if (isDonor !== true) return null
    return { variant: "accent", label: "Donor" }
  },
}

const disabledBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "disabled",
  category: "badge",
  component: SlotBadge,
  priority: 12,
  resolve(ctx) {
    const ggMeta = metaFor(ctx, "ggn")
    const gazMeta = metaFor(ctx, "gazelle")
    const enabled = ggMeta?.enabled ?? gazMeta?.enabled
    if (enabled !== false) return null
    return { variant: "danger", label: "Disabled" }
  },
}

const ggnParkedBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "ggn-parked",
  category: "badge",
  component: SlotBadge,
  priority: 20,
  resolve(ctx) {
    const ggMeta = metaFor(ctx, "ggn")
    if (!ggMeta || ggMeta.parked !== true) return null
    return { variant: "warn", label: "Parked" }
  },
}

const ggnInvitesBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "ggn-invites",
  category: "badge",
  component: SlotBadge,
  priority: 21,
  resolve(ctx) {
    const ggMeta = metaFor(ctx, "ggn")
    if (!ggMeta) return null
    const invites = ggMeta.invites
    if (typeof invites !== "number" || invites <= 0) return null
    return { variant: "default", label: `${invites} Invites` }
  },
}

const ggnIrcBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "ggn-irc",
  category: "badge",
  component: SlotBadge,
  priority: 22,
  resolve(ctx) {
    const ggMeta = metaFor(ctx, "ggn")
    if (!ggMeta || ggMeta.onIRC !== true) return null
    const children = createElement(
      "span",
      { className: "inline-flex items-center gap-2" },
      createElement(PulseDot, { status: "healthy", size: "sm" }),
      "IRC"
    )
    return { variant: "default", children }
  },
}

const gazelleParanoiaBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "gazelle-paranoia",
  category: "badge",
  component: SlotBadge,
  priority: 30,
  resolve(ctx) {
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta) return null
    if (!gazMeta.paranoiaText || gazMeta.paranoiaText === "Off") return null
    return { variant: "default", label: `Paranoia: ${gazMeta.paranoiaText}` }
  },
}

const gazelleUnreadBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "gazelle-unread",
  category: "badge",
  component: SlotBadge,
  priority: 31,
  resolve(ctx) {
    if (ctx.tracker.hideUnreadBadges) return null
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta?.notifications) return null
    if (gazMeta.notifications.messages <= 0) return null
    return { variant: "warn", label: `${gazMeta.notifications.messages} Unread` }
  },
}

const gazelleAnnouncementBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "gazelle-announcement",
  category: "badge",
  component: SlotBadge,
  priority: 32,
  resolve(ctx) {
    if (ctx.tracker.hideUnreadBadges) return null
    const gazMeta = metaFor(ctx, "gazelle")
    if (!gazMeta?.notifications?.newAnnouncement) return null
    return { variant: "accent", label: "New Announcement" }
  },
}

// ---------------------------------------------------------------------------
// Progress slot definitions
// ---------------------------------------------------------------------------

const ggnAchievementProgressSlot: SlotDefinition<GgnAchievementProgressProps> = {
  id: "ggn-achievement-progress",
  category: "progress",
  component: GgnAchievementProgress as ComponentType<GgnAchievementProgressProps>,
  priority: 10,
  resolve(ctx) {
    const ggMeta = metaFor(ctx, "ggn")
    if (!ggMeta?.achievements) return null
    return { ggMeta, accentColor: ctx.accentColor }
  },
}

const ggnShareScoreProgressSlot: SlotDefinition<GgnShareScoreProgressProps> = {
  id: "ggn-share-score-progress",
  category: "progress",
  component: GgnShareScoreProgress as ComponentType<GgnShareScoreProgressProps>,
  priority: 11,
  resolve(ctx) {
    const ggMeta = metaFor(ctx, "ggn")
    if (!ggMeta) return null
    if (ctx.latestSnapshot?.shareScore == null) return null
    return { latestSnapshot: ctx.latestSnapshot, accentColor: ctx.accentColor }
  },
}

const ggnBuffsSlot: SlotDefinition<GgnBuffsDisplayProps> = {
  id: "ggn-buffs",
  category: "progress",
  component: GgnBuffsDisplay as ComponentType<GgnBuffsDisplayProps>,
  priority: 12,
  resolve(ctx) {
    const ggMeta = metaFor(ctx, "ggn")
    if (!ggMeta?.buffs || Object.keys(ggMeta.buffs).length === 0) return null
    return { ggMeta, accentColor: ctx.accentColor }
  },
}

// ---------------------------------------------------------------------------
// MAM slot definitions
// ---------------------------------------------------------------------------

function getDaysUntilVipExpiry(vipUntil: string): number | null {
  const expiry = new Date(vipUntil)
  if (Number.isNaN(expiry.getTime())) return null
  const ms = expiry.getTime() - Date.now()
  if (ms <= 0) return null
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

const mamWedgesSlot: SlotDefinition<StatCardBasicProps> = {
  id: "mam-wedges",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 14,
  resolve(ctx) {
    const mamMeta = metaFor(ctx, "mam")
    if (!mamMeta) return null
    if (ctx.latestSnapshot?.freeleechTokens == null) return null
    return {
      label: "FL Wedges",
      value: formatCount(Math.floor(ctx.latestSnapshot.freeleechTokens)),
      accentColor: ctx.accentColor,
      icon: icon16(StarIcon),
    }
  },
}

const mamCompletedSlot: SlotDefinition<StatCardBasicProps> = {
  id: "mam-completed",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 22,
  resolve(ctx) {
    const mamMeta = metaFor(ctx, "mam")
    if (!mamMeta || mamMeta.inactiveSatisfiedCount == null) return null
    return {
      label: "Completed",
      value: mamMeta.inactiveSatisfiedCount,
      accentColor: ctx.accentColor,
      icon: icon16(DownloadArrowIcon),
    }
  },
}

const mamTrackerErrorsSlot: SlotDefinition<StatCardBasicProps> = {
  id: "mam-tracker-errors",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 23,
  resolve(ctx) {
    const mamMeta = metaFor(ctx, "mam")
    if (!mamMeta || mamMeta.trackerErrorCount == null || mamMeta.trackerErrorCount <= 0) return null
    return {
      label: "Tracker Errors",
      value: mamMeta.trackerErrorCount,
      accentColor: ctx.accentColor,
      alert: "danger" as const,
    }
  },
}

const mamVipBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "mam-vip",
  category: "badge",
  component: SlotBadge,
  priority: 10,
  resolve(ctx) {
    const mamMeta = metaFor(ctx, "mam")
    if (!mamMeta?.vipUntil) return null
    const days = getDaysUntilVipExpiry(mamMeta.vipUntil)
    if (days == null) return null
    return { variant: days <= 7 ? "warn" : "accent", label: `VIP (${days}d)` }
  },
}

const mamConnectableBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "mam-connectable",
  category: "badge",
  component: SlotBadge,
  priority: 20,
  resolve(ctx) {
    const mamMeta = metaFor(ctx, "mam")
    if (!mamMeta || mamMeta.connectable == null) return null
    const lower = mamMeta.connectable.toLowerCase()
    const isOnline = lower === "yes" || lower === "true" || lower === "online"
    return {
      variant: isOnline ? "default" : "danger",
      label: isOnline ? "Connectable" : "Not Connectable",
    }
  },
}

const mamUnreadBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "mam-unread",
  category: "badge",
  component: SlotBadge,
  priority: 30,
  resolve(ctx) {
    if (ctx.tracker.hideUnreadBadges) return null
    const mamMeta = metaFor(ctx, "mam")
    if (!mamMeta) return null
    const count = (mamMeta.unreadPMs ?? 0) + (mamMeta.unreadTopics ?? 0)
    if (count <= 0) return null
    return { variant: "warn", label: `${count} Unread` }
  },
}

const mamHealthOverviewSlot: SlotDefinition<MamHealthOverviewProps> = {
  id: "mam-health-overview",
  category: "progress",
  component: MamHealthOverview as ComponentType<MamHealthOverviewProps>,
  priority: 10,
  resolve(ctx) {
    const mamMeta = metaFor(ctx, "mam")
    if (!mamMeta) return null
    return {
      meta: mamMeta,
      seedingCount: ctx.latestSnapshot?.seedingCount ?? 0,
      leechingCount: ctx.latestSnapshot?.leechingCount ?? 0,
      hitAndRuns: ctx.latestSnapshot?.hitAndRuns ?? 0,
      seedbonus: ctx.latestSnapshot?.seedbonus ?? null,
      accentColor: ctx.accentColor,
      vipUntil: mamMeta.vipUntil ?? null,
      unsatisfiedCount: mamMeta.unsatisfiedCount ?? null,
      unsatisfiedLimit: mamMeta.unsatisfiedLimit ?? null,
    }
  },
}

// ---------------------------------------------------------------------------
// AvistaZ slot definitions
// ---------------------------------------------------------------------------

const avistazActivitySlot: SlotDefinition<StatCardStackedProps> = {
  id: "avistaz-activity",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardStackedProps>,
  priority: 14,
  span: 2,
  resolve(ctx) {
    const avMeta = metaFor(ctx, "avistaz")
    if (!avMeta) return null
    const uploads = avMeta.totalUploads ?? 0
    const downloads = avMeta.totalDownloads ?? 0
    if (uploads === 0 && downloads === 0 && !avMeta.bonusPerHour) return null
    const rows: StatCardRow[] = [
      { label: "Uploads", value: uploads },
      { label: "Downloads", value: downloads },
    ]
    if (avMeta.bonusPerHour != null) {
      rows.push({
        label: "Bonus/hr",
        prefix: "+",
        value: formatCount(Math.floor(avMeta.bonusPerHour)),
        colorClass: "text-success",
      })
    }
    return {
      type: "stacked" as const,
      title: "Activity",
      rows,
      accentColor: ctx.accentColor,
    }
  },
}

const avistazDownloadDisabledBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "avistaz-download-disabled",
  category: "badge",
  component: SlotBadge,
  priority: 12,
  resolve(ctx) {
    const avMeta = metaFor(ctx, "avistaz")
    if (!avMeta || avMeta.canDownload !== false) return null
    return { variant: "danger", label: "Downloads Disabled" }
  },
}

const avistazUploadDisabledBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "avistaz-upload-disabled",
  category: "badge",
  component: SlotBadge,
  priority: 12,
  resolve(ctx) {
    const avMeta = metaFor(ctx, "avistaz")
    if (!avMeta || avMeta.canUpload !== false) return null
    return { variant: "danger", label: "Uploads Disabled" }
  },
}

const avistazVipBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "avistaz-vip",
  category: "badge",
  component: SlotBadge,
  priority: 10,
  resolve(ctx) {
    const avMeta = metaFor(ctx, "avistaz")
    if (!avMeta?.vipExpiry) return null
    const expiry = new Date(avMeta.vipExpiry)
    if (Number.isNaN(expiry.getTime())) return null
    const ms = expiry.getTime() - Date.now()
    if (ms <= 0) return null
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
    return { variant: days <= 7 ? "warn" : "accent", label: `VIP (${days}d)` }
  },
}

const avistazInvitesBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "avistaz-invites",
  category: "badge",
  component: SlotBadge,
  priority: 21,
  resolve(ctx) {
    const avMeta = metaFor(ctx, "avistaz")
    if (!avMeta) return null
    const invites = avMeta.invites
    if (typeof invites !== "number" || invites <= 0) return null
    return { variant: "default", label: `${invites} Invites` }
  },
}

// ---------------------------------------------------------------------------
// Exported registry
// ---------------------------------------------------------------------------

export const SLOT_DEFINITIONS: AnySlotDefinition[] = [
  // stat-card slots
  loginDeadlineSlot,
  goldSlot,
  snatchedNebulanceSlot,
  seedbonusSlot,
  ggnShareScoreCardSlot,
  gazelleTokensSlot,
  perfectFlacsSlot,
  snatchedGazelleSlot,
  torrentsUploadedSlot,
  requestsFilledSlot,
  groupsContributedSlot,
  invitedSlot,
  gazelleBountySlot,
  gazelleCommentsSlot,
  // MAM slots (stat-card)
  mamWedgesSlot,
  mamCompletedSlot,
  mamTrackerErrorsSlot,
  // badge slots
  warnedBadgeSlot,
  donorBadgeSlot,
  disabledBadgeSlot,
  ggnParkedBadgeSlot,
  ggnInvitesBadgeSlot,
  ggnIrcBadgeSlot,
  gazelleParanoiaBadgeSlot,
  gazelleUnreadBadgeSlot,
  gazelleAnnouncementBadgeSlot,
  // MAM slots (badge)
  mamVipBadgeSlot,
  mamConnectableBadgeSlot,
  mamUnreadBadgeSlot,
  // progress slots
  ggnAchievementProgressSlot,
  ggnShareScoreProgressSlot,
  ggnBuffsSlot,
  // MAM slots (progress)
  mamHealthOverviewSlot,
  // AvistaZ slots (stat-card)
  avistazActivitySlot,
  // AvistaZ slots (badge)
  avistazDownloadDisabledBadgeSlot,
  avistazUploadDisabledBadgeSlot,
  avistazVipBadgeSlot,
  avistazInvitesBadgeSlot,
]

// Shared component lookup — single source for rendering resolved slots
const SLOT_COMPONENT_MAP = new Map(SLOT_DEFINITIONS.map((def) => [def.id, def.component]))

export function renderSlotElement(slot: { id: string; props: Record<string, unknown> }): ReactNode {
  const Component = SLOT_COMPONENT_MAP.get(slot.id)
  if (!Component) return null
  return createElement(Component, slot.props)
}
