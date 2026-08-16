// src/hooks/useTrackerList.ts
"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { usePollingIntervals } from "@/hooks/usePollingIntervals"
import type { StatMode } from "@/lib/formatters"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

type SortMode = "index" | "alpha" | "custom" | "stat"

// Raw numeric value for a given StatMode, for sorting only (never for
// display). This mirrors the field mapping inside formatStatValue in
// src/lib/formatters.ts — keep the two in sync if a StatMode's underlying
// field ever changes. Consolidating the two is worthwhile and tracked
// separately; it is a pure refactor, so it does not ride along with a fix.
//
// Returns null when the tracker has no value for that stat — callers must
// treat null as "missing", never coerce it to 0.
function getStatNumericValue(stats: TrackerLatestStats | null, mode: StatMode): number | null {
  if (!stats) return null
  try {
    switch (mode) {
      case "ratio":
        // An infinite ratio arrives as `ratio: null` plus this flag, because
        // JSON cannot carry Infinity (see tracker-serializer.ts). Without the
        // flag check it would land in the "missing" bucket and sort LAST —
        // ranking the best possible account below one at 0.01. tracker-status
        // already treats this state as the healthiest there is.
        if (stats.ratioIsInfinite) return Number.POSITIVE_INFINITY
        return stats.ratio
      case "seeding":
        return stats.seedingCount
      case "uploaded":
        return stats.uploadedBytes ? Number(BigInt(stats.uploadedBytes)) : null
      case "downloaded":
        return stats.downloadedBytes ? Number(BigInt(stats.downloadedBytes)) : null
      case "buffer":
        if (!stats.uploadedBytes || !stats.downloadedBytes) return null
        return Number(BigInt(stats.uploadedBytes) - BigInt(stats.downloadedBytes))
    }
  } catch {
    // Malformed byte string — treat as missing, same as formatBytesFromString
    // does for display, rather than letting BigInt() throw inside a sort.
    return null
  }
}

function sortTrackers(
  trackers: TrackerSummary[],
  mode: SortMode,
  statMode?: StatMode
): TrackerSummary[] {
  const sorted = [...trackers]
  switch (mode) {
    case "alpha":
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case "custom":
      return sorted.sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity))
    case "stat": {
      if (!statMode) return sorted
      return sorted.sort((a, b) => {
        const av = getStatNumericValue(a.latestStats, statMode)
        const bv = getStatNumericValue(b.latestStats, statMode)
        if (av === null) return bv === null ? 0 : 1
        if (bv === null) return -1
        // Two infinite ratios would make the subtraction NaN, which is not a
        // valid comparator result. Equal values keep their relative order.
        if (av === bv) return 0
        return bv - av // descending — highest value first
      })
    }
    default:
      return sorted
  }
}

interface UseTrackerListParams {
  sortMode: SortMode
  statMode: StatMode
  showFavoritesOnly: boolean
  showArchived: boolean
  onSortModeChange: (mode: SortMode) => void
}

interface UseTrackerListReturn {
  trackers: TrackerSummary[]
  loading: boolean
  displayedTrackers: TrackerSummary[]
  trackerIds: number[]
  archivedCount: number
  toggleFavorite: (id: number, current: boolean) => void
  handleDragEnd: (event: DragEndEvent) => void
  refresh: () => void
}

function useTrackerList({
  sortMode,
  statMode,
  showFavoritesOnly,
  showArchived,
  onSortModeChange,
}: UseTrackerListParams): UseTrackerListReturn {
  const queryClient = useQueryClient()
  const intervals = usePollingIntervals()

  const trackersQuery = useQuery({
    ...trackerQueryOptions,
    refetchInterval: intervals.trackerRefetchMs,
  })

  const trackers = trackersQuery.data ?? []

  // Auto-detect custom sort when trackers first arrive with sortOrder data
  const hasAutoDetected = useRef(false)
  useEffect(() => {
    if (hasAutoDetected.current) return
    if (sortMode === "index" && trackers.length > 0 && trackers.some((t) => t.sortOrder !== null)) {
      hasAutoDetected.current = true
      onSortModeChange("custom")
    }
  }, [trackers, sortMode, onSortModeChange])

  // Derived state
  const filteredTrackers = useMemo(
    () =>
      trackers
        .filter((t) => showArchived || t.isActive)
        .filter((t) => !showFavoritesOnly || t.isFavorite),
    [trackers, showArchived, showFavoritesOnly]
  )

  const displayedTrackers = useMemo(
    () => sortTrackers(filteredTrackers, sortMode, statMode),
    [filteredTrackers, sortMode, statMode]
  )

  const trackerIds = useMemo(() => displayedTrackers.map((t) => t.id), [displayedTrackers])

  const archivedCount = useMemo(() => trackers.filter((t) => !t.isActive).length, [trackers])

  const toggleFavorite = useCallback(
    (id: number, current: boolean) => {
      const next = !current
      queryClient.setQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey, (prev) =>
        prev?.map((t) => (t.id === id ? { ...t, isFavorite: next } : t))
      )
      fetch(`/api/trackers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: next }),
      })
        .then((res) => {
          if (!res.ok) throw new Error()
          queryClient.invalidateQueries({ queryKey: trackerQueryOptions.queryKey })
        })
        .catch(() => {
          queryClient.setQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey, (prev) =>
            prev?.map((t) => (t.id === id ? { ...t, isFavorite: current } : t))
          )
        })
    },
    [queryClient]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // Reordering a stat-sorted list is meaningless — the next render just
      // re-sorts it by value. Drag listeners are already suppressed in this
      // mode (see Sidebar's `unlocked` prop), but guard here too so a
      // programmatic drag-end can't sneak a "custom" mode switch through.
      if (sortMode === "stat") return

      const { active, over } = event
      if (!over || active.id === over.id) return

      const snapshot = queryClient.getQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey)

      queryClient.setQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey, (prev) => {
        if (!prev) return prev
        // Order the full set exactly the way the sidebar displays it before
        // computing the move. The raw query cache comes back ordered by
        // createdAt, which matches the display only until the sort mode flips
        // to "custom" at the end of this handler — after that, indices taken
        // from the cache refer to different trackers than the ones the user
        // dragged, which is what jumbled every drag after the first (#166).
        //
        // The whole set is reordered, not just the visible subset, so that
        // filtered-out trackers can't keep stale sortOrder values that
        // collide with the new ones the server assigns.
        const ordered = sortTrackers(prev, sortMode, statMode)
        const oldIndex = ordered.findIndex((t) => t.id === active.id)
        const newIndex = ordered.findIndex((t) => t.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev
        return arrayMove(ordered, oldIndex, newIndex).map((t, i) => ({
          ...t,
          sortOrder: i,
        }))
      })

      const reordered = queryClient.getQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey)
      const ids = reordered?.map((t) => t.id) ?? []

      fetch("/api/trackers/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
        .then((res) => {
          if (!res.ok) throw new Error()
          queryClient.invalidateQueries({ queryKey: trackerQueryOptions.queryKey })
        })
        .catch(() => {
          queryClient.setQueryData(trackerQueryOptions.queryKey, snapshot)
        })

      onSortModeChange("custom")
    },
    [queryClient, onSortModeChange, sortMode, statMode]
  )

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: trackerQueryOptions.queryKey })
  }, [queryClient])

  return {
    trackers,
    loading: trackersQuery.isLoading,
    displayedTrackers,
    trackerIds,
    archivedCount,
    toggleFavorite,
    handleDragEnd,
    refresh,
  }
}

export type { SortMode, UseTrackerListParams, UseTrackerListReturn }
export { sortTrackers, useTrackerList }
