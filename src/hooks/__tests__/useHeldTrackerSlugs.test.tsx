// src/hooks/__tests__/useHeldTrackerSlugs.test.tsx
//
// Add Tracker marks a tracker as added when any row uses its slug, archived rows
// included, and says which by whether that row is active.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { useHeldTrackerSlugs } from "@/hooks/useHeldTrackerSlugs"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

function row(id: number, registrySlug: string | null, isActive: boolean) {
  return { id, registrySlug, isActive } as unknown as TrackerSummary
}

function heldSlugsOf(rows?: TrackerSummary[]) {
  // Never stale, so the hook reads the cached rows without fetching.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  })
  if (rows) queryClient.setQueryData(trackerQueryOptions.queryKey, rows)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useHeldTrackerSlugs(), { wrapper }).result.current
}

describe("useHeldTrackerSlugs", () => {
  it("maps each slug a row uses to whether that row is active", () => {
    expect(
      heldSlugsOf([row(1, "aither", true), row(2, "orpheus", false), row(3, null, false)])
    ).toEqual(
      new Map([
        ["aither", true],
        ["orpheus", false],
      ])
    )
  })

  it.each([
    ["the active row first", [row(1, "aither", true), row(2, "aither", false)]],
    ["the archived row first", [row(1, "aither", false), row(2, "aither", true)]],
  ])("labels a slug two rows share by its active row, with %s", (_order, rows) => {
    expect(heldSlugsOf(rows)).toEqual(new Map([["aither", true]]))
  })

  // The dialog can open before the list has loaded.
  it("holds nothing while the list loads", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}))
    try {
      expect(heldSlugsOf()).toEqual(new Map())
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
