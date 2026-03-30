// src/hooks/usePollingIntervals.ts

"use client"

import { useQuery } from "@tanstack/react-query"

interface PollingIntervals {
  /** Tracker + dashboard refetch interval in ms (from trackerPollIntervalMinutes) */
  trackerRefetchMs: number
  /** Client snapshot refetch interval in ms (5 min default, not yet user-configurable) */
  clientRefetchMs: number
}

const DEFAULTS: PollingIntervals = {
  trackerRefetchMs: 60_000,
  clientRefetchMs: 5 * 60 * 1000,
}

/**
 * Reads poll intervals from app settings. TanStack Query deduplicates the
 * fetch across all hook instances via the shared ["polling-intervals"] key.
 */
export function usePollingIntervals(): PollingIntervals {
  const { data } = useQuery({
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

  if (!data?.trackerPollIntervalMinutes) return DEFAULTS

  return {
    trackerRefetchMs: data.trackerPollIntervalMinutes * 60 * 1000,
    clientRefetchMs: DEFAULTS.clientRefetchMs,
  }
}
