// src/components/dashboard/__tests__/TrackerOverviewGrid.test.tsx
//
// Regression coverage: an infinite ratio (uploaded > 0, downloaded === 0)
// crosses the wire as `ratio: null` plus `ratioIsInfinite`. Reading `ratio`
// alone renders it as a dash, identical to a tracker with no stats at all.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { TrackerOverviewGrid } from "@/components/dashboard/TrackerOverviewGrid"

const baseStats: TrackerLatestStats = {
  ratio: null,
  ratioIsInfinite: false,
  seedingCount: 5,
  leechingCount: 0,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  hitAndRuns: null,
  seedbonus: null,
  shareScore: null,
  username: null,
  group: "Power User",
  uploadedBytes: "0",
  downloadedBytes: "0",
  bufferBytes: "0",
}

const baseTracker: TrackerSummary = {
  id: 1,
  name: "ZeroDownload",
  baseUrl: "https://example.com",
  registrySlug: null,
  platformType: "unit3d",
  linked: true,
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
  hasMouseholeToken: false,
  useProxy: false,
  countCrossSeedUnsatisfied: false,
  hideUnreadBadges: false,
  isFavorite: false,
  sortOrder: null,
  joinedAt: null,
  lastAccessAt: null,
  remoteUserId: null,
  platformMeta: null,
  createdAt: new Date().toISOString(),
  latestStats: { ...baseStats, ratioIsInfinite: true, ratio: null, uploadedBytes: "1000" },
}

describe("TrackerOverviewGrid ratio label (infinite ratio)", () => {
  // The ratio label is the only element with this class combination on the
  // card. Group/age also render "—" when unmeasured, so text queries alone
  // would match more than one node.
  function ratioLabelFor(name: string) {
    const card = screen.getByText(name).closest("button")
    expect(card).not.toBeNull()
    return (card as HTMLElement).querySelector(".tabular-nums")
  }

  it("renders '∞x' for a zero-download tracker instead of '—'", () => {
    render(<TrackerOverviewGrid trackers={[baseTracker]} />)
    expect(ratioLabelFor("ZeroDownload")).toHaveTextContent("∞x")
  })

  it("keeps rendering '—' for a tracker with no stats at all", () => {
    const unmeasured: TrackerSummary = { ...baseTracker, id: 2, name: "NoData", latestStats: null }
    render(<TrackerOverviewGrid trackers={[unmeasured]} />)
    expect(ratioLabelFor("NoData")).toHaveTextContent("—")
  })
})

// ---------------------------------------------------------------------------
// The card's registry data (here, the shutdown notice) comes from the entry the
// row's slug names. The stored URL is only a copy and never the key.
// ---------------------------------------------------------------------------

describe("TrackerOverviewGrid registry data", () => {
  // The defunct banner mutates the shared tracker cache when archiving, so it
  // needs a client even though these tests never archive.
  function renderGrid(tracker: TrackerSummary) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <TrackerOverviewGrid trackers={[tracker]} />
      </QueryClientProvider>
    )
  }

  const shutDown: TrackerSummary = { ...baseTracker, id: 3, name: "Gone" }

  it("marks a row defunct from the entry its slug names", () => {
    renderGrid({ ...shutDown, registrySlug: "fearnopeer", baseUrl: "https://moved-since.test" })
    expect(screen.getByText(/Defunct/)).toBeInTheDocument()
  })

  it("takes no registry data from the URL of a row with no slug", () => {
    renderGrid({ ...shutDown, registrySlug: null, baseUrl: "https://fearnopeer.com" })
    expect(screen.queryByText(/Defunct/)).toBeNull()
  })
})

describe("TrackerOverviewGrid on a row the tracker list doesn't carry", () => {
  const moved: TrackerSummary = {
    ...baseTracker,
    id: 4,
    name: "Moved",
    baseUrl: "https://old-host.example",
    latestStats: { ...baseStats, ratio: 2 },
  }

  it("links a linked card to its site and shows its class", () => {
    render(<TrackerOverviewGrid trackers={[moved]} />)
    expect(screen.getByRole("link", { name: "Open Moved" })).toHaveAttribute(
      "href",
      "https://old-host.example"
    )
    expect(screen.getByText("Power User")).toBeInTheDocument()
  })

  it("drops the site link and says it isn't in the list instead of its frozen class", () => {
    render(<TrackerOverviewGrid trackers={[{ ...moved, linked: false }]} />)
    expect(screen.queryByRole("link", { name: "Open Moved" })).toBeNull()
    expect(screen.getByText("Not in list")).toBeInTheDocument()
    expect(screen.queryByText("Power User")).toBeNull()
  })
})
