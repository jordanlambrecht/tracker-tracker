// src/hooks/useTrackerTorrents.ts

"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"
import type { TrackerRules } from "@/data/tracker-registry"
import { usePollingIntervals } from "@/hooks/usePollingIntervals"
import {
  type AggregatedTorrentsResponse,
  type CategoryStats,
  LEECHING_STATES,
  mapTorrent,
  parseTorrentTags,
  SEEDING_STATES,
  type TorrentInfo,
} from "@/lib/torrent-utils"
import type { QbitmanageTagConfig, TagGroup } from "@/types/api"

// ---------------------------------------------------------------------------
// Params / return types
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
}

interface TagGroupBreakdown {
  group: TagGroup
  memberCounts: { label: string; count: number; color: string | null }[]
  unmatchedCount: number
}

interface QbitmanageBreakdownItem {
  label: string
  count: number
  color: null
}

interface TrackerTorrentsData {
  torrents: TorrentInfo[]
  crossSeedTags: string[]
  loading: boolean
  torrentError: string | null
  noClients: boolean
  clientCount: number
  stale: boolean
  cachedAt: string | null

  seedingTorrents: TorrentInfo[]
  leechingTorrents: TorrentInfo[]
  activelySeedingTorrents: TorrentInfo[]
  activelyDownloading: TorrentInfo[]
  totalUpSpeed: number
  totalSize: number
  crossSeeded: TorrentInfo[]
  requiredSeedSeconds: number | null
  unsatisfiedTorrents: TorrentInfo[]
  unsatisfiedSorted: TorrentInfo[]
  unsatisfiedCount: number | null
  hnrRiskCount: number | null
  deadCount: number | null
  categoryStats: CategoryStats[]
  topBySeeding: TorrentInfo[]
  elderTorrents: TorrentInfo[]
  tagGroupBreakdowns: TagGroupBreakdown[]
  qbitmanageBreakdown: QbitmanageBreakdownItem[]
}

// ---------------------------------------------------------------------------
// SessionStorage cache (Phase 0 — instant restore on page refresh)
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

