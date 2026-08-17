// src/hooks/__tests__/useTrackerTorrents.test.tsx
//
// Tests for useTrackerTorrents:
// - An untagged tracker is a real request now, not a disabled query (issue #152)
// - Live-vs-cached precedence: an empty live result only yields to the cache
//   when the live fetch was also incomplete
//
// Functions:
//   makeTorrent  - Build a TorrentRaw for tests
//   makeResponse - Build an AggregatedTorrentsResponse for tests
//   createWrapper - QueryClientProvider harness

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTrackerTorrents } from "@/hooks/useTrackerTorrents"
import type { TorrentRaw } from "@/lib/fleet"
import type { AggregatedTorrentsResponse } from "@/lib/torrent-utils"

vi.mock("@/hooks/usePollingIntervals", () => ({
  usePollingIntervals: () => ({ trackerRefetchMs: 60_000, clientRefetchMs: 300_000 }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTorrent(hash: string, overrides: Partial<TorrentRaw> = {}): TorrentRaw {
  return {
    hash,
    name: `Torrent ${hash}`,
    state: "stalledUP",
    tags: "",
    category: "movies",
    uploaded: 1000,
    downloaded: 500,
    ratio: 2,
    size: 1_000_000,
    seedingTime: 86_400,
    activeTime: 86_400,
    addedAt: 1_700_000_000,
    completedAt: 1_700_001_000,
    lastActivityAt: 1_700_002_000,
    remaining: 0,
    seedCount: 5,
    leechCount: 1,
    swarmSeeders: 10,
    swarmLeechers: 2,
    uploadSpeed: 0,
    downloadSpeed: 0,
    availability: 1,
    progress: 1,
    clientName: "Home qBT",
    ...overrides,
  }
}

function makeResponse(
  overrides: Partial<AggregatedTorrentsResponse> = {}
): AggregatedTorrentsResponse {
  return {
    torrents: [],
    crossSeedTags: [],
    clientErrors: [],
    clientCount: 1,
    ...overrides,
  }
}

const CACHED_AT = "2026-08-01T00:00:00.000Z"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

/**
 * Route the hook's three endpoints. `live` answers /torrents, `cached` answers
 * /torrents/cached, and the ?active=true poll always answers empty so it never
 * perturbs the base list.
 */
function mockFetch(options: {
  live?: AggregatedTorrentsResponse
  liveStatus?: number
  cached?: AggregatedTorrentsResponse
}) {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes("/cached")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(options.cached ?? makeResponse()) })
    }
    if (url.includes("active=true")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(makeResponse()) })
    }
    const status = options.liveStatus ?? 200
    return Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(options.live ?? makeResponse()),
    })
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function renderTracker(qbtTag: string | null = null) {
  return renderHook(
    () => useTrackerTorrents({ trackerId: 1, qbtTag, isActive: false }),
    { wrapper: createWrapper() }
  )
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTrackerTorrents — untagged trackers", () => {
  it("still fetches when the tracker has no qbtTag", async () => {
    const fetchMock = mockFetch({
      live: makeResponse({ torrents: [makeTorrent("h1")] }),
    })

    const { result } = renderTracker(null)

    await waitFor(() => expect(result.current.torrents).toHaveLength(1))

    const urls = fetchMock.mock.calls.map((c) => c[0])
    expect(urls).toContain("/api/trackers/1/torrents")
    expect(urls).toContain("/api/trackers/1/torrents/cached")
  })

  it("reports loading=false rather than hanging when an untagged tracker resolves nothing", async () => {
    mockFetch({ live: makeResponse() })

    const { result } = renderTracker(null)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.torrents).toHaveLength(0)
    expect(result.current.clientCount).toBe(1)
  })
})

