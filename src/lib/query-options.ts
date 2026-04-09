// src/lib/query-options.ts
//
// Shared TanStack Query options for endpoints with multiple consumers.
// Each consumer subscribes to the shared cache via `select`.

import { queryOptions } from "@tanstack/react-query"
import type { SafeDownloadClient, TrackerSummary } from "@/types/api"

export const clientQueryOptions = queryOptions({
  queryKey: ["clients"] as const,
  queryFn: async ({ signal }) => {
    const res = await fetch("/api/clients", { signal })
    if (!res.ok) return [] as SafeDownloadClient[]
    return res.json() as Promise<SafeDownloadClient[]>
  },
})

export const trackerQueryOptions = queryOptions({
  queryKey: ["trackers"] as const,
  queryFn: async ({ signal }) => {
    const res = await fetch("/api/trackers", { signal })
    if (!res.ok) return [] as TrackerSummary[]
    return res.json() as Promise<TrackerSummary[]>
  },
})