function useTrackerTorrents({
  trackerId,
  qbtTag,
  rules,
  tagGroups,
  trackerSeedingCount,
  qbitmanageConfig,
}: UseTrackerTorrentsParams): TrackerTorrentsData {
  const enabled = !!qbtTag
  const intervals = usePollingIntervals()

  // Seed query cache from sessionStorage after hydration (Phase 0).
  // This runs in useEffect (client-only) so server and client both
  // start with no data, avoiding a hydration mismatch.
  const queryClient = useQueryClient()
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    const cached = loadSessionCache(trackerId)
    if (cached) {
      queryClient.setQueryData(["tracker-torrents-cached", trackerId] as const, cached)
    }
  }, [trackerId, queryClient])

  // Phase 1: DB-cached torrent data (fast)
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
    enabled,
    staleTime: intervals.trackerRefetchMs,
  })

  // Phase 2: Live qBT torrent data (slow — overrides cached when ready)
  const liveQuery = useQuery({
    queryKey: ["tracker-torrents", trackerId] as const,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/trackers/${trackerId}/torrents`, { signal })
      if (!res.ok) return null
      const data = (await res.json()) as AggregatedTorrentsResponse
      saveSessionCache(trackerId, data)
      return data
    },
    enabled,
    staleTime: intervals.trackerRefetchMs,
  })

  // Active torrent poll (5s) — only starts after live data has resolved
  const activeQuery = useQuery({
    queryKey: ["tracker-torrents-active", trackerId] as const,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/trackers/${trackerId}/torrents?active=true`, { signal })
      if (!res.ok) return null
      return res.json() as Promise<AggregatedTorrentsResponse>
    },
    enabled: enabled && liveQuery.isSuccess,
    refetchInterval: 5_000,
  })

  // Resolve the best available data source: live > cached > sessionStorage placeholder
  const baseData = liveQuery.data ?? cachedQuery.data ?? null
  const stale = !liveQuery.data && !!cachedQuery.data
  const cachedAt = stale ? (cachedQuery.data?.cachedAt ?? null) : null
  const loading = enabled && !baseData && (cachedQuery.isLoading || liveQuery.isLoading)

  // Merge active speeds into the base torrent list
  const torrents = useMemo(() => {
    if (!baseData) return []
    const base = baseData.torrents.map(mapTorrent)
    if (!activeQuery.data) return base

    const activeMap = new Map(
      activeQuery.data.torrents.map(mapTorrent).map((t) => [t.hash, t] as const)
    )
    return base.map((t) => {
      const active = activeMap.get(t.hash)
      if (active) {
        return { ...t, upspeed: active.upspeed, dlspeed: active.dlspeed, state: active.state, progress: active.progress }
      }
      if (t.upspeed > 0 || t.dlspeed > 0 || t.state === "uploading" || t.state === "downloading") {
        return { ...t, upspeed: 0, dlspeed: 0, state: t.state === "downloading" ? "stalledDL" as const : "stalledUP" as const }
      }
      return t
    })
  }, [baseData, activeQuery.data])

  const crossSeedTags = baseData?.crossSeedTags ?? []
  const clientCount = baseData?.clientCount ?? 0
  const noClients = clientCount === 0

  const torrentError = useMemo(() => {
    if (liveQuery.data?.clientErrors?.length) {
      return `Partial data — some clients failed: ${liveQuery.data.clientErrors.join("; ")}`
    }
    if (liveQuery.error && !cachedQuery.data) {
      return "Client offline — no cached data available"
    }
    return null
  }, [liveQuery.data, liveQuery.error, cachedQuery.data])

  const derived = useMemo(() => {
    const seedingTorrents = torrents.filter((t) => SEEDING_STATES.has(t.state))
    const leechingTorrents = torrents.filter((t) => LEECHING_STATES.has(t.state))
    const activelySeedingTorrents = torrents.filter((t) => t.state === "uploading")
    const activelyDownloading = torrents.filter(
      (t) => LEECHING_STATES.has(t.state) && t.dlspeed > 0
    )
    const totalUpSpeed = torrents.reduce((sum, t) => sum + t.upspeed, 0)
    const totalSize = torrents.reduce((sum, t) => sum + t.size, 0)

    const csTagSet = new Set(crossSeedTags.map((t) => t.toLowerCase()))
    const crossSeeded = torrents.filter((t) => {
      const tags = t.tags
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      return tags.some((tag) => csTagSet.has(tag))
    })

    const requiredSeedSeconds =
      rules?.seedTimeHours != null && rules.seedTimeHours > 0 ? rules.seedTimeHours * 3600 : null
    const unsatisfiedTorrents = requiredSeedSeconds
      ? torrents.filter((t) => t.seedingTime < requiredSeedSeconds)
      : []
    const unsatisfiedCount = requiredSeedSeconds ? unsatisfiedTorrents.length : null

    const hnrRiskCount = requiredSeedSeconds
      ? unsatisfiedTorrents.filter(
          (t) => !SEEDING_STATES.has(t.state) && !LEECHING_STATES.has(t.state)
        ).length
      : null

    const deadCount =
      trackerSeedingCount != null ? Math.max(0, seedingTorrents.length - trackerSeedingCount) : null

    const categoryMap = new Map<string, TorrentInfo[]>()
    for (const t of torrents) {
      const cat = t.category || "Uncategorized"
      const arr = categoryMap.get(cat) ?? []
      arr.push(t)
      categoryMap.set(cat, arr)
    }

    const categoryStats: CategoryStats[] = [...categoryMap.entries()]
      .map(([name, items]) => ({
        name,
        count: items.length,
        totalSize: items.reduce((s, t) => s + t.size, 0),
        avgRatio: items.reduce((s, t) => s + t.ratio, 0) / items.length,
        avgSeedTime: items.reduce((s, t) => s + t.seedingTime, 0) / items.length,
        avgSwarmSeeds: items.reduce((s, t) => s + t.numComplete, 0) / items.length,
      }))
      .sort((a, b) => b.count - a.count)

    const topBySeeding = [...seedingTorrents]
      .sort((a, b) => b.seedingTime - a.seedingTime)
      .slice(0, 10)

    const elderTorrents = [...torrents]
      .filter((t) => t.addedOn > 0)
      .sort((a, b) => a.addedOn - b.addedOn)
      .slice(0, 10)

    const unsatisfiedSorted = requiredSeedSeconds
      ? [...unsatisfiedTorrents].sort((a, b) => b.seedingTime - a.seedingTime)
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

export type {
  QbitmanageBreakdownItem,
  TagGroupBreakdown,
  TrackerTorrentsData,
  UseTrackerTorrentsParams,
}
export { useTrackerTorrents }
