// src/components/tracker-detail/slot-registry.ts
//
// Exports: SLOT_DEFINITIONS, renderSlotElement, AnySlotDefinition
// Slot IDs defined:
//   stat-card: login-deadline, gold, snatched-nebulance, seedbonus, ggn-share-score-card,
//              gazelle-tokens, perfect-flacs, snatched-gazelle, torrents-uploaded,
//              requests-filled, groups-contributed, invited, gazelle-bounty, gazelle-comments
//   badge: warned, donor, disabled, ggn-parked, ggn-invites, ggn-irc,
//          gazelle-paranoia, gazelle-unread, gazelle-announcement
//   progress: ggn-achievement-progress, ggn-share-score-progress, ggn-buffs

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
import type { StatCardBasicProps, StatCardRingProps, StatCardStackedProps } from "@/components/ui/StatCard"
import { StatCard } from "@/components/ui/StatCard"
import type { GazellePlatformMeta, GGnPlatformMeta } from "@/lib/adapters/types"
import { formatBytesNum } from "@/lib/formatters"
import type { SlotCategory, SlotContext } from "@/lib/slot-types"
import type { GgnAchievementProgressProps } from "./platform/GgnAchievementProgress"
import { GgnAchievementProgress } from "./platform/GgnAchievementProgress"
import type { GgnBuffsDisplayProps } from "./platform/GgnBuffsDisplay"
import { GgnBuffsDisplay } from "./platform/GgnBuffsDisplay"
import type { GgnShareScoreProgressProps } from "./platform/GgnShareScoreProgress"
import { GgnShareScoreProgress } from "./platform/GgnShareScoreProgress"
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

function icon16(Icon: ComponentType<{ width?: string | number; height?: string | number }>): ReactNode {
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
    const { meta, latestSnapshot, accentColor } = ctx
    if (!meta || !("hourlyGold" in meta)) return null
    if (latestSnapshot?.seedbonus == null) return null
    const ggMeta = meta as GGnPlatformMeta
    const gold = Math.floor(latestSnapshot.seedbonus)
    return {
      type: "stacked" as const,
      title: "Gold",
      rows: [
        { label: "Balance", value: gold.toLocaleString() },
        { label: "Per Hour", value: ggMeta.hourlyGold != null ? `+${Math.floor(ggMeta.hourlyGold).toLocaleString()}` : "—", colorClass: ggMeta.hourlyGold ? "text-success" : undefined },
      ],
      accentColor,
    }
  },
}

