// src/hooks/useTrackerList.ts
"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { usePollingIntervals } from "@/hooks/usePollingIntervals"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

type SortMode = "index" | "alpha" | "custom"

function sortTrackers(trackers: TrackerSummary[], mode: SortMode): TrackerSummary[] {
  const sorted = [...trackers]
  switch (mode) {
    case "alpha":
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case "custom":
      return sorted.sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity))
    default:
      return sorted
  }
}

interface UseTrackerListParams {
  sortMode: SortMode
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
    () => sortTrackers(filteredTrackers, sortMode),
    [filteredTrackers, sortMode]
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
      const { active, over } = event
      if (!over || active.id === over.id) return

      const snapshot = queryClient.getQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey)

      queryClient.setQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey, (prev) => {
        if (!prev) return prev
        const oldIndex = prev.findIndex((t) => t.id === active.id)
        const newIndex = prev.findIndex((t) => t.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev
        return arrayMove(prev, oldIndex, newIndex).map((t, i) => ({
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
    [queryClient, onSortModeChange]
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
