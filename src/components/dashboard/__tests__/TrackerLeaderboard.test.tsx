// src/components/dashboard/__tests__/TrackerLeaderboard.test.tsx
//
// Regression coverage: an infinite ratio (uploaded > 0, downloaded === 0 —
// the best possible standing) crosses the wire as `ratio: null` plus
// `ratioIsInfinite`. Reading `ratio` alone used to sink it to sortValue -1
// (dead last) and render it identical to a tracker with no stats at all.

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { TrackerLeaderboard } from "@/components/dashboard/TrackerLeaderboard"

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
  group: null,
  uploadedBytes: "0",
  downloadedBytes: "0",
  bufferBytes: "0",
}

const baseTracker: TrackerSummary = {
  id: 1,
  name: "placeholder",
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
  latestStats: null,
}

function tracker(overrides: Partial<TrackerSummary>): TrackerSummary {
  return { ...baseTracker, ...overrides }
}

function rowFor(name: string) {
  const rows = screen.getAllByRole("row").slice(1) // drop the header row
  const row = rows.find((r) => within(r).queryByText(name))
  if (!row) throw new Error(`no row found for ${name}`)
  return row
}

// Column order in TrackerLeaderboard's `columns` array: name, ratio, uploaded,
// downloaded, buffer, seeding, age, status.
const RATIO_CELL_INDEX = 1

function ratioCellFor(name: string) {
  return within(rowFor(name)).getAllByRole("cell")[RATIO_CELL_INDEX]
}

describe("TrackerLeaderboard ratio column (infinite ratio)", () => {
  it("sorts a zero-download tracker above a finite ratio, and an unmeasured tracker below both", () => {
    const infinite = tracker({
      id: 1,
      name: "ZeroDownload",
      latestStats: { ...baseStats, ratioIsInfinite: true, ratio: null, uploadedBytes: "1000" },
    })
    const finite = tracker({
      id: 2,
      name: "GoodRatio",
      latestStats: { ...baseStats, ratio: 3.5, uploadedBytes: "1000", downloadedBytes: "285" },
    })
    const unmeasured = tracker({ id: 3, name: "NoData", latestStats: null })

    // Deliberately not fed in ratio order — the default sort must reorder them.
    render(<TrackerLeaderboard trackers={[finite, unmeasured, infinite]} />)

    const rows = screen.getAllByRole("row").slice(1)
    const names = rows.map(
      (r) => within(r).getByText(/^(ZeroDownload|GoodRatio|NoData)$/).textContent
    )
    expect(names).toEqual(["ZeroDownload", "GoodRatio", "NoData"])
  })

  it("renders '∞x' for the infinite-ratio row, distinct from '—' for an unmeasured one", () => {
    const infinite = tracker({
      id: 1,
      name: "ZeroDownload",
      latestStats: { ...baseStats, ratioIsInfinite: true, ratio: null, uploadedBytes: "1000" },
    })
    const unmeasured = tracker({ id: 2, name: "NoData", latestStats: null })

    render(<TrackerLeaderboard trackers={[infinite, unmeasured]} />)

    expect(ratioCellFor("ZeroDownload")).toHaveTextContent("∞x")
    expect(ratioCellFor("NoData")).toHaveTextContent("—")
  })
})
