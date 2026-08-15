// src/hooks/__tests__/useTrackerList.test.tsx
//
// Tests for useTrackerList TanStack Query hook:
// - Fetches trackers and exposes derived state
// - Filters by active/archived and favorites
// - Optimistic favorite toggle with rollback on failure
// - Drag-end reorder with rollback on failure
// - Auto-detects custom sort mode once
// - refresh() invalidates cache
// - "stat" sort mode: descending order, nulls last, re-sorts on statMode
//   change, and suppresses drag-end reordering

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { act, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sortTrackers, useTrackerList } from "@/hooks/useTrackerList"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

const base: TrackerSummary = {
  id: 1,
  name: "Alpha",
  baseUrl: "https://alpha.example.com",
  platformType: "unit3d",
  isActive: true,
  lastPolledAt: null,
  lastError: null,
  lastErrorAt: null,
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

const baseStats: TrackerLatestStats = {
  ratio: null,
  ratioIsInfinite: false,
  uploadedBytes: null,
  downloadedBytes: null,
  bufferBytes: null,
  seedingCount: null,
  leechingCount: null,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  hitAndRuns: null,
  seedbonus: null,
  shareScore: null,
  username: null,
  group: null,
}

function stats(overrides: Partial<TrackerLatestStats>): TrackerLatestStats {
  return { ...baseStats, ...overrides }
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
  statMode: "ratio" as const,
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
    const { result } = renderHook(() => useTrackerList({ ...defaultParams, showArchived: false }), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.displayedTrackers).toHaveLength(2)
      expect(result.current.displayedTrackers.every((t) => t.isActive)).toBe(true)
    })
  })

  it("includes archived trackers when showArchived is true", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackerList({ ...defaultParams, showArchived: true }), {
      wrapper: Wrapper,
    })

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
      expect(result.current.trackerIds).toEqual(result.current.displayedTrackers.map((t) => t.id))
    })
  })

  // ─── Optimistic favorite toggle ─────────────────────────────────

  it("toggleFavorite optimistically updates the cache", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackerList(defaultParams), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.trackers).toHaveLength(3))

    // After PATCH succeeds, the invalidation refetch should return updated data
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/trackers/2")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([trackerA, { ...trackerB, isFavorite: true }, trackerC]),
      })
    })

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
    renderHook(() => useTrackerList({ ...defaultParams, sortMode: "index", onSortModeChange }), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(onSortModeChange).toHaveBeenCalledWith("custom")
    })
  })

  it("does not auto-detect when sortMode is already non-index", async () => {
    const onSortModeChange = vi.fn()
    const withSortOrder = [t({ id: 1, name: "Alpha", sortOrder: 1 })]
    mockFetchOk(withSortOrder)

    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useTrackerList({ ...defaultParams, sortMode: "alpha", onSortModeChange }),
      { wrapper: Wrapper }
    )

    // Wait for the data to actually load — only once trackers has arrived
    // has the auto-detect effect had a chance to run and (wrongly) fire.
    await waitFor(() => expect(result.current.trackers).toHaveLength(1))

    expect(onSortModeChange).not.toHaveBeenCalled()
  })

  it("does not let auto-detect stomp an explicit stat sort selection", async () => {
    const onSortModeChange = vi.fn()
    const withSortOrder = [t({ id: 1, name: "Alpha", sortOrder: 1 })]
    mockFetchOk(withSortOrder)

    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useTrackerList({ ...defaultParams, sortMode: "stat", onSortModeChange }),
      { wrapper: Wrapper }
    )

    // Wait for the data to actually load — only once trackers has arrived
    // has the auto-detect effect had a chance to run and (wrongly) fire.
    await waitFor(() => expect(result.current.trackers).toHaveLength(1))

    expect(onSortModeChange).not.toHaveBeenCalled()
  })

  it("does not auto-detect when no trackers have sortOrder", async () => {
    const onSortModeChange = vi.fn()
    mockFetchOk([t({ id: 1, sortOrder: null }), t({ id: 2, sortOrder: null })])

    const { Wrapper } = createWrapper()
    renderHook(() => useTrackerList({ ...defaultParams, onSortModeChange }), { wrapper: Wrapper })

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

// ---------------------------------------------------------------------------
// sortTrackers
// ---------------------------------------------------------------------------

describe("sortTrackers", () => {
  const trackers: TrackerSummary[] = [
    { ...base, id: 1, name: "Charlie", sortOrder: 2 },
    { ...base, id: 2, name: "Alpha", sortOrder: 0 },
    { ...base, id: 3, name: "Bravo", sortOrder: 1 },
  ]

  it("returns input order for index mode", () => {
    const result = sortTrackers(trackers, "index")
    expect(result.map((t) => t.name)).toEqual(["Charlie", "Alpha", "Bravo"])
  })

  it("sorts alphabetically for alpha mode", () => {
    const result = sortTrackers(trackers, "alpha")
    expect(result.map((t) => t.name)).toEqual(["Alpha", "Bravo", "Charlie"])
  })

  it("sorts by sortOrder for custom mode", () => {
    const result = sortTrackers(trackers, "custom")
    expect(result.map((t) => t.name)).toEqual(["Alpha", "Bravo", "Charlie"])
  })

  it("treats null sortOrder as Infinity in custom mode", () => {
    const withNull: TrackerSummary[] = [
      { ...base, id: 1, name: "A", sortOrder: null },
      { ...base, id: 2, name: "B", sortOrder: 0 },
    ]
    const result = sortTrackers(withNull, "custom")
    expect(result.map((t) => t.name)).toEqual(["B", "A"])
  })

  it("does not mutate the input array", () => {
    const original = [...trackers]
    sortTrackers(trackers, "alpha")
    expect(trackers).toEqual(original)
  })

  // ─── stat mode (issue #48) ────────────────────────────────────────

  describe("stat mode", () => {
    const withRatios: TrackerSummary[] = [
      t({ id: 1, name: "Low", latestStats: stats({ ratio: 1.5 }) }),
      t({ id: 2, name: "High", latestStats: stats({ ratio: 3.5 }) }),
      t({ id: 3, name: "Mid", latestStats: stats({ ratio: 2.5 }) }),
    ]

    it("sorts descending by the selected stat's numeric value", () => {
      const result = sortTrackers(withRatios, "stat", "ratio")
      expect(result.map((x) => x.name)).toEqual(["High", "Mid", "Low"])
    })

    it("sorts trackers with a missing value last, never as if it were 0", () => {
      const withMissing: TrackerSummary[] = [
        t({ id: 1, name: "NullStats", latestStats: null }),
        t({ id: 2, name: "Negative", latestStats: stats({ ratio: -5 }) }),
        t({ id: 3, name: "NullRatio", latestStats: stats({ ratio: null }) }),
        t({ id: 4, name: "Positive", latestStats: stats({ ratio: 1 }) }),
      ]
      const result = sortTrackers(withMissing, "stat", "ratio")
      // A tracker with no value must sort after a real value that is even
      // negative — it must never be treated as though its value were 0.
      expect(result.map((x) => x.name)).toEqual(["Positive", "Negative", "NullStats", "NullRatio"])
    })

    it("resorts by a different stat mode", () => {
      const trackers: TrackerSummary[] = [
        t({ id: 1, name: "A", latestStats: stats({ ratio: 5, seedingCount: 1 }) }),
        t({ id: 2, name: "B", latestStats: stats({ ratio: 1, seedingCount: 9 }) }),
      ]
      expect(sortTrackers(trackers, "stat", "ratio").map((x) => x.name)).toEqual(["A", "B"])
      expect(sortTrackers(trackers, "stat", "seeding").map((x) => x.name)).toEqual(["B", "A"])
    })

    it("returns input order when statMode is not provided", () => {
      const result = sortTrackers(withRatios, "stat")
      expect(result.map((x) => x.name)).toEqual(["Low", "High", "Mid"])
    })

    // An infinite ratio crosses the wire as `ratio: null` plus the flag, because
    // JSON cannot carry Infinity (tracker-serializer.ts). Reading `ratio` alone
    // dropped it into the "missing" bucket, ranking the best possible account
    // below one at 0.01. Fixtures use the real wire shape deliberately — the
    // serializer never emits `ratio: Infinity`, so testing that would prove
    // nothing about production data.
    it("sorts an infinite ratio first, above every finite ratio", () => {
      const trackers: TrackerSummary[] = [
        t({ id: 1, name: "Tiny", latestStats: stats({ ratio: 0.01 }) }),
        t({ id: 2, name: "Infinite", latestStats: stats({ ratio: null, ratioIsInfinite: true }) }),
        t({ id: 3, name: "Highest finite", latestStats: stats({ ratio: 99 }) }),
      ]
      const result = sortTrackers(trackers, "stat", "ratio")
      expect(result.map((x) => x.name)).toEqual(["Infinite", "Highest finite", "Tiny"])
    })

    it("still sorts an unmeasured ratio last, even though infinite also arrives as null", () => {
      const trackers: TrackerSummary[] = [
        t({ id: 1, name: "Unmeasured", latestStats: stats({ ratio: null }) }),
        t({ id: 2, name: "Infinite", latestStats: stats({ ratio: null, ratioIsInfinite: true }) }),
        t({ id: 3, name: "Finite", latestStats: stats({ ratio: 2 }) }),
      ]
      const result = sortTrackers(trackers, "stat", "ratio")
      expect(result.map((x) => x.name)).toEqual(["Infinite", "Finite", "Unmeasured"])
    })

    // Finite FIRST so the sort has observable work to do. Listing the infinite rows
    // first would make the assertion hold even if `stat` sorting were a no-op.
    it("ranks infinite ratios above a finite one and keeps tied rows in input order", () => {
      const trackers: TrackerSummary[] = [
        t({ id: 3, name: "Finite", latestStats: stats({ ratio: 5 }) }),
        t({ id: 1, name: "InfA", latestStats: stats({ ratio: null, ratioIsInfinite: true }) }),
        t({ id: 2, name: "InfB", latestStats: stats({ ratio: null, ratioIsInfinite: true }) }),
      ]
      const result = sortTrackers(trackers, "stat", "ratio")
      expect(result.map((x) => x.name)).toEqual(["InfA", "InfB", "Finite"])
    })
  })
})

// ─── Issue #166: reorder must follow the displayed order ──────────────────
// "Reordering works, until you move a second tracker, then the order is all
// jumbled up." The query cache arrives ordered by createdAt while the sidebar
// displays by sortOrder, so drag indices taken from the cache referred to
// different trackers than the ones the user dragged.
describe("useTrackerList drag reorder (issue #166)", () => {
  // createdAt order (what the API returns) deliberately differs from the
  // sortOrder order (what the sidebar shows).
  const alpha = t({ id: 1, name: "Alpha", sortOrder: 2 })
  const bravo = t({ id: 2, name: "Bravo", sortOrder: 0 })
  const charlie = t({ id: 3, name: "Charlie", sortOrder: 1 })

  const drag = (activeId: number, overId: number) =>
    ({ active: { id: activeId }, over: { id: overId } }) as never

  const orderOf = (queryClient: QueryClient) =>
    [...((queryClient.getQueryData(["trackers"]) as TrackerSummary[]) ?? [])]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((x) => x.name)

  it("moves the tracker the user actually dragged", async () => {
    mockFetchOk([alpha, bravo, charlie])
    const { queryClient, Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useTrackerList({ ...defaultParams, sortMode: "custom", showArchived: true }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.displayedTrackers).toHaveLength(3))
    expect(result.current.displayedTrackers.map((x) => x.name)).toEqual([
      "Bravo",
      "Charlie",
      "Alpha",
    ])

    act(() => result.current.handleDragEnd(drag(1, 2)))
    expect(orderOf(queryClient)).toEqual(["Alpha", "Bravo", "Charlie"])
  })

  it("stays correct on a second consecutive drag", async () => {
    mockFetchOk([alpha, bravo, charlie])
    const { queryClient, Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useTrackerList({ ...defaultParams, sortMode: "custom", showArchived: true }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.displayedTrackers).toHaveLength(3))

    act(() => result.current.handleDragEnd(drag(1, 2)))
    act(() => result.current.handleDragEnd(drag(3, 2)))

    expect(orderOf(queryClient)).toEqual(["Alpha", "Charlie", "Bravo"])
  })

  it("assigns a contiguous sortOrder covering every tracker", async () => {
    mockFetchOk([alpha, bravo, charlie])
    const { queryClient, Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useTrackerList({ ...defaultParams, sortMode: "custom", showArchived: true }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.displayedTrackers).toHaveLength(3))

    act(() => result.current.handleDragEnd(drag(1, 2)))

    const all = (queryClient.getQueryData(["trackers"]) as TrackerSummary[]) ?? []
    expect(all.map((x) => x.sortOrder).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 1, 2])
  })
})

// ─── Issue #48: sort by the currently-selected datapoint ──────────────────
describe("useTrackerList stat sort mode (issue #48)", () => {
  const low = t({ id: 1, name: "Low", latestStats: stats({ ratio: 1, seedingCount: 50 }) })
  const high = t({ id: 2, name: "High", latestStats: stats({ ratio: 9, seedingCount: 10 }) })
  const mid = t({ id: 3, name: "Mid", latestStats: stats({ ratio: 5, seedingCount: 30 }) })

  it("displayedTrackers re-sorts when statMode changes", async () => {
    mockFetchOk([low, high, mid])
    const { Wrapper } = createWrapper()
    const { result, rerender } = renderHook(
      (props: { statMode: "ratio" | "seeding" }) =>
        useTrackerList({ ...defaultParams, sortMode: "stat", statMode: props.statMode }),
      { wrapper: Wrapper, initialProps: { statMode: "ratio" } }
    )

    await waitFor(() => {
      expect(result.current.displayedTrackers.map((x) => x.name)).toEqual(["High", "Mid", "Low"])
    })

    rerender({ statMode: "seeding" })

    await waitFor(() => {
      expect(result.current.displayedTrackers.map((x) => x.name)).toEqual(["Low", "Mid", "High"])
    })
  })

  it("suppresses drag-end reordering while sort mode is stat", async () => {
    mockFetchOk([low, high, mid])
    const onSortModeChange = vi.fn()
    const { queryClient, Wrapper } = createWrapper()
    const { result } = renderHook(
      () =>
        useTrackerList({
          ...defaultParams,
          sortMode: "stat",
          statMode: "ratio",
          onSortModeChange,
        }),
      { wrapper: Wrapper }
    )

    await waitFor(() => expect(result.current.displayedTrackers).toHaveLength(3))
    const before = queryClient.getQueryData(["trackers"])

    act(() => {
      result.current.handleDragEnd({
        active: { id: 1 },
        over: { id: 2 },
      } as never)
    })

    expect(onSortModeChange).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(["trackers"])).toBe(before)
  })
})
