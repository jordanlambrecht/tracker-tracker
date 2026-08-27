// src/hooks/useTrackerTorrents.ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { TrackerRules } from "@/data/tracker-registry"
import { usePollingIntervals } from "@/hooks/usePollingIntervals"
import type { TorrentRaw } from "@/lib/fleet"
import type { TagGroupBreakdown } from "@/lib/fleet-aggregation"
import {
  isSatisfied,
  resolveSatisfaction,
  type SatisfactionRequirement,
  satisfactionProgress,
} from "@/lib/satisfaction"
import {
  type AggregatedTorrentsResponse,
  type CategoryStats,
  LEECHING_STATES,
  parseTorrentTags,
  SEEDING_STATES,
} from "@/lib/torrent-utils"
import type { QbitmanageTagConfig, TagGroup } from "@/types/api"

// ---------------------------------------------------------------------------
// Type defs
// ---------------------------------------------------------------------------

interface UseTrackerTorrentsParams {
  trackerId: number
  qbtTag: string | null
  rules?: TrackerRules
  tagGroups?: TagGroup[]
  trackerSeedingCount?: number | null
  qbitmanageConfig?: {
    enabled: boolean
    tags: QbitmanageTagConfig
  } | null
  /** When false, disables the 5s active torrent poll (i.e. tab not visible). */
  isActive?: boolean
}

interface QbitmanageBreakdownItem {
  label: string
  count: number
  color: null
}

interface TrackerTorrentsData {
  torrents: TorrentRaw[]
  crossSeedTags: string[]
  loading: boolean
  torrentError: string | null
  noClients: boolean
  clientCount: number
  stale: boolean
  cachedAt: string | null

  seedingTorrents: TorrentRaw[]
  leechingTorrents: TorrentRaw[]
  activelySeedingTorrents: TorrentRaw[]
  activelyDownloading: TorrentRaw[]
  totalUpSpeed: number
  totalSize: number
  crossSeeded: TorrentRaw[]
  /** The resolved per-torrent rule, or null when this tracker states none. */
  requirement: SatisfactionRequirement | null
  /** Kept for the seed-time chart marker; null when seed time is not required. */
  requiredSeedSeconds: number | null
  unsatisfiedTorrents: TorrentRaw[]
  unsatisfiedSorted: TorrentRaw[]
  unsatisfiedCount: number | null
  hnrRiskCount: number | null
  deadCount: number | null
  categoryStats: CategoryStats[]
  topBySeeding: TorrentRaw[]
  elderTorrents: TorrentRaw[]
  tagGroupBreakdowns: TagGroupBreakdown[]
  qbitmanageBreakdown: QbitmanageBreakdownItem[]
}

// ---------------------------------------------------------------------------
// SessionStorage cache (Phase 0: instant restore on page refresh)
// ---------------------------------------------------------------------------

function loadSessionCache(trackerId: number): AggregatedTorrentsResponse | undefined {
  try {
    const raw = sessionStorage.getItem(`torrent-cache-${trackerId}`)
    if (!raw) return undefined
    return JSON.parse(raw) as AggregatedTorrentsResponse
  } catch {
    return undefined
  }
}

