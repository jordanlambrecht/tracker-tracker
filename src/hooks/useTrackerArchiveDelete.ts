// src/hooks/useTrackerArchiveDelete.ts

"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { extractApiError } from "@/lib/extract-api-error"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

interface UseTrackerArchiveDeleteReturn {
  archiving: boolean
  deleting: boolean
  error: string | null
  clearError: () => void
  /** Resolves to the PATCH response, or null with `error` set. */
  setActive: (isActive: boolean) => Promise<TrackerSummary | null>
  /** Resolves false with `error` set. On success `deleting` stays true while the caller leaves. */
  remove: () => Promise<boolean>
  /** Writes a PATCH response, or a deletion as null, through the shared cache. */
  syncTrackerCache: (next: TrackerSummary | null) => void
}

/**
 * Archive, reactivate and delete for one tracker. Every write goes through the
 * shared ["trackers"] cache. The sidebar and the dashboard render from it,
 * navigating home remounts neither, and its only automatic repair is a poll
 * interval in tens of minutes.
 */
function useTrackerArchiveDelete(trackerId: number): UseTrackerArchiveDeleteReturn {
  const queryClient = useQueryClient()
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const syncTrackerCache = useCallback(
    (next: TrackerSummary | null) => {
      queryClient.setQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey, (prev) => {
        if (!prev) return prev
        if (!next) return prev.filter((t) => t.id !== trackerId)
        return prev.map((t) => (t.id === next.id ? next : t))
      })
      // Not awaited. The refetch only confirms the row just written, and awaiting
      // it would hold the caller's close or redirect for a round trip.
      queryClient.invalidateQueries({ queryKey: trackerQueryOptions.queryKey })
    },
    [queryClient, trackerId]
  )

  const setActive = useCallback(
    async (isActive: boolean): Promise<TrackerSummary | null> => {
      setArchiving(true)
      setError(null)
      try {
        const res = await fetch(`/api/trackers/${trackerId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        })
        if (!res.ok) {
          setError(
            await extractApiError(
              res,
              isActive ? "Failed to reactivate tracker" : "Failed to archive tracker"
            )
          )
          return null
        }
        const updated = (await res.json()) as TrackerSummary
        syncTrackerCache(updated)
        return updated
      } catch {
        setError(isActive ? "Network error while reactivating" : "Network error while archiving")
        return null
      } finally {
        setArchiving(false)
      }
    },
    [trackerId, syncTrackerCache]
  )

  const remove = useCallback(async (): Promise<boolean> => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/trackers/${trackerId}`, { method: "DELETE" })
      if (!res.ok) {
        setError(await extractApiError(res, "Failed to delete tracker"))
        setDeleting(false)
        return false
      }
      syncTrackerCache(null)
      return true
    } catch {
      setError("Network error during delete")
      setDeleting(false)
      return false
    }
  }, [trackerId, syncTrackerCache])

  return {
    archiving,
    deleting,
    error,
    clearError: useCallback(() => setError(null), []),
    setActive,
    remove,
    syncTrackerCache,
  }
}

export type { UseTrackerArchiveDeleteReturn }
export { useTrackerArchiveDelete }
