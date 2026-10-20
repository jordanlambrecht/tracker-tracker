// src/components/dashboard/__tests__/LoginTimers.test.tsx
//
// A timer exists only for a tracker whose registry entry sets a login interval.
// The entry is found by the row's slug, so a pre-registry row has no timer
// however its stored URL is spelled.

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

vi.mock("@/data/tracker-registry", () => ({
  registryEntryFor: ({ registrySlug }: { registrySlug: string | null }) =>
    registrySlug === "alpha" ? { rules: { loginIntervalDays: 30 } } : undefined,
}))

import { LoginTimers } from "@/components/dashboard/LoginTimers"

const baseStats: TrackerLatestStats = {
  ratio: 1,
  ratioIsInfinite: false,
  uploadedBytes: "0",
  downloadedBytes: "0",
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

function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Alpha",
    // Where the row polls. The same address for both fixtures, so nothing can
    // read a registry entry off it.
    baseUrl: "https://poll-address.example",
    registrySlug: "alpha",
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
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: null,
    joinedAt: null,
    lastAccessAt: "2026-09-01",
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    latestStats: baseStats,
    ...overrides,
  }
}

function renderTimers(trackers: TrackerSummary[]) {
  return render(<LoginTimers trackers={trackers} expanded onToggleExpanded={() => {}} />)
}

describe("LoginTimers", () => {
  it("times a row whose slug names an entry with a login interval", () => {
    renderTimers([makeTracker()])
    expect(screen.getByText("Login Timers")).toBeInTheDocument()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("times nothing for a row that names no registry entry", () => {
    const { container } = renderTimers([makeTracker({ registrySlug: null })])
    expect(container).toBeEmptyDOMElement()
  })
})
