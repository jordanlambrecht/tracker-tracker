// src/lib/query-options.ts
//
// Shared TanStack Query options for endpoints with multiple consumers.
// Each consumer subscribes to the shared cache via `select`.
//
// On the timeouts below: TanStack ALWAYS passes a `signal` into queryFn, so the
// former `signal ?? AbortSignal.timeout(15_000)` could never reach its right-hand
// side. The ceiling was dead code that still satisfied the security audit's
// "every fetch has a timeout" check. AbortSignal.any composes the two instead of
// choosing between them, so caller-driven cancellation (unmount, refetch
// supersession) still works AND the 15s ceiling can actually fire.

import { queryOptions } from "@tanstack/react-query"
import type { FleetAggregation } from "@/lib/fleet-aggregation"
import type { SafeDownloadClient, TrackerSummary } from "@/types/api"

export const clientQueryOptions = queryOptions({
  queryKey: ["clients"] as const,
  queryFn: async ({ signal }) => {
    const res = await fetch("/api/clients", { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) })
    if (!res.ok) return [] as SafeDownloadClient[]
    return res.json() as Promise<SafeDownloadClient[]>
  },
})

// The DB-cached fleet aggregation. Shared by the Torrent Fleet tab and the dashboard's
// Tag Groups section so one page load computes it once, not twice.
export const fleetCachedQueryOptions = queryOptions({
  queryKey: ["fleet-torrents-cached"] as const,
  queryFn: async ({ signal }) => {
    const res = await fetch("/api/fleet/torrents/cached", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    })
    if (!res.ok) throw new Error(`Fleet data failed: ${res.status}`)
    return res.json() as Promise<FleetAggregation>
  },
})

export const trackerQueryOptions = queryOptions({
  queryKey: ["trackers"] as const,
  queryFn: async ({ signal }) => {
    const res = await fetch("/api/trackers", { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) })
    if (!res.ok) return [] as TrackerSummary[]
    return res.json() as Promise<TrackerSummary[]>
  },
})
