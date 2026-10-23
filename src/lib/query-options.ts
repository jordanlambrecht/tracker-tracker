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
import type {
  ProwlarrIndexerOption,
  SafeDownloadClient,
  SafeProwlarrInstance,
  TrackerSummary,
} from "@/types/api"

export const clientQueryOptions = queryOptions({
  queryKey: ["clients"] as const,
  queryFn: async ({ signal }) => {
    const res = await fetch("/api/clients", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    })
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
    const res = await fetch("/api/trackers", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    })
    if (!res.ok) return [] as TrackerSummary[]
    return res.json() as Promise<TrackerSummary[]>
  },
})

// Shared by the settings section and the dashboard card, which is hidden when
// this is empty.
export const prowlarrQueryOptions = queryOptions({
  queryKey: ["prowlarr"] as const,
  queryFn: async ({ signal }) => {
    const res = await fetch("/api/prowlarr", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    })
    if (!res.ok) return [] as SafeProwlarrInstance[]
    const data: unknown = await res.json()
    return Array.isArray(data) ? (data as SafeProwlarrInstance[]) : []
  },
})

export const prowlarrIndexerQueryOptions = queryOptions({
  queryKey: ["prowlarr-indexers"] as const,
  queryFn: async ({ signal }) => {
    const res = await fetch("/api/prowlarr/indexers", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    })
    if (!res.ok) return [] as ProwlarrIndexerOption[]
    const data: unknown = await res.json()
    return Array.isArray(data) ? (data as ProwlarrIndexerOption[]) : []
  },
})
