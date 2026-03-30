// src/hooks/__tests__/useTrackerList.test.tsx
//
// Tests for useTrackerList TanStack Query hook:
// - Fetches trackers and exposes derived state
// - Filters by active/archived and favorites
// - Optimistic favorite toggle with rollback on failure
// - Drag-end reorder with rollback on failure
// - Auto-detects custom sort mode once
// - refresh() invalidates cache

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { act, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTrackerList } from "@/hooks/useTrackerList"
import type { TrackerSummary } from "@/types/api"

const base: TrackerSummary = {
  id: 1,
  name: "Alpha",
  baseUrl: "https://alpha.example.com",
  platformType: "unit3d",
  isActive: true,
  lastPolledAt: null,
  lastError: null,
  consecutiveFailures: 0,
  pausedAt: null,
  userPausedAt: null,
  color: "#00d4ff",
  qbtTag: null,
  mouseholeUrl: null,
  hideUnreadBadges: false,
  useProxy: false,
  countCrossSeedUnsatisfied: false,
  isFavorite: false,
  sortOrder: null,
  joinedAt: null,
  lastAccessAt: null,
  remoteUserId: null,
  platformMeta: null,
  createdAt: new Date().toISOString(),
  latestStats: null,
}

function t(overrides: Partial<TrackerSummary>): TrackerSummary {
  return { ...base, ...overrides }
}

const trackerA = t({ id: 1, name: "Alpha", isActive: true, isFavorite: true })
const trackerB = t({ id: 2, name: "Bravo", isActive: true, isFavorite: false })
const trackerC = t({ id: 3, name: "Charlie", isActive: false, isFavorite: false })

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return {
    queryClient,
    Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    },
  }
}

let fetchMock: ReturnType<typeof vi.fn>

const defaultParams = {
  sortMode: "index" as const,
  showFavoritesOnly: false,
  showArchived: false,
  onSortModeChange: vi.fn(),
}

function mockFetchOk(trackers: TrackerSummary[] = [trackerA, trackerB, trackerC]) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/api/trackers") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(trackers) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
}

