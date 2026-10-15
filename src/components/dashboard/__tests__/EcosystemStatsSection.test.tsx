// src/components/dashboard/__tests__/EcosystemStatsSection.test.tsx
//
// The Hit & Runs card is the one Ecosystem stat where "0" and "unknown" must
// not collapse together: a fleet where no adapter reports the field has to
// read as unknown rather than clean.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { EcosystemStatsSection } from "@/components/dashboard/EcosystemStatsSection"
import type { AggregateStats } from "@/lib/dashboard"
import type { TrackerSummary } from "@/types/api"

function makeTracker(id: number, name: string): TrackerSummary {
  return {
    id,
    name,
    baseUrl: `https://${name.toLowerCase()}.example`,
    registrySlug: null,
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
    createdAt: "2026-01-01T00:00:00.000Z",
    latestStats: null,
  }
}

function makeStats(overrides: Partial<AggregateStats> = {}): AggregateStats {
  return {
    totalUploaded: "0",
    totalDownloaded: "0",
    totalBuffer: "0",
    avgRatio: null,
    totalSeeding: 0,
    totalLeeching: 0,
    totalHitAndRuns: 0,
    hitAndRunReportingTrackers: 0,
    trackersWithHitAndRuns: [],
    ...overrides,
  }
}

const trackers = [makeTracker(1, "Aither"), makeTracker(2, "BTN"), makeTracker(3, "Blutopia")]

function hitAndRunCard(): HTMLElement {
  return screen.getByTestId("stat-card-Hit & Runs")
}

describe("EcosystemStatsSection hit & runs card", () => {
  it("shows a dash and explains why when no tracker reports the field", () => {
    render(<EcosystemStatsSection trackers={trackers} aggregateStats={makeStats()} />)
    const card = hitAndRunCard()
    expect(within(card).getByText("—")).toBeInTheDocument()
    expect(within(card).queryByText("0")).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Alert:/)).not.toBeInTheDocument()
    expect(within(card).getByLabelText("More info")).toBeInTheDocument()
  })

  it("shows a plain zero when every reporting tracker is clean", () => {
    render(
      <EcosystemStatsSection
        trackers={trackers}
        aggregateStats={makeStats({ hitAndRunReportingTrackers: 3 })}
      />
    )
    const card = hitAndRunCard()
    expect(within(card).getByText("0")).toBeInTheDocument()
    expect(within(card).queryByText("—")).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Alert:/)).not.toBeInTheDocument()
    expect(within(card).queryByLabelText("More info")).not.toBeInTheDocument()
  })

  it("says how many trackers the count covers when only some report the field", async () => {
    const user = userEvent.setup()
    render(
      <EcosystemStatsSection
        trackers={trackers}
        aggregateStats={makeStats({ hitAndRunReportingTrackers: 2 })}
      />
    )
    const card = hitAndRunCard()
    expect(within(card).getByText("0")).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Alert:/)).not.toBeInTheDocument()

    await user.hover(within(card).getByLabelText("More info"))
    // The tooltip renders through a portal, so it is outside the card.
    expect(screen.getByRole("tooltip").textContent).toContain("2 of 3 trackers report hit & runs")
  })

  it("raises the danger alert and names the trackers with hits", () => {
    render(
      <EcosystemStatsSection
        trackers={trackers}
        aggregateStats={makeStats({
          totalHitAndRuns: 3,
          hitAndRunReportingTrackers: 2,
          trackersWithHitAndRuns: [
            { name: "Aither", count: 2 },
            { name: "Blutopia", count: 1 },
          ],
        })}
      />
    )
    const card = hitAndRunCard()
    expect(within(card).getByText("3")).toBeInTheDocument()
    expect(screen.getByLabelText(/^Alert:/)).toHaveAttribute(
      "aria-label",
      "Alert: Hit & runs: 2 on Aither, 1 on Blutopia"
    )
  })
})
