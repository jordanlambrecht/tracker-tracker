// src/hooks/useDashboardData.ts
//
// Functions: useDashboardData

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import type { DashboardAlert } from "@/lib/dashboard"
import {
  computeAlerts,
  detectRankChanges,
  getDismissedAlerts,
  dismissAlert as persistDismiss,
} from "@/lib/dashboard"
import type { Snapshot, TrackerSummary } from "@/types/api"

interface DashboardData {
  trackers: TrackerSummary[]
  snapshotMap: Map<number, Snapshot[]>
  loading: boolean
  alerts: DashboardAlert[]
  dayRange: DayRange
  setDayRange: (range: DayRange) => void
  dismissAlert: (key: string) => void
  dismissAllAlerts: () => void
  refresh: () => Promise<void>
}

function useDashboardData(): DashboardData {
  const [trackers, setTrackers] = useState<TrackerSummary[]>([])
  const [snapshotMap, setSnapshotMap] = useState<Map<number, Snapshot[]>>(new Map())
  const [dayRange, setDayRange] = useState<DayRange>(30)
  const [loading, setLoading] = useState(true)
  const [visibleAlerts, setVisibleAlerts] = useState<DashboardAlert[]>([])

  const abortRef = useRef<AbortController | null>(null)
  const lastFetchRef = useRef(0)

  const loadData = useCallback(async () => {
    // Abort any in-flight request so day-range changes restart immediately
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const trackersRes = await fetch("/api/trackers", { signal: controller.signal })
      if (!trackersRes.ok) return

      const allTrackers: TrackerSummary[] = await trackersRes.json()
      const fetchedTrackers = allTrackers.filter((t) => t.isActive)

      const snapshotEntries = await Promise.all(
        fetchedTrackers.map(async (t) => {
          try {
            const url =
              dayRange === 0
                ? `/api/trackers/${t.id}/snapshots`
                : `/api/trackers/${t.id}/snapshots?days=${dayRange}`
            const res = await fetch(url, { signal: controller.signal })
            if (!res.ok) return [t.id, []] as [number, Snapshot[]]
            const snaps: Snapshot[] = await res.json()
            return [t.id, snaps] as [number, Snapshot[]]
          } catch {
            return [t.id, []] as [number, Snapshot[]]
          }
        })
      )

      if (controller.signal.aborted) return

      const newMap = new Map<number, Snapshot[]>(snapshotEntries)

      setTrackers(fetchedTrackers)
      setSnapshotMap(newMap)

      const allAlerts = computeAlerts(fetchedTrackers)
      const rankAlerts = detectRankChanges(fetchedTrackers, newMap, 7)
      const combined = [...allAlerts, ...rankAlerts]
      const dismissed = getDismissedAlerts()
      setVisibleAlerts(combined.filter((a) => !dismissed.has(a.key)))
      lastFetchRef.current = Date.now()
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [dayRange])

  useEffect(() => {
    loadData()

    const interval = setInterval(() => {
      if (document.visibilityState === "hidden") return
      loadData()
    }, 60_000)

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastFetchRef.current < 2 * 60 * 1000) return // Skip refetch if data is < 2 min old
      loadData()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      abortRef.current?.abort()
    }
  }, [loadData])

  const dismissAlert = useCallback((key: string) => {
    persistDismiss(key)
    setVisibleAlerts((prev) => prev.filter((a) => a.key !== key))
  }, [])

  const dismissAllAlerts = useCallback(() => {
    setVisibleAlerts((prev) => {
      for (const alert of prev) persistDismiss(alert.key)
      return []
    })
  }, [])

  return {
    trackers,
    snapshotMap,
    loading,
    alerts: visibleAlerts,
    dayRange,
    setDayRange,
    dismissAlert,
    dismissAllAlerts,
    refresh: loadData,
  }
}

export { useDashboardData }
export type { DashboardData }
