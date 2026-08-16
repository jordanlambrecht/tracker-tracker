// src/components/dashboard/__tests__/TrackerOverviewGrid.test.tsx
//
// Regression coverage: an infinite ratio (uploaded > 0, downloaded === 0)
// crosses the wire as `ratio: null` plus `ratioIsInfinite`. The overview
// card used to read `ratio` alone and render it as "—", identical to a
// tracker with no stats at all.

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
  // card — group/age also render "—" when unmeasured, so text queries alone
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
