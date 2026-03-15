// src/hooks/useTrackerTorrents.ts
//
// Functions: useTrackerTorrents

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { TrackerRules } from "@/data/tracker-registry"
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
  // Fetch state
  torrents: TorrentInfo[]
  crossSeedTags: string[]
  loading: boolean
  torrentError: string | null
  noClients: boolean
  clientCount: number
  stale: boolean
  cachedAt: string | null

  // Derived stats
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
  const [torrents, setTorrents] = useState<TorrentInfo[]>([])
  const [crossSeedTags, setCrossSeedTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const ready = useRef(false)
  const [torrentError, setTorrentError] = useState<string | null>(null)
  const [noClients, setNoClients] = useState(false)
  const [clientCount, setClientCount] = useState(0)
  const [stale, setStale] = useState(false)
  const [cachedAt, setCachedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!qbtTag) {
        if (!cancelled) setLoading(false)
        return
      }

      // Reset stale state on fresh fetch
      if (!cancelled) {
        setStale(false)
        setCachedAt(null)
      }

      try {
        const res = await fetch(`/api/trackers/${trackerId}/torrents`)
        if (res.ok) {
          const data: AggregatedTorrentsResponse = await res.json()
          if (!cancelled) {
            setTorrents(data.torrents.map(mapTorrent))
            setCrossSeedTags(data.crossSeedTags)
            setClientCount(data.clientCount)
            setNoClients(data.clientCount === 0)
            setTorrentError(
              data.clientErrors.length > 0
                ? `Partial data — some clients failed: ${data.clientErrors.join("; ")}`
                : null
            )
          }
          return
        }

        // Live fetch failed — try cached fallback
        if (res.status !== 400) {
          await fetchCached()
        }
      } catch {
        // Network error — try cached fallback
        await fetchCached()
      } finally {
        if (!cancelled) {
          setLoading(false)
          ready.current = true
        }
      }
    }

    async function fetchCached() {
      // References `cancelled` from the outer useEffect closure — NOT passed as a
      // parameter — so it stays reactive if the component unmounts mid-fetch.
      try {
        const res = await fetch(`/api/trackers/${trackerId}/torrents/cached`)
        if (!res.ok) {
          if (!cancelled) setTorrentError("Client offline — no cached data available")
          return
        }
        const data: AggregatedTorrentsResponse = await res.json()
        if (data.torrents.length === 0) {
          if (!cancelled) setTorrentError("Client offline — no cached data available")
          return
        }
        if (!cancelled) {
          setTorrents(data.torrents.map(mapTorrent))
          setCrossSeedTags(data.crossSeedTags)
          setClientCount(data.clientCount)
          setNoClients(false)
          setStale(true)
          setCachedAt(data.cachedAt ?? null)
          setTorrentError(null)
        }
      } catch {
        if (!cancelled) setTorrentError("Client offline — no cached data available")
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [trackerId, qbtTag])

  // Poll active torrents every 5s for live upload/download speeds.
  // Uses a ref instead of `loading` state to avoid tearing down the
  // interval if loading ever toggled more than once.
  useEffect(() => {
    if (!qbtTag) return
    let cancelled = false

    async function pollActive() {
      if (!ready.current) return
      try {
        const res = await fetch(`/api/trackers/${trackerId}/torrents?active=true`)
        if (!res.ok || cancelled) return
        const data: AggregatedTorrentsResponse = await res.json()
        if (cancelled) return
        const activeTorrents = data.torrents.map(mapTorrent)
        const activeMap = new Map(activeTorrents.map((t) => [t.hash, t]))

        setTorrents((prev) =>
          prev.map((t) => {
            const active = activeMap.get(t.hash)
            if (active) {
              // Update speed and state from live data
              return { ...t, upspeed: active.upspeed, dlspeed: active.dlspeed, state: active.state, progress: active.progress }
            }
            // Not in active list — zero out speeds and clear active state
            if (t.upspeed > 0 || t.dlspeed > 0 || t.state === "uploading" || t.state === "downloading") {
              return { ...t, upspeed: 0, dlspeed: 0, state: t.state === "downloading" ? "stalledDL" : "stalledUP" }
            }
            return t
          })
        )
      } catch {
        // Non-critical — stale speeds are acceptable
      }
    }

    const interval = setInterval(pollActive, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [trackerId, qbtTag])

  const derived = useMemo(() => {
    const seedingTorrents = torrents.filter((t) => SEEDING_STATES.has(t.state))
    const leechingTorrents = torrents.filter((t) => LEECHING_STATES.has(t.state))
    const activelySeedingTorrents = torrents.filter((t) => t.state === "uploading")
    const activelyDownloading = torrents.filter((t) => LEECHING_STATES.has(t.state) && t.dlspeed > 0)
    const totalUpSpeed = torrents.reduce((sum, t) => sum + t.upspeed, 0)
    const totalSize = torrents.reduce((sum, t) => sum + t.size, 0)

    // Cross-seed: torrents that have at least one cross-seed tag (aggregated from all clients)
    const csTagSet = new Set(crossSeedTags.map((t) => t.toLowerCase()))
    const crossSeeded = torrents.filter((t) => {
      const tags = t.tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      return tags.some((tag) => csTagSet.has(tag))
    })

    // Unsatisfied: all torrents below min seed time (regardless of state)
    const requiredSeedSeconds =
      rules?.seedTimeHours != null && rules.seedTimeHours > 0 ? rules.seedTimeHours * 3600 : null
    const unsatisfiedTorrents = requiredSeedSeconds
      ? torrents.filter((t) => t.seedingTime < requiredSeedSeconds)
      : []
    const unsatisfiedCount = requiredSeedSeconds ? unsatisfiedTorrents.length : null

    // H&R risk: unsatisfied AND not seeding AND not downloading — actually at risk
    const hnrRiskCount = requiredSeedSeconds
      ? unsatisfiedTorrents.filter((t) => !SEEDING_STATES.has(t.state) && !LEECHING_STATES.has(t.state)).length
      : null

    // Dead torrents: client has more torrents than tracker reports seeding
    const deadCount =
      trackerSeedingCount != null ? Math.max(0, seedingTorrents.length - trackerSeedingCount) : null

    // --- Category stats ---
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

    // Top 10 by seed time
    const topBySeeding = [...seedingTorrents]
      .sort((a, b) => b.seedingTime - a.seedingTime)
      .slice(0, 10)

    // Elder torrents — oldest by addedOn
    const elderTorrents = [...torrents]
      .filter((t) => t.addedOn > 0)
      .sort((a, b) => a.addedOn - b.addedOn)
      .slice(0, 10)

    // Unsatisfied torrents — sorted by closest to meeting requirement
    const unsatisfiedSorted = requiredSeedSeconds
      ? [...unsatisfiedTorrents].sort((a, b) => b.seedingTime - a.seedingTime)
      : []

    // --- Tag group breakdowns ---
    const tagGroupBreakdowns: TagGroupBreakdown[] = (tagGroups ?? [])
      .map((group) => {
        const allGroupTags = group.members.map((m) => m.tag)
        const memberCounts = group.members
          .map((member) => {
            const count = torrents.filter((t) => parseTorrentTags(t.tags).includes(member.tag)).length
            return { label: member.label, count, color: member.color }
          })
          .filter((m) => m.count > 0)
        const unmatchedCount = torrents.filter((t) => {
          const tags = parseTorrentTags(t.tags)
          return !tags.some((tag) => allGroupTags.includes(tag))
        }).length
        return { group, memberCounts, unmatchedCount }
      })
      .filter((g) => g.memberCounts.length > 0 || (g.group.countUnmatched && g.unmatchedCount > 0))

    const qbitmanageBreakdown: QbitmanageBreakdownItem[] = qbitmanageConfig?.enabled
      ? Object.entries(qbitmanageConfig.tags)
          .filter(([, entry]) => entry.enabled)
          .map(([key, entry]) => {
            const count = torrents.filter((t) => parseTorrentTags(t.tags).includes(entry.tag)).length
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

export { useTrackerTorrents }
export type { TrackerTorrentsData, UseTrackerTorrentsParams, TagGroupBreakdown, QbitmanageBreakdownItem }
