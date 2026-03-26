// src/hooks/useDashboardData.ts

"use client"

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import type { DayRange } from "@/components/dashboard/DayRangeSidebar"
import { useUpdateCheck } from "@/hooks/useUpdateCheck"
import type { DashboardAlert } from "@/lib/dashboard"
import {
  computeAlerts,
  computeSystemAlerts,
  detectRankChanges,
  fetchDismissedKeys,
  postDismissAlert as persistDismiss,
} from "@/lib/dashboard"
import type { Snapshot, TodayAtAGlance, TrackerSummary } from "@/types/api"

interface DashboardData {
  trackers: TrackerSummary[]
  snapshotMap: Map<number, Snapshot[]>
  loading: boolean
  alerts: DashboardAlert[]
  dayRange: DayRange
  setDayRange: (range: DayRange) => void
  todayData: TodayAtAGlance | null
  todayLoading: boolean
  dismissAlert: (key: string, type: string) => void
  dismissAllAlerts: () => void
  refresh: () => Promise<void>
}

interface UseDashboardDataOptions {
  initialTrackers?: TrackerSummary[]
}

function useDashboardData(options?: UseDashboardDataOptions): DashboardData {
  const [dayRange, setDayRange] = useState<DayRange>(30)
  const queryClient = useQueryClient()
  const updateCheck = useUpdateCheck()

  const dismissedQuery = useQuery({
    queryKey: ["dismissed-alert-keys"],
    queryFn: fetchDismissedKeys,
    staleTime: Infinity,
  })
  const [localDismissedKeys, setLocalDismissedKeys] = useState<Set<string>>(new Set())

  // Merge server-fetched dismissed keys with locally-dismissed keys
  const dismissedKeys = useMemo(() => {
    const merged = new Set(dismissedQuery.data ?? [])
    for (const key of localDismissedKeys) {
      merged.add(key)
    }
    return merged
  }, [dismissedQuery.data, localDismissedKeys])

  // Tracker list query
  const trackersQuery = useQuery({
    queryKey: ["trackers"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/trackers", { signal })
      if (!res.ok) return [] as TrackerSummary[]
      const all: TrackerSummary[] = await res.json()
      return all.filter((t) => t.isActive)
    },
    refetchInterval: 60_000,
    initialData: options?.initialTrackers?.filter((t) => t.isActive),
    initialDataUpdatedAt: options?.initialTrackers ? Date.now() : undefined,
  })

  const trackers = trackersQuery.data ?? []

  // Per-tracker snapshot queries
  const snapshotQueries = useQueries({
    queries: trackers.map((t) => ({
      queryKey: ["snapshots", t.id, dayRange] as const,
      queryFn: async ({ signal }) => {
        const url =
          dayRange === 0
            ? `/api/trackers/${t.id}/snapshots`
            : `/api/trackers/${t.id}/snapshots?days=${dayRange}`
        const res = await fetch(url, { signal })
        if (!res.ok) return [] as Snapshot[]
        return res.json() as Promise<Snapshot[]>
      },
      refetchInterval: 60_000,
    })),
  })

  const todayQuery = useQuery({
    queryKey: ["dashboard-today"],
    queryFn: async ({ signal }): Promise<TodayAtAGlance> => {
      const res = await fetch("/api/dashboard/today", { signal })
      if (!res.ok) throw new Error("Failed to fetch today data")
      return res.json()
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  // Secondary queries for alert computation (less frequent)
  const clientsQuery = useQuery({
    queryKey: ["clients-for-alerts"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/clients", { signal })
      if (!res.ok)
        return [] as { id: number; name: string; enabled: boolean; lastError: string | null }[]
      return res.json() as Promise<
        { id: number; name: string; enabled: boolean; lastError: string | null }[]
      >
    },
    refetchInterval: 5 * 60 * 1000,
  })

  const backupQuery = useQuery({
    queryKey: ["backup-history-for-alerts"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/settings/backup/history", { signal })
      if (!res.ok) return [] as { createdAt: string; status: string }[]
      return res.json() as Promise<{ createdAt: string; status: string }[]>
    },
    refetchInterval: 5 * 60 * 1000,
  })

  // Derived: snapshotMap

  const snapshotData = snapshotQueries.map((q) => q.data)

  // biome-ignore lint/correctness/useExhaustiveDependencies: spreading individual q.data refs which are referentially stable from TanStack Query — avoids new-array-ref instability from the useQueries result array itself
  const snapshotMap = useMemo(() => {
    const map = new Map<number, Snapshot[]>()
    for (let i = 0; i < trackers.length; i++) {
      map.set(trackers[i].id, snapshotData[i] ?? [])
    }
    return map
  }, [trackers, ...snapshotData])

  // Derived: alerts
  const visibleAlerts = useMemo(() => {
    const trackerAlerts = computeAlerts(trackers)
    const rankAlerts = detectRankChanges(trackers, snapshotMap, 7)
    const systemAlerts = computeSystemAlerts({
      latestVersion: updateCheck.latestVersion ?? undefined,
      currentVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
      failedBackups: (backupQuery.data ?? []).filter((b) => b.status === "failed"),
      clients: clientsQuery.data ?? [],
    })
    const combined = [...trackerAlerts, ...rankAlerts, ...systemAlerts]
    return combined.filter((a) => !dismissedKeys.has(a.key))
  }, [
    trackers,
    snapshotMap,
    updateCheck.latestVersion,
    backupQuery.data,
    clientsQuery.data,
    dismissedKeys,
  ])

  // Dismiss handlers
  const dismissAlert = useCallback((key: string, type: string) => {
    persistDismiss(key, type)
    setLocalDismissedKeys((prev) => new Set([...prev, key]))
  }, [])

  const dismissAllAlerts = useCallback(() => {
    const dismissible = visibleAlerts.filter((a) => a.dismissible !== false)
    for (const a of dismissible) {
      persistDismiss(a.key, a.type)
    }
    setLocalDismissedKeys((prev) => {
      const next = new Set(prev)
      for (const a of dismissible) {
        next.add(a.key)
      }
      return next
    })
  }, [visibleAlerts])

  return {
    trackers,
    snapshotMap,
    todayData: todayQuery.data ?? null,
    todayLoading: todayQuery.isLoading,
    loading: trackersQuery.isLoading,
    alerts: visibleAlerts,
    dayRange,
    setDayRange,
    dismissAlert,
    dismissAllAlerts,
    refresh: async () => {
      await trackersQuery.refetch()
      await queryClient.invalidateQueries({ queryKey: ["snapshots"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-today"] })
    },
  }
}

export type { DashboardData, UseDashboardDataOptions }
export { useDashboardData }