function saveSessionCache(trackerId: number, data: AggregatedTorrentsResponse) {
  try {
    sessionStorage.setItem(`torrent-cache-${trackerId}`, JSON.stringify(data))
  } catch {
    // sessionStorage full or unavailable
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

// `qbtTag` is not destructured: trackers now resolve by announce URL server-side,
// so the hook doesn't need it. It stays on params because callers pass it and
// the tab uses it for empty-state copy.
function useTrackerTorrents({
  trackerId,
  rules,
  tagGroups,
  trackerSeedingCount,
  qbitmanageConfig,
  isActive = true,
}: UseTrackerTorrentsParams): TrackerTorrentsData {
  const intervals = usePollingIntervals()

  // Fetch from the DB cache endpoint with instant restore from sessionStorage
  const cachedQuery = useQuery({
    queryKey: ["tracker-torrents-cached", trackerId] as const,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/trackers/${trackerId}/torrents/cached`, { signal })
      if (!res.ok) return null
      const data = (await res.json()) as AggregatedTorrentsResponse
      if (data.torrents.length > 0) {
        saveSessionCache(trackerId, data)
        return data
      }
      return null
    },
    staleTime: intervals.trackerRefetchMs,
    initialData: loadSessionCache(trackerId) ?? undefined,
    initialDataUpdatedAt: 0,
  })

  // Phase 2: Live qBT torrent data (slow, overrides cached when ready)
  const liveQuery = useQuery({
    queryKey: ["tracker-torrents", trackerId] as const,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/trackers/${trackerId}/torrents`, { signal })
      if (!res.ok) throw new Error(`Torrent fetch failed: ${res.status}`)
      const data = (await res.json()) as AggregatedTorrentsResponse
      // Apply the same trust rule: only cache if complete (no client errors)
      // or non-empty. An empty response with errors is incomplete, not a real answer.
      if (data.torrents.length > 0 || data.clientErrors.length === 0) {
        saveSessionCache(trackerId, data)
      }
      return data
    },
    staleTime: intervals.trackerRefetchMs,
  })

  // Active torrent poll. Only starts after live data has resolved
  const activeQuery = useQuery({
    queryKey: ["tracker-torrents-active", trackerId] as const,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/trackers/${trackerId}/torrents?active=true`, { signal })
      if (!res.ok) return null
      return res.json() as Promise<AggregatedTorrentsResponse>
    },
    enabled: liveQuery.isSuccess,
    refetchInterval: isActive ? 5_000 : false,
  })

  // Resolve the best available data source.
  //
  // Live wins when trustworthy. It's untrustworthy when empty and incomplete.
  // fetchAndMergeTorrents races each client for 5s. One slow or offline client
  // produces zero torrents. Taking that literally blanked cache on a hiccup.
  //
  // An empty result with no client errors is the opposite: all answered, none
  // holds this tracker's torrents. That is an answer, not a symptom. Without
  // this rule, a tracker with no torrents would show stale cache forever. Also,
  // a tag or announce mismatch would stay hidden.
  const live = liveQuery.data ?? null
  const cached = cachedQuery.data ?? null
  const liveTrustworthy =
    live !== null && (live.torrents.length > 0 || live.clientErrors.length === 0)
  const usingCache = !liveTrustworthy && cached !== null && cached.torrents.length > 0

  const baseData = usingCache ? cached : (live ?? cached)
  const stale = usingCache
  const cachedAt = usingCache ? (cached.cachedAt ?? null) : null
  const loading = !baseData && (cachedQuery.isLoading || liveQuery.isLoading)

  // Merge active speeds into the base torrent list
  const torrents = useMemo(() => {
    if (!baseData) return []
    const base: TorrentRaw[] = baseData.torrents
    if (!activeQuery.data) return base

    const activeMap = new Map(activeQuery.data.torrents.map((t) => [t.hash, t] as const))
    return base.map((t) => {
      const active = activeMap.get(t.hash)
      if (active) {
        return {
          ...t,
          uploadSpeed: active.uploadSpeed,
          downloadSpeed: active.downloadSpeed,
          state: active.state,
          progress: active.progress,
        }
      }
      if (
        t.uploadSpeed > 0 ||
        t.downloadSpeed > 0 ||
        t.state === "uploading" ||
        t.state === "downloading"
      ) {
        return {
          ...t,
          uploadSpeed: 0,
          downloadSpeed: 0,
          state: t.state === "downloading" ? ("stalledDL" as const) : ("stalledUP" as const),
        }
      }
      return t
    })
  }, [baseData, activeQuery.data])

  const crossSeedTags = useMemo(() => baseData?.crossSeedTags ?? [], [baseData?.crossSeedTags])
  const clientCount = baseData?.clientCount ?? 0
  const noClients = clientCount === 0

  const torrentError = useMemo(() => {
    if (liveQuery.data?.clientErrors?.length) {
      return `Partial data, some clients failed: ${liveQuery.data.clientErrors.join("; ")}`
    }
    if (liveQuery.error && !cachedQuery.data) {
      return "Client offline, no cached data available"
    }
    return null
  }, [liveQuery.data, liveQuery.error, cachedQuery.data])

  const derived = useMemo(() => {
    const seedingTorrents = torrents.filter((t) => SEEDING_STATES.has(t.state))
    const leechingTorrents = torrents.filter((t) => LEECHING_STATES.has(t.state))
    const activelySeedingTorrents = torrents.filter((t) => t.state === "uploading")
    const activelyDownloading = torrents.filter(
      (t) => LEECHING_STATES.has(t.state) && t.downloadSpeed > 0
    )
    const totalUpSpeed = torrents.reduce((sum, t) => sum + t.uploadSpeed, 0)
    const totalSize = torrents.reduce((sum, t) => sum + t.size, 0)

    const csTagSet = new Set(crossSeedTags.map((t) => t.toLowerCase()))
    const crossSeeded = torrents.filter((t) => {
      const tags = t.tags
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      return tags.some((tag) => csTagSet.has(tag))
    })

    // Satisfaction is no longer seed time alone. A tracker that states an
    // either/or — TorrentLeech's "two ways for you to give back" — has torrents
    // that are done at 1:1 with no seed time on the clock, and a rule that
    // ignores ratio keeps them forever. See @/lib/satisfaction for why ratio
    // only counts for entries that declare a mode.
    const requirement = resolveSatisfaction(rules)
    const requiredSeedSeconds = requirement?.requiredSeedSeconds ?? null
    const unsatisfiedTorrents = requirement
      ? torrents.filter((t) => !isSatisfied(t, requirement))
      : []
    const unsatisfiedCount = requirement ? unsatisfiedTorrents.length : null

    const hnrRiskCount = requirement
      ? unsatisfiedTorrents.filter(
          (t) => !SEEDING_STATES.has(t.state) && !LEECHING_STATES.has(t.state)
        ).length
      : null

    const deadCount =
      trackerSeedingCount != null ? Math.max(0, seedingTorrents.length - trackerSeedingCount) : null

    const categoryMap = new Map<string, TorrentRaw[]>()
    for (const t of torrents) {
      const cat = t.category || "Uncategorized"
      const arr = categoryMap.get(cat) ?? []
      arr.push(t)
      categoryMap.set(cat, arr)
    }

    const categoryStats: CategoryStats[] = [...categoryMap.entries()]
      .map(([name, items]) => {
        // qBT reports ratio -1 for a pure cross-seed. Excluded from the average
        // like fleet-aggregation's ratio stats, not summed in as a negative.
        const measurable = items.filter((t) => t.ratio >= 0)
        return {
          name,
          count: items.length,
          totalSize: items.reduce((s, t) => s + t.size, 0),
          avgRatio: measurable.length
            ? measurable.reduce((s, t) => s + t.ratio, 0) / measurable.length
            : 0,
          avgSeedTime: items.reduce((s, t) => s + t.seedingTime, 0) / items.length,
          avgSwarmSeeds: items.reduce((s, t) => s + t.swarmSeeders, 0) / items.length,
        }
      })
      .sort((a, b) => b.count - a.count)

    const topBySeeding = [...seedingTorrents]
      .sort((a, b) => b.seedingTime - a.seedingTime)
      .slice(0, 10)

    const elderTorrents = [...torrents]
      .filter((t) => t.addedAt > 0)
      .sort((a, b) => a.addedAt - b.addedAt)
      .slice(0, 10)

    // Closest to satisfied first. Sorting on seed time alone put a torrent at
    // 0.99 ratio — one that could be released within the hour — below one with
    // days of seeding and no chance of clearing on ratio.
    const unsatisfiedSorted = requirement
      ? [...unsatisfiedTorrents].sort(
          (a, b) => satisfactionProgress(b, requirement) - satisfactionProgress(a, requirement)
        )
      : []

    const torrentTagSets = torrents.map((t) => new Set(parseTorrentTags(t.tags, false)))

    const tagGroupBreakdowns: TagGroupBreakdown[] = (tagGroups ?? [])
      .map((group) => {
        const allGroupTagSet = new Set(group.members.map((m) => m.tag))
        const memberCounts = group.members
          .map((member) => {
            const count = torrentTagSets.filter((tags) => tags.has(member.tag)).length
            return { label: member.label, count, color: member.color }
          })
          .filter((m) => m.count > 0)
        const unmatchedCount = torrentTagSets.filter((tags) => {
          for (const tag of tags) {
            if (allGroupTagSet.has(tag)) return false
          }
          return true
        }).length
        return { group, memberCounts, unmatchedCount }
      })
      .filter((g) => g.memberCounts.length > 0 || (g.group.countUnmatched && g.unmatchedCount > 0))

    const qbitmanageBreakdown: QbitmanageBreakdownItem[] = qbitmanageConfig?.enabled
      ? Object.entries(qbitmanageConfig.tags)
          .filter(([, entry]) => entry.enabled)
          .map(([key, entry]) => {
            const count = torrentTagSets.filter((tags) => tags.has(entry.tag)).length
            const labelMap: Record<string, string> = {
              issue: "Issue",
              minTimeNotReached: "Min Time Not Reached",
              noHardlinks: "No Hardlinks",
              minSeedsNotMet: "Min Seeds Not Met",
              lastActiveLimitNotReached: "Last Active Limit",
              lastActiveNotReached: "Last Active Not Reached",
            }
            return { label: labelMap[key] ?? key, count, color: null }
          })
          .filter((m) => m.count > 0)
      : []

    return {
      seedingTorrents,
      leechingTorrents,
      activelySeedingTorrents,
      activelyDownloading,
      totalUpSpeed,
      totalSize,
      crossSeeded,
      requirement,
      requiredSeedSeconds,
      unsatisfiedTorrents,
      unsatisfiedSorted,
      unsatisfiedCount,
      hnrRiskCount,
      deadCount,
      categoryStats,
      topBySeeding,
      elderTorrents,
      tagGroupBreakdowns,
      qbitmanageBreakdown,
    }
  }, [torrents, crossSeedTags, rules, tagGroups, trackerSeedingCount, qbitmanageConfig])

  return {
    torrents,
    crossSeedTags,
    loading,
    torrentError,
    noClients,
    clientCount,
    stale,
    cachedAt,
    ...derived,
  }
}

export type { QbitmanageBreakdownItem, TrackerTorrentsData, UseTrackerTorrentsParams }
export { useTrackerTorrents }
