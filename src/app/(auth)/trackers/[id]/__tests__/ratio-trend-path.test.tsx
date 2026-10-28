// src/app/(auth)/trackers/[id]/__tests__/ratio-trend-path.test.tsx
//
// The ratio card's arrow and the "24h:" line must come from the unbucketed two
// days the page loads, not from the all-time series, which keeps one row per
// day on an old tracker. Covers the page query, the client and the card.

import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Snapshot, TrackerSummary } from "@/types/api"

const getSnapshotsForTracker = vi.fn()
vi.mock("@/lib/server-data", () => ({
  getSnapshotsForTracker: (...args: unknown[]) => getSnapshotsForTracker(...args),
  getTagGroupsWithMembers: async () => [],
  getTrackerForClient: async () => tracker,
}))
vi.mock("@/lib/db", () => ({
  db: { select: () => ({ from: () => ({ limit: async () => [] }) }) },
}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound")
  },
  useRouter: () => ({ push: vi.fn() }),
}))

const deltaSpy = vi.fn()
vi.mock("@/components/tracker-detail/AnalyticsCharts", () => ({
  AnalyticsCharts: (props: { delta: unknown }) => {
    deltaSpy(props.delta)
    return null
  },
}))
vi.mock("@/components/tracker-detail/PollLog", () => ({ PollLog: () => null }))
vi.mock("@/components/tracker-detail/TrackerDetailHeader", () => ({
  TrackerDetailHeader: (props: { onPollNow: () => void }) => (
    <button type="button" onClick={props.onPollNow}>
      Poll Now
    </button>
  ),
}))
vi.mock("@/components/dashboard/RankProgress", () => ({ RankProgress: () => null }))
vi.mock("@/components/dashboard/TorrentsTab", () => ({ TorrentsTab: () => null }))
vi.mock("@/components/TrackerCredentialsSheet", () => ({ TrackerCredentialsSheet: () => null }))
vi.mock("@/components/TrackerSettingsSheet", () => ({ TrackerSettingsSheet: () => null }))
vi.mock("@/components/TrackerDefunctBanner", () => ({ TrackerDefunctBanner: () => null }))
vi.mock("@/components/tracker-detail/TrackerStatusBanner", () => ({
  TrackerStatusBanner: () => null,
}))
vi.mock("@/hooks/useTrackerTorrents", () => ({ useTrackerTorrents: () => ({}) }))

import TrackerDetailPage from "@/app/(auth)/trackers/[id]/page"
import { TrackerDetailClient } from "@/app/(auth)/trackers/[id]/TrackerDetailClient"

const NOW = Date.UTC(2026, 9, 24, 12)

function snap(hoursAgo: number, ratio: number, uploaded: string): Snapshot {
  return {
    polledAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
    uploadedBytes: uploaded,
    downloadedBytes: "1000",
    bufferBytes: "0",
    ratio,
    ratioIsInfinite: false,
    seedingCount: 1,
    leechingCount: 0,
    requiredRatio: null,
    warned: false,
    freeleechTokens: null,
    hitAndRuns: 0,
    seedbonus: null,
    shareScore: null,
    username: null,
    group: null,
    isManual: false,
  }
}

// An old tracker's all-time rows, one per day: against the day before
// yesterday the ratio looks up
const ALL_TIME = [snap(72, 3.0, "1000"), snap(47, 3.0, "2000"), snap(0, 3.2, "9000")]
// The last two days as polled: 3.5 for most of the day, then 3.2
const RECENT = [
  snap(47, 3.0, "2000"),
  snap(23, 3.5, "5000"),
  snap(10, 3.2, "8000"),
  snap(0, 3.2, "9000"),
]

const tracker = {
  id: 7,
  name: "Example",
  color: "#336699",
  isActive: true,
  platformType: "unit3d",
  platformMeta: null,
  registrySlug: null,
  qbtTag: null,
  joinedAt: null,
  lastPolledAt: new Date(NOW).toISOString(),
  lastError: null,
  lastErrorAt: null,
  pausedAt: null,
  userPausedAt: null,
  latestStats: {
    ratio: 3.2,
    ratioIsInfinite: false,
    uploadedBytes: "9000",
    downloadedBytes: "1000",
    bufferBytes: "8000",
    seedingCount: 1,
    leechingCount: 0,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
    hitAndRuns: 0,
    seedbonus: null,
    shareScore: null,
    username: null,
    group: null,
  },
} as unknown as TrackerSummary

const ratioCard = () => screen.getAllByTestId("stat-card-Ratio")[0]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  deltaSpy.mockClear()
  getSnapshotsForTracker.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("ratio trend from the page to the card", () => {
  it("loads the last two days unbucketed and hands them to the client", async () => {
    getSnapshotsForTracker.mockImplementation(async (_id: number, days: number) =>
      days === 2 ? RECENT : ALL_TIME
    )

    const page = (await TrackerDetailPage({
      params: Promise.resolve({ id: "7" }),
      searchParams: Promise.resolve({}),
    })) as ReactElement<{ children: ReactElement<Record<string, unknown>> }>

    expect(getSnapshotsForTracker).toHaveBeenCalledWith(7, 2)
    expect(page.props.children.props.initialRecentSnapshots).toBe(RECENT)
    expect(page.props.children.props.initialAllTimeSnapshots).toBe(ALL_TIME)
  })

  it("draws the arrow and the 24h line from the recent series", () => {
    render(
      <TrackerDetailClient
        trackerId={7}
        initialTracker={tracker}
        initialAllTimeSnapshots={ALL_TIME}
        initialRecentSnapshots={RECENT}
        initialTagGroups={[]}
        initialQbitmanageConfig={null}
      />
    )

    expect(ratioCard()).toHaveTextContent("Trending down")
    expect(deltaSpy).toHaveBeenLastCalledWith({ uploaded: "4000", downloaded: "0" })
  })

  it("reloads the recent series after Poll Now", async () => {
    const later = [...RECENT, snap(0, 3.6, "9500")]
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/poll")) return new Response("{}")
      if (url.endsWith("?days=2")) return new Response(JSON.stringify(later))
      if (url.endsWith("?days=0")) return new Response(JSON.stringify(ALL_TIME))
      return new Response(JSON.stringify(tracker))
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <TrackerDetailClient
        trackerId={7}
        initialTracker={tracker}
        initialAllTimeSnapshots={ALL_TIME}
        initialRecentSnapshots={RECENT}
        initialTagGroups={[]}
        initialQbitmanageConfig={null}
      />
    )
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Poll Now" }))
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/trackers/7/snapshots?days=2")
    expect(ratioCard()).toHaveTextContent("Trending up")
  })
})
