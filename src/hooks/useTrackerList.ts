// src/hooks/useTrackerList.ts
"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { type SortMode, sortTrackers } from "@/lib/sidebar-types"
import type { TrackerSummary } from "@/types/api"

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

  const trackersQuery = useQuery({
    queryKey: ["sidebar-trackers"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/trackers", { signal })
      if (!res.ok) return [] as TrackerSummary[]
      return res.json() as Promise<TrackerSummary[]>
    },
    refetchInterval: 60_000,
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
      queryClient.setQueryData<TrackerSummary[]>(["sidebar-trackers"], (prev) =>
        prev?.map((t) => (t.id === id ? { ...t, isFavorite: next } : t))
      )
      fetch(`/api/trackers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: next }),
      })
        .then((res) => {
          if (!res.ok) throw new Error()
          queryClient.invalidateQueries({ queryKey: ["trackers"] })
        })
        .catch(() => {
          queryClient.setQueryData<TrackerSummary[]>(["sidebar-trackers"], (prev) =>
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

      const snapshot = queryClient.getQueryData<TrackerSummary[]>(["sidebar-trackers"])

      queryClient.setQueryData<TrackerSummary[]>(["sidebar-trackers"], (prev) => {
        if (!prev) return prev
        const oldIndex = prev.findIndex((t) => t.id === active.id)
        const newIndex = prev.findIndex((t) => t.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev
        return arrayMove(prev, oldIndex, newIndex).map((t, i) => ({
          ...t,
          sortOrder: i,
        }))
      })

      const reordered = queryClient.getQueryData<TrackerSummary[]>(["sidebar-trackers"])
      const ids = reordered?.map((t) => t.id) ?? []

      fetch("/api/trackers/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
        .then((res) => {
          if (!res.ok) throw new Error()
          queryClient.invalidateQueries({ queryKey: ["trackers"] })
        })
        .catch(() => {
          queryClient.setQueryData(["sidebar-trackers"], snapshot)
        })

      onSortModeChange("custom")
    },
    [queryClient, onSortModeChange]
  )

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sidebar-trackers"] })
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

export type { UseTrackerListParams, UseTrackerListReturn }
export { useTrackerList }