describe("useTrackerTorrents — empty live result vs populated cache", () => {
  it("keeps the cache when the live fetch came back empty AND incomplete", async () => {
    mockFetch({
      // What a client that lost the 5s deadline race produces: HTTP 200,
      // zero torrents, and the failure recorded in clientErrors.
      live: makeResponse({ torrents: [], clientErrors: ["Home qBT: Client deadline exceeded"] }),
      cached: makeResponse({ torrents: [makeTorrent("cached-1")], cachedAt: CACHED_AT }),
    })

    const { result } = renderTracker("aither")

    await waitFor(() => expect(result.current.torrentError).not.toBeNull())

    expect(result.current.torrents.map((t) => t.hash)).toEqual(["cached-1"])
    expect(result.current.stale).toBe(true)
    expect(result.current.cachedAt).toBe(CACHED_AT)
    expect(result.current.torrentError).toContain("Client deadline exceeded")
  })

  it("lets an empty live result win when every client answered", async () => {
    mockFetch({
      // No clientErrors: this is an answer, not a symptom. Showing the cache
      // here would hide a genuinely emptied tracker behind stale data forever.
      live: makeResponse({ torrents: [], clientErrors: [] }),
      cached: makeResponse({ torrents: [makeTorrent("cached-1")], cachedAt: CACHED_AT }),
    })

    const { result } = renderTracker("aither")

    await waitFor(() => expect(result.current.torrents).toHaveLength(0))

    expect(result.current.stale).toBe(false)
    expect(result.current.cachedAt).toBeNull()
  })

  it("prefers a populated live result over the cache", async () => {
    mockFetch({
      live: makeResponse({ torrents: [makeTorrent("live-1")] }),
      cached: makeResponse({ torrents: [makeTorrent("cached-1")], cachedAt: CACHED_AT }),
    })

    const { result } = renderTracker("aither")

    await waitFor(() => expect(result.current.torrents.map((t) => t.hash)).toEqual(["live-1"]))

    expect(result.current.stale).toBe(false)
  })

  it("still prefers a populated live result that reports a partial failure", async () => {
    mockFetch({
      live: makeResponse({
        torrents: [makeTorrent("live-1")],
        clientErrors: ["Client B: timeout"],
      }),
      cached: makeResponse({ torrents: [makeTorrent("cached-1")], cachedAt: CACHED_AT }),
    })

    const { result } = renderTracker("aither")

    await waitFor(() => expect(result.current.torrents.map((t) => t.hash)).toEqual(["live-1"]))

    expect(result.current.stale).toBe(false)
    expect(result.current.torrentError).toContain("Client B: timeout")
  })

  it("falls back to the cache when the live fetch fails outright", async () => {
    mockFetch({
      liveStatus: 502,
      cached: makeResponse({ torrents: [makeTorrent("cached-1")], cachedAt: CACHED_AT }),
    })

    const { result } = renderTracker("aither")

    await waitFor(() => expect(result.current.torrents).toHaveLength(1))

    expect(result.current.stale).toBe(true)
    expect(result.current.cachedAt).toBe(CACHED_AT)
  })
})

describe("useTrackerTorrents — sessionStorage snapshot", () => {
  it("does not let an empty, incomplete live response overwrite the instant-restore snapshot", async () => {
    mockFetch({
      live: makeResponse({ torrents: [], clientErrors: ["Home qBT: Client deadline exceeded"] }),
      cached: makeResponse({ torrents: [makeTorrent("cached-1")], cachedAt: CACHED_AT }),
    })

    const { result } = renderTracker("aither")
    await waitFor(() => expect(result.current.stale).toBe(true))

    const snapshot = JSON.parse(
      sessionStorage.getItem("torrent-cache-1") ?? "null"
    ) as AggregatedTorrentsResponse | null
    expect(snapshot?.torrents.map((t) => t.hash)).toEqual(["cached-1"])
  })

  it("does store an empty live response when every client answered", async () => {
    mockFetch({ live: makeResponse({ torrents: [], clientErrors: [] }) })

    const { result } = renderTracker("aither")
    await waitFor(() => expect(result.current.loading).toBe(false))

    await waitFor(() => expect(sessionStorage.getItem("torrent-cache-1")).not.toBeNull())
    const snapshot = JSON.parse(
      sessionStorage.getItem("torrent-cache-1") as string
    ) as AggregatedTorrentsResponse
    expect(snapshot.torrents).toHaveLength(0)
  })
})
