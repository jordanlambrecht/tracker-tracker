// src/components/dashboard/__tests__/TorrentsTabEmptyStates.test.tsx
//
// Which empty state TorrentsTab picks. Before announce matching, a tracker with
// no qBittorrent tag was told to go set one and nothing else was tried; now the
// tag is one of two ways to match, so the states have to say what actually
// happened (issue #152).
//
// Functions:
//   makeData - Build a TrackerTorrentsData with everything empty

import { render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { TorrentsTab } from "@/components/dashboard/TorrentsTab"
import type { TrackerTorrentsData } from "@/hooks/useTrackerTorrents"

vi.mock("@/components/dashboard/useDashboardSettings", () => ({
  useDashboardSettings: () => ({ loaded: true, settings: { enable3DCharts: false } }),
}))

// The populated branch mounts a dozen ECharts instances, which in jsdom have no
// layout and init non-deterministically under parallel load. This test is about
// which branch TorrentsTab picks, so stub the charts out and keep it decisive.
// (each factory inlines its own stub — vi.mock is hoisted above any local const)
vi.mock("@/components/charts/ParallelTorrentsChart", () => ({
  ParallelTorrentsChart: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/StorageSunburst", () => ({
  StorageSunburst: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TagGroupBreakdownChart", () => ({
  TagGroupBreakdownChart: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TorrentActivityHeatmap", () => ({
  TorrentActivityHeatmap: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TorrentAgeScatter2D", () => ({
  TorrentAgeScatter2D: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TorrentAgeScatter3D", () => ({
  TorrentAgeScatter3D: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TorrentAgeTimeline", () => ({
  TorrentAgeTimeline: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TorrentAvgSeedTime", () => ({
  TorrentAvgSeedTime: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TorrentCategoryAcquisition", () => ({
  TorrentCategoryAcquisition: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TorrentCrossSeedDonut", () => ({
  TorrentCrossSeedDonut: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TorrentRatioDistribution", () => ({
  TorrentRatioDistribution: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TorrentSeedTimeDistribution", () => ({
  TorrentSeedTimeDistribution: () => <div data-testid="chart" />,
}))
vi.mock("@/components/charts/TorrentSizeBreakdown", () => ({
  TorrentSizeBreakdown: () => <div data-testid="chart" />,
}))

// LazySection wraps the populated tab in an IntersectionObserver, which jsdom
// does not implement. Report everything as visible so the real layout mounts.
beforeAll(() => {
  class ObserverStub {
    constructor(private readonly cb: IntersectionObserverCallback) {}
    observe(target: Element) {
      this.cb(
        [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      )
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  vi.stubGlobal("IntersectionObserver", ObserverStub)
})

function makeData(overrides: Partial<TrackerTorrentsData> = {}): TrackerTorrentsData {
  return {
    torrents: [],
    crossSeedTags: [],
    loading: false,
    torrentError: null,
    noClients: false,
    clientCount: 1,
    stale: false,
    cachedAt: null,
    seedingTorrents: [],
    leechingTorrents: [],
    activelySeedingTorrents: [],
    activelyDownloading: [],
    totalUpSpeed: 0,
    totalSize: 0,
    crossSeeded: [],
    requiredSeedSeconds: null,
    unsatisfiedTorrents: [],
    unsatisfiedSorted: [],
    unsatisfiedCount: null,
    hnrRiskCount: null,
    deadCount: null,
    categoryStats: [],
    topBySeeding: [],
    elderTorrents: [],
    tagGroupBreakdowns: [],
    qbitmanageBreakdown: [],
    ...overrides,
  }
}

function renderTab(qbtTag: string | null, data: TrackerTorrentsData) {
  return render(
    <TorrentsTab trackerName="LST" qbtTag={qbtTag} accentColor="#00d4ff" data={data} />
  )
}

describe("TorrentsTab empty states", () => {
  it("does not tell an untagged tracker to set a tag as if that were required", () => {
    renderTab(null, makeData())

    expect(screen.getByText(/No torrents matched LST/i)).toBeTruthy()
    expect(screen.getByText(/matched by announce URL/i)).toBeTruthy()
    // The old copy claimed the tag was missing, full stop.
    expect(screen.queryByText(/No qBittorrent tag set for LST/i)).toBeNull()
  })

  it("names the tag when a tagged tracker still resolves nothing", () => {
    renderTab("lst-typo", makeData())

    expect(screen.getByText(/No torrents found for LST/i)).toBeTruthy()
    expect(screen.getByText("lst-typo")).toBeTruthy()
    // Distinct from the untagged state, not the same message reused.
    expect(screen.queryByText(/No torrents matched LST/i)).toBeNull()
  })

  it("renders the tab instead of an empty state once torrents resolve without a tag", () => {
    const data = makeData({
      torrents: [{ hash: "h1" } as TrackerTorrentsData["torrents"][number]],
    })
    renderTab(null, data)

    expect(screen.queryByText(/No torrents matched LST/i)).toBeNull()
    expect(screen.queryByText(/No torrents found for LST/i)).toBeNull()
    expect(screen.getAllByText(/Active Downloads/i).length).toBeGreaterThan(0)
  })

  it("reports an offline client rather than claiming none is configured", () => {
    renderTab("aither", makeData({ noClients: true, torrentError: "Client offline — no cached data available" }))

    expect(screen.getByText(/Client offline/i)).toBeTruthy()
    expect(screen.queryByText(/No download client connected/i)).toBeNull()
  })

  it("still shows the no-client state when there genuinely is no client", () => {
    renderTab("aither", makeData({ noClients: true, clientCount: 0 }))

    expect(screen.getByText(/No download client connected/i)).toBeTruthy()
  })
})
