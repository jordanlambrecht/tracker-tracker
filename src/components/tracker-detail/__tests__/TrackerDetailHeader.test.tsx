// src/components/tracker-detail/__tests__/TrackerDetailHeader.test.tsx
//
// A row the tracker list doesn't carry has no trustworthy address and can't be
// polled, so the header drops the site link and every control that polls or
// pauses it. Settings, which holds archive and delete, stays, and so does the
// credential vault.

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TrackerDetailHeader } from "@/components/tracker-detail/TrackerDetailHeader"
import { getTrackerBySlug, type TrackerRegistryEntry } from "@/data/tracker-registry"
import type { TrackerSummary } from "@/types/api"

const SITE = "https://old-host.example"

function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 42,
    name: "Moved",
    baseUrl: SITE,
    registrySlug: null,
    platformType: "unit3d",
    linked: true,
    duplicateOf: null,
    isActive: true,
    lastPolledAt: "2026-10-30T09:00:00.000Z",
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#00d4ff",
    qbtTag: null,
    mouseholeUrl: null,
    mouseholePublicUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: 0,
    joinedAt: null,
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    latestStats: null,
    ...overrides,
  }
}

function renderHeader(tracker: TrackerSummary, registryEntry?: TrackerRegistryEntry) {
  return render(
    <TrackerDetailHeader
      tracker={tracker}
      stats={null}
      registryEntry={registryEntry}
      accentColor="#00d4ff"
      polling={false}
      onPollNow={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenCredentials={vi.fn()}
      onDebugPoll={vi.fn()}
      debugLoading={false}
      badgeSlots={[]}
      onTogglePause={vi.fn()}
      pauseLoading={false}
      settingsSaves={0}
    />
  )
}

function siteLink(container: HTMLElement) {
  return container.querySelector(`a[href="${SITE}"]`)
}

function pollControls() {
  return [
    screen.queryByRole("button", { name: "Debug: fetch raw API response" }),
    screen.queryByRole("button", { name: "Pause automated polling" }),
    screen.queryByRole("button", { name: "Resume automated polling" }),
    screen.queryByRole("button", { name: "Poll Now" }),
  ].filter(Boolean)
}

const PAUSED_AT = "2026-10-30T09:00:00.000Z"

describe("TrackerDetailHeader", () => {
  it("offers the site link and the poll controls on a linked row", () => {
    const { container } = renderHeader(makeTracker())

    expect(siteLink(container)).not.toBeNull()
    expect(pollControls()).toHaveLength(3)
  })

  it.each<[string, Partial<TrackerSummary>]>([
    ["paused by the poll", { pausedAt: PAUSED_AT }],
    ["paused by the user", { userPausedAt: PAUSED_AT }],
  ])("drops the site link and every poll control on an unlinked row %s", (_, state) => {
    const { container } = renderHeader(makeTracker({ ...state, linked: false }))

    expect(siteLink(container)).toBeNull()
    expect(pollControls()).toEqual([])
    expect(screen.getByText("Not in the tracker list, so it isn't polled")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tracker settings" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tracker credentials" })).toBeInTheDocument()
  })

  // The poll and debug routes refuse a tracker that has shut down.
  it("drops every poll control on a tracker that has shut down", () => {
    const fearnopeer = getTrackerBySlug("fearnopeer")
    renderHeader(makeTracker({ registrySlug: "fearnopeer", name: "FearNoPeer" }), fearnopeer)

    expect(fearnopeer?.defunct).toBe(true)
    expect(pollControls()).toEqual([])
    expect(screen.getByRole("button", { name: "Tracker settings" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tracker credentials" })).toBeInTheDocument()
  })
})