const snatchedNebulanceSlot: SlotDefinition<StatCardBasicProps> = {
  id: "snatched-nebulance",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 10,
  resolve(ctx) {
    const { meta, accentColor } = ctx
    if (!meta) return null
    if (!("snatched" in meta)) return null
    if ("hourlyGold" in meta) return null
    if ("community" in meta) return null
    const value = (meta as { snatched: number }).snatched
    return {
      label: "Snatched",
      value,
      accentColor,
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
    const { meta, latestSnapshot, accentColor } = ctx
    if (latestSnapshot?.seedbonus == null) return null
    if (meta && "hourlyGold" in meta) return null
    if (meta && "snatched" in meta) return null
    return {
      label: "Seedbonus",
      value: Math.floor(latestSnapshot.seedbonus).toLocaleString(),
      unit: "BON",
      accentColor,
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
    const { meta, latestSnapshot, accentColor } = ctx
    if (latestSnapshot?.shareScore == null) return null
    if (!meta || !("hourlyGold" in meta)) return null
    return {
      label: "Share Score",
      value: latestSnapshot.shareScore.toFixed(2),
      accentColor,
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
    const { meta, accentColor } = ctx
    if (!meta) return null
    const hasGift = "giftTokens" in meta && meta.giftTokens != null
    const hasMerit = "meritTokens" in meta && meta.meritTokens != null
    if (!hasGift && !hasMerit) return null
    const gazMeta = meta as GazellePlatformMeta
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
      accentColor,
    }
  },
}

const perfectFlacsSlot: SlotDefinition<StatCardBasicProps> = {
  id: "perfect-flacs",
  category: "stat-card",
  component: StatCard as ComponentType<StatCardBasicProps>,
  priority: 22,
  resolve(ctx) {
    const { meta, accentColor } = ctx
    if (!meta || !("community" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
    if (gazMeta.community?.perfectFlacs == null) return null
    if (gazMeta.community.perfectFlacs <= 0) return null
    return {
      label: "Perfect FLACs",
      value: gazMeta.community.perfectFlacs,
      accentColor,
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
    const { meta, accentColor } = ctx
    if (!meta || !("community" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
    if (gazMeta.community?.snatched == null) return null
    return {
      label: "Snatched",
      value: gazMeta.community.snatched,
      accentColor,
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
    const { meta, accentColor } = ctx
    if (!meta || !("community" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
    if (gazMeta.community?.uploaded == null) return null
    if (gazMeta.community.uploaded <= 0) return null
    return {
      label: "Torrents Uploaded",
      value: gazMeta.community.uploaded,
      accentColor,
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
    const { meta, accentColor } = ctx
    if (!meta || !("community" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
    if (gazMeta.community?.requestsFilled == null) return null
    if (gazMeta.community.requestsFilled <= 0) return null
    return {
      label: "Requests Filled",
      value: gazMeta.community.requestsFilled,
      accentColor,
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
    const { meta, accentColor } = ctx
    if (!meta || !("community" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
    if (gazMeta.community?.groups == null) return null
    if (gazMeta.community.groups <= 0) return null
    return {
      label: "Groups Contributed",
      value: gazMeta.community.groups,
      accentColor,
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
    const { meta, accentColor } = ctx
    if (!meta || !("community" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
    if (gazMeta.community?.invited == null) return null
    if (gazMeta.community.invited <= 0) return null
    return {
      label: "Invited",
      value: gazMeta.community.invited,
      accentColor,
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
    const { meta, accentColor } = ctx
    if (!meta || !("community" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
    if (!gazMeta.community) return null
    if (gazMeta.community.bountyEarned == null && gazMeta.community.bountySpent == null) return null
    const earned = gazMeta.community.bountyEarned ?? 0
    const spent = gazMeta.community.bountySpent ?? 0
    return {
      type: "stacked" as const,
      title: "Bounty",
      rows: [
        { label: "Earned", value: earned > 0 ? formatBytesNum(earned) : "—", colorClass: earned > 0 ? "text-success" : undefined },
        { label: "Spent", value: spent > 0 ? formatBytesNum(spent) : "—", colorClass: spent > 0 ? "text-warn" : undefined },
      ],
      total: { label: "Net", value: formatBytesNum(earned - spent) },
      accentColor,
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
    const { meta, accentColor } = ctx
    if (!meta || !("community" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
    if (!gazMeta.community) return null
    const c = gazMeta.community
    const total = (c.torrentComments ?? 0) + (c.artistComments ?? 0) + (c.collageComments ?? 0) + (c.requestComments ?? 0)
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
      accentColor,
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
    const { meta } = ctx
    if (!meta || !("donor" in meta)) return null
    if ((meta as { donor?: boolean }).donor !== true) return null
    return { variant: "accent", label: "Donor" }
  },
}

const disabledBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "disabled",
  category: "badge",
  component: SlotBadge,
  priority: 12,
  resolve(ctx) {
    const { meta } = ctx
    if (!meta || !("enabled" in meta)) return null
    if ((meta as { enabled?: boolean }).enabled !== false) return null
    return { variant: "danger", label: "Disabled" }
  },
}

const ggnParkedBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "ggn-parked",
  category: "badge",
  component: SlotBadge,
  priority: 20,
  resolve(ctx) {
    const { meta } = ctx
    if (!meta || !("parked" in meta)) return null
    if ((meta as GGnPlatformMeta).parked !== true) return null
    return { variant: "warn", label: "Parked" }
  },
}

const ggnInvitesBadgeSlot: SlotDefinition<SlotBadgeProps> = {
  id: "ggn-invites",
  category: "badge",
  component: SlotBadge,
  priority: 21,
  resolve(ctx) {
    const { meta } = ctx
    if (!meta || !("invites" in meta)) return null
    const invites = (meta as GGnPlatformMeta).invites
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
    const { meta } = ctx
    if (!meta || !("onIRC" in meta)) return null
    if ((meta as GGnPlatformMeta).onIRC !== true) return null
    const children = createElement(
      "span",
      { className: "inline-flex items-center gap-1.5" },
      createElement(PulseDot, { status: "healthy", size: "sm" }),
      "IRC",
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
    const { meta } = ctx
    if (!meta || !("paranoiaText" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
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
    const { meta } = ctx
    if (!meta || !("notifications" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
    if (!gazMeta.notifications) return null
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
    const { meta } = ctx
    if (!meta || !("notifications" in meta)) return null
    const gazMeta = meta as GazellePlatformMeta
    if (!gazMeta.notifications?.newAnnouncement) return null
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
    const { meta, accentColor } = ctx
    if (!meta || !("achievements" in meta)) return null
    const ggMeta = meta as GGnPlatformMeta
    if (!ggMeta.achievements) return null
    return { ggMeta, accentColor }
  },
}

const ggnShareScoreProgressSlot: SlotDefinition<GgnShareScoreProgressProps> = {
  id: "ggn-share-score-progress",
  category: "progress",
  component: GgnShareScoreProgress as ComponentType<GgnShareScoreProgressProps>,
  priority: 11,
  resolve(ctx) {
    const { meta, latestSnapshot, accentColor } = ctx
    if (!meta || !("hourlyGold" in meta)) return null
    if (latestSnapshot?.shareScore == null) return null
    return { latestSnapshot, accentColor }
  },
}

const ggnBuffsSlot: SlotDefinition<GgnBuffsDisplayProps> = {
  id: "ggn-buffs",
  category: "progress",
  component: GgnBuffsDisplay as ComponentType<GgnBuffsDisplayProps>,
  priority: 12,
  resolve(ctx) {
    const { meta, accentColor } = ctx
    if (!meta || !("buffs" in meta)) return null
    const ggMeta = meta as GGnPlatformMeta
    if (!ggMeta.buffs || Object.keys(ggMeta.buffs).length === 0) return null
    return { ggMeta, accentColor }
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
  // progress slots
  ggnAchievementProgressSlot,
  ggnShareScoreProgressSlot,
  ggnBuffsSlot,
]

// Shared component lookup — single source for rendering resolved slots
const SLOT_COMPONENT_MAP = new Map(SLOT_DEFINITIONS.map((def) => [def.id, def.component]))

export function renderSlotElement(slot: { id: string; props: Record<string, unknown> }): ReactNode {
  const Component = SLOT_COMPONENT_MAP.get(slot.id)
  if (!Component) return null
  return createElement(Component, slot.props)
}
