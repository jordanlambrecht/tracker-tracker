// src/hooks/useDashboardData.ts
"use client"

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { usePollingIntervals } from "@/hooks/usePollingIntervals"
import { useUpdateCheck } from "@/hooks/useUpdateCheck"
import type { DashboardAlert } from "@/lib/dashboard"
import {
  computeAlerts,
  computeSystemAlerts,
  detectRankChanges,
  fetchDismissedKeys,
  postDismissAlert as persistDismiss,
} from "@/lib/dashboard"
import { clientQueryOptions, trackerQueryOptions } from "@/lib/query-options"
import type {
  DayRange,
  SafeDownloadClient,
  Snapshot,
  TodayAtAGlance,
  TrackerSummary,
} from "@/types/api"

export function selectActiveTrackers(trackers: TrackerSummary[]) {
  return trackers.filter((t) => t.isActive)
}

export function selectClientsForAlerts(clients: SafeDownloadClient[]) {
  return clients.map(({ id, name, enabled, lastError }) => ({ id, name, enabled, lastError }))
}

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
  snapshotRetentionDays?: number | null
}

function useDashboardData(options?: UseDashboardDataOptions): DashboardData {
  const [dayRange, setDayRange] = useState<DayRange>(30)
  const queryClient = useQueryClient()
  const updateCheck = useUpdateCheck()
  const intervals = usePollingIntervals()

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
    ...trackerQueryOptions,
    refetchInterval: intervals.trackerRefetchMs,
    select: selectActiveTrackers,
    initialData: options?.initialTrackers,
    initialDataUpdatedAt: options?.initialTrackers ? Date.now() : undefined,
  })

  const trackers = trackersQuery.data ?? []

  // Fleet snapshot query (all trackers in one request)
  const fleetSnapshotsQuery = useQuery({
    queryKey: ["tracker-snapshots-fleet", dayRange],
    queryFn: async ({ signal }) => {
      const url =
        dayRange === 0
          ? "/api/trackers/snapshots/fleet"
          : `/api/trackers/snapshots/fleet?days=${dayRange}`
      const res = await fetch(url, { signal })
      if (!res.ok) throw new Error(`Fleet snapshot fetch failed: ${res.status}`)
      return res.json() as Promise<Record<string, Snapshot[]>>
    },
    placeholderData: keepPreviousData,
    refetchInterval: intervals.trackerRefetchMs,
  })

  const todayQuery = useQuery({
    queryKey: ["dashboard-today"],
    queryFn: async ({ signal }): Promise<TodayAtAGlance> => {
      const res = await fetch("/api/dashboard/today", { signal })
      if (!res.ok) throw new Error("Failed to fetch today data")
      return res.json()
    },
    staleTime: intervals.trackerRefetchMs,
    refetchInterval: intervals.trackerRefetchMs,
  })

  // Secondary queries for alert computation (sidebar's 10s poll drives fetches)
  const clientsQuery = useQuery({
    ...clientQueryOptions,
    select: selectClientsForAlerts,
  })

  const backupQuery = useQuery({
    queryKey: ["backup-history-for-alerts"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/settings/backup/history", { signal })
      if (!res.ok) throw new Error(`Backup history fetch failed: ${res.status}`)
      return res.json() as Promise<{ createdAt: string; status: string }[]>
    },
    refetchInterval: intervals.clientRefetchMs,
  })

  // Derived: snapshotMap (built from fleet response keyed by tracker ID)
  const snapshotMap = useMemo(() => {
    const map = new Map<number, Snapshot[]>()
    const data = fleetSnapshotsQuery.data
    if (data) {
      for (const [key, snapshots] of Object.entries(data)) {
        map.set(Number(key), snapshots)
      }
    }
    return map
  }, [fleetSnapshotsQuery.data])

  // Derived: alerts
  // System alerts depend on client-only queries (update check, clients, backups).
  // Only include them once those queries have fetched to avoid SSR/client mismatch.
  const clientQueriesReady =
    !updateCheck.loading &&
    !clientsQuery.isLoading &&
    !backupQuery.isLoading &&
    !clientsQuery.isError &&
    !backupQuery.isError

  const visibleAlerts = useMemo(() => {
    const trackerAlerts = computeAlerts(trackers)
    const rankAlerts = detectRankChanges(trackers, snapshotMap, 7)
    const systemAlerts = clientQueriesReady
      ? computeSystemAlerts({
          latestVersion: updateCheck.latestVersion ?? undefined,
          currentVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
          failedBackups: (backupQuery.data ?? []).filter((b) => b.status === "failed"),
          clients: clientsQuery.data ?? [],
          snapshotRetentionDays: options?.snapshotRetentionDays ?? null,
        })
      : []
    const combined = [...trackerAlerts, ...rankAlerts, ...systemAlerts]
    return combined.filter((a) => !dismissedKeys.has(a.key))
  }, [
    trackers,
    snapshotMap,
    clientQueriesReady,
    updateCheck.latestVersion,
    backupQuery.data,
    clientsQuery.data,
    dismissedKeys,
    options?.snapshotRetentionDays,
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

  const refresh = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: trackerQueryOptions.queryKey })
    queryClient.invalidateQueries({ queryKey: ["tracker-snapshots-fleet"] })
    queryClient.invalidateQueries({ queryKey: ["download-client-snapshots"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard-today"] })
  }, [queryClient])

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
    refresh,
  }
}

export type { DashboardData, UseDashboardDataOptions }
export { useDashboardData }
