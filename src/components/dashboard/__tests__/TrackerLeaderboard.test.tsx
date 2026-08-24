// src/components/dashboard/__tests__/TrackerLeaderboard.test.tsx
//
// Regression coverage: an infinite ratio (uploaded > 0, downloaded === 0,
// the best possible standing) crosses the wire as `ratio: null` plus
// `ratioIsInfinite`. Reading `ratio` alone used to sink it to sortValue -1
// (dead last) and render it identical to a tracker with no stats at all.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
const BUFFER_CELL_INDEX = 4

function ratioCellFor(name: string) {
  return within(rowFor(name)).getAllByRole("cell")[RATIO_CELL_INDEX]
}

function bufferCellFor(name: string) {
  return within(rowFor(name)).getAllByRole("cell")[BUFFER_CELL_INDEX]
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

    // Deliberately not fed in ratio order, the default sort must reorder them.
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

describe("TrackerLeaderboard buffer column (signed buffer)", () => {
  it("renders a deficit with its sign and a sane unit", () => {
    const deficit = tracker({
      id: 1,
      name: "Deficit",
      latestStats: {
        ...baseStats,
        uploadedBytes: "10000000000",
        downloadedBytes: "2637286052460",
        bufferBytes: "-2627286052460",
      },
    })

    render(<TrackerLeaderboard trackers={[deficit]} />)

    expect(bufferCellFor("Deficit")).toHaveTextContent("-2.39 TiB")
  })

  it("prefers the stored buffer over recomputing it from the totals", () => {
    // A tracker's own buffer is not always uploaded - downloaded (freeleech,
    // bonus spending), so recomputing here made the leaderboard disagree with
    // the detail page for every tracker that reports its own.
    const reported = tracker({
      id: 1,
      name: "Reported",
      latestStats: {
        ...baseStats,
        uploadedBytes: String(BigInt(5) * BigInt(1024 ** 4)),
        downloadedBytes: String(BigInt(1) * BigInt(1024 ** 4)),
        // Not 4 TiB: the tracker says otherwise, and the tracker is authoritative.
        bufferBytes: String(BigInt(-2) * BigInt(1024 ** 4)),
      },
    })

    render(<TrackerLeaderboard trackers={[reported]} />)

    expect(bufferCellFor("Reported")).toHaveTextContent("-2.00 TiB")
  })

  it("falls back to the derived buffer when none is stored", () => {
    const derived = tracker({
      id: 1,
      name: "Derived",
      latestStats: {
        ...baseStats,
        uploadedBytes: String(BigInt(1024 ** 4)),
        downloadedBytes: String(BigInt(3) * BigInt(1024 ** 4)),
        bufferBytes: null,
      },
    })

    render(<TrackerLeaderboard trackers={[derived]} />)

    expect(bufferCellFor("Derived")).toHaveTextContent("-2.00 TiB")
  })

  it("sorts an unmeasured tracker below a real deficit", async () => {
    // With signed buffers a 0 placeholder would rank "no data" as healthier
    // than an account genuinely down 2 TiB.
    const deficit = tracker({
      id: 1,
      name: "Deficit",
      latestStats: {
        ...baseStats,
        uploadedBytes: "100",
        downloadedBytes: "500",
        bufferBytes: String(BigInt(-2) * BigInt(1024 ** 4)),
      },
    })
    const surplus = tracker({
      id: 2,
      name: "Surplus",
      latestStats: {
        ...baseStats,
        uploadedBytes: "500",
        downloadedBytes: "100",
        bufferBytes: String(BigInt(1024 ** 4)),
      },
    })
    const unmeasured = tracker({ id: 3, name: "NoData", latestStats: null })

    const user = userEvent.setup()
    render(<TrackerLeaderboard trackers={[deficit, unmeasured, surplus]} />)

    // First click sorts by buffer descending.
    await user.click(screen.getByRole("columnheader", { name: /Buffer/ }))

    const names = screen
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getByText(/^(Deficit|Surplus|NoData)$/).textContent)
    expect(names).toEqual(["Surplus", "Deficit", "NoData"])

    expect(bufferCellFor("NoData")).toHaveTextContent("—")
    expect(bufferCellFor("Deficit")).toHaveTextContent("-2.00 TiB")
  })
})