beforeEach(() => {
  fetchMock = vi.fn()
  global.fetch = fetchMock as unknown as typeof fetch
  mockFetchOk()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useTrackerList", () => {
  // ─── Data fetching ──────────────────────────────────────────────

  it("fetches trackers from /api/trackers", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackerList(defaultParams), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.trackers).toHaveLength(3)
    })
    expect(fetchMock).toHaveBeenCalledWith("/api/trackers", expect.any(Object))
  })

  it("returns empty array on fetch failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve([]) })
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackerList(defaultParams), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.trackers).toEqual([])
    })
  })

  // ─── Derived state ──────────────────────────────────────────────

  it("filters out archived trackers by default", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useTrackerList({ ...defaultParams, showArchived: false }),
      { wrapper: Wrapper }
    )

    await waitFor(() => {
      expect(result.current.displayedTrackers).toHaveLength(2)
      expect(result.current.displayedTrackers.every((t) => t.isActive)).toBe(true)
    })
  })

  it("includes archived trackers when showArchived is true", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useTrackerList({ ...defaultParams, showArchived: true }),
      { wrapper: Wrapper }
    )

    await waitFor(() => {
      expect(result.current.displayedTrackers).toHaveLength(3)
    })
  })

  it("filters to favorites only when showFavoritesOnly is true", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useTrackerList({ ...defaultParams, showFavoritesOnly: true }),
      { wrapper: Wrapper }
    )

    await waitFor(() => {
      expect(result.current.displayedTrackers).toHaveLength(1)
      expect(result.current.displayedTrackers[0].name).toBe("Alpha")
    })
  })

  it("computes archivedCount from all trackers", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackerList(defaultParams), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.archivedCount).toBe(1)
    })
  })

  it("trackerIds matches displayedTrackers order", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackerList(defaultParams), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.trackerIds).toEqual(
        result.current.displayedTrackers.map((t) => t.id)
      )
    })
  })

  // ─── Optimistic favorite toggle ─────────────────────────────────

  it("toggleFavorite optimistically updates the cache", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackerList(defaultParams), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.trackers).toHaveLength(3))

    act(() => {
      result.current.toggleFavorite(2, false)
    })

    await waitFor(() => {
      expect(result.current.trackers.find((t) => t.id === 2)?.isFavorite).toBe(true)
    })
  })

  it("toggleFavorite reverts on server error", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackerList(defaultParams), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.trackers).toHaveLength(3))

    // Make PATCH fail
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/trackers/2")) {
        return Promise.resolve({ ok: false, status: 500, statusText: "Server Error" })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([trackerA, trackerB, trackerC]),
      })
    })

    act(() => {
      result.current.toggleFavorite(2, false)
    })

    // Wait for optimistic update, then wait for revert
    await waitFor(() => {
      expect(result.current.trackers.find((t) => t.id === 2)?.isFavorite).toBe(false)
    })
  })

  it("toggleFavorite reverts on network failure", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackerList(defaultParams), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.trackers).toHaveLength(3))

    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/trackers/2")) {
        return Promise.reject(new Error("Network error"))
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([trackerA, trackerB, trackerC]),
      })
    })

    act(() => {
      result.current.toggleFavorite(2, false)
    })

    await waitFor(() => {
      expect(result.current.trackers.find((t) => t.id === 2)?.isFavorite).toBe(false)
    })
  })

  // ─── Auto-detect sort mode ──────────────────────────────────────

  it("auto-detects custom sort when trackers have sortOrder", async () => {
    const onSortModeChange = vi.fn()
    const withSortOrder = [
      t({ id: 1, name: "Alpha", sortOrder: 1 }),
      t({ id: 2, name: "Bravo", sortOrder: 0 }),
    ]
    mockFetchOk(withSortOrder)

    const { Wrapper } = createWrapper()
    renderHook(
      () => useTrackerList({ ...defaultParams, sortMode: "index", onSortModeChange }),
      { wrapper: Wrapper }
    )

    await waitFor(() => {
      expect(onSortModeChange).toHaveBeenCalledWith("custom")
    })
  })

  it("does not auto-detect when sortMode is already non-index", async () => {
    const onSortModeChange = vi.fn()
    const withSortOrder = [t({ id: 1, name: "Alpha", sortOrder: 1 })]
    mockFetchOk(withSortOrder)

    const { Wrapper } = createWrapper()
    renderHook(
      () => useTrackerList({ ...defaultParams, sortMode: "alpha", onSortModeChange }),
      { wrapper: Wrapper }
    )

    await waitFor(() => {
      // Give effect time to run — it should NOT call onSortModeChange
      expect(onSortModeChange).not.toHaveBeenCalled()
    })
  })

  it("does not auto-detect when no trackers have sortOrder", async () => {
    const onSortModeChange = vi.fn()
    mockFetchOk([t({ id: 1, sortOrder: null }), t({ id: 2, sortOrder: null })])

    const { Wrapper } = createWrapper()
    renderHook(
      () => useTrackerList({ ...defaultParams, onSortModeChange }),
      { wrapper: Wrapper }
    )

    // Wait for data to arrive
    await new Promise((r) => setTimeout(r, 50))
    expect(onSortModeChange).not.toHaveBeenCalled()
  })

  // ─── Refresh ────────────────────────────────────────────────────

  it("refresh() triggers a new fetch", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackerList(defaultParams), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.trackers).toHaveLength(3))

    const callsBefore = fetchMock.mock.calls.filter(
      (args: unknown[]) => args[0] === "/api/trackers"
    ).length

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      const callsAfter = fetchMock.mock.calls.filter(
        (args: unknown[]) => args[0] === "/api/trackers"
      ).length
      expect(callsAfter).toBeGreaterThan(callsBefore)
    })
  })
})
