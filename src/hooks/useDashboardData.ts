// src/hooks/useDashboardData.ts
//
// Functions: useDashboardData

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import { useUpdateCheck } from "@/hooks/useUpdateCheck"
import type { DashboardAlert } from "@/lib/dashboard"
import {
  computeAlerts,
  computeSystemAlerts,
  deleteAllDismissed,
  detectRankChanges,
  fetchDismissedKeys,
  postDismissAlert as persistDismiss,
} from "@/lib/dashboard"
import type { Snapshot, TrackerSummary } from "@/types/api"

interface DashboardData {
  trackers: TrackerSummary[]
  snapshotMap: Map<number, Snapshot[]>
  loading: boolean
  alerts: DashboardAlert[]
  dayRange: DayRange
  setDayRange: (range: DayRange) => void
  dismissAlert: (key: string, type: string) => void
  dismissAllAlerts: () => void
  refresh: () => Promise<void>
}

function useDashboardData(): DashboardData {
  const [trackers, setTrackers] = useState<TrackerSummary[]>([])
  const [snapshotMap, setSnapshotMap] = useState<Map<number, Snapshot[]>>(new Map())
  const [dayRange, setDayRange] = useState<DayRange>(30)
  const [loading, setLoading] = useState(true)
  const [visibleAlerts, setVisibleAlerts] = useState<DashboardAlert[]>([])
  const updateCheck = useUpdateCheck()
  const latestVersionRef = useRef(updateCheck.latestVersion)
  latestVersionRef.current = updateCheck.latestVersion

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

      // Fetch system data for additional alert types (best-effort, don't block on failure)
      const [clientsRes, backupHistoryRes] = await Promise.all([
        fetch("/api/clients", { signal: controller.signal }).catch(() => null),
        fetch("/api/settings/backup/history", { signal: controller.signal }).catch(() => null),
      ])

      const clients: { id: number; name: string; enabled: boolean; lastError: string | null }[] =
        clientsRes?.ok ? await clientsRes.json() : []
      const backupHistory: { createdAt: string; status: string }[] = backupHistoryRes?.ok
        ? await backupHistoryRes.json()
        : []

      const allAlerts = computeAlerts(fetchedTrackers)
      const rankAlerts = detectRankChanges(fetchedTrackers, newMap, 7)
      const systemAlerts = computeSystemAlerts({
        latestVersion: latestVersionRef.current ?? undefined,
        currentVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
        failedBackups: backupHistory.filter((b) => b.status === "failed"),
        clients,
      })
      const combined = [...allAlerts, ...rankAlerts, ...systemAlerts]
      const dismissed = await fetchDismissedKeys()
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

  const dismissAlert = useCallback((key: string, type: string) => {
    persistDismiss(key, type)
    setVisibleAlerts((prev) => prev.filter((a) => a.key !== key))
  }, [])

  const dismissAllAlerts = useCallback(() => {
    deleteAllDismissed()
    setVisibleAlerts((prev) => prev.filter((a) => a.dismissible === false))
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

export type { DashboardData }
export { useDashboardData }
