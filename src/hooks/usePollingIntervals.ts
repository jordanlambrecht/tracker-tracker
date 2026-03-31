// src/hooks/usePollingIntervals.ts

"use client"

import { useQuery } from "@tanstack/react-query"

interface PollingIntervals {
  /** Tracker + dashboard refetch interval in ms (from trackerPollIntervalMinutes) */
  trackerRefetchMs: number
  /** Client snapshot refetch interval in ms (from minimum pollIntervalSeconds across clients) */
  clientRefetchMs: number
}

const DEFAULT_TRACKER_MS = 60_000
const DEFAULT_CLIENT_MS = 5 * 60 * 1000

// Reads poll intervals from app settings and client config

export function usePollingIntervals(): PollingIntervals {
  const { data: settingsData } = useQuery({
    queryKey: ["polling-intervals"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/settings", { signal })
      if (!res.ok) return null
      const settings = await res.json()
      return {
        trackerPollIntervalMinutes: settings.trackerPollIntervalMinutes as number | undefined,
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  const { data: clientsData } = useQuery({
    queryKey: ["polling-intervals-clients"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/clients", { signal })
      if (!res.ok) return null
      const clients = (await res.json()) as { pollIntervalSeconds: number; enabled: boolean }[]
      const enabled = clients.filter((c) => c.enabled)
      if (enabled.length === 0) return null
      return Math.min(...enabled.map((c) => c.pollIntervalSeconds))
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  const trackerRefetchMs = settingsData?.trackerPollIntervalMinutes
    ? settingsData.trackerPollIntervalMinutes * 60 * 1000
    : DEFAULT_TRACKER_MS

  const clientRefetchMs = clientsData ? clientsData * 1000 : DEFAULT_CLIENT_MS

  return { trackerRefetchMs, clientRefetchMs }
}
