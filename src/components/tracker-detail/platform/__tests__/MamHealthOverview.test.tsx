// src/components/tracker-detail/platform/__tests__/MamHealthOverview.test.tsx
//
// The torrent health breakdown. Only satisfied seeding may count as green; a
// torrent still short of the 72-hour requirement is amber whether it is being
// seeded or not.

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  MamHealthOverview,
  type MamHealthOverviewProps,
} from "@/components/tracker-detail/platform/MamHealthOverview"

function renderOverview(overrides: Partial<MamHealthOverviewProps> = {}) {
  const props: MamHealthOverviewProps = {
    // sSat 10 + upAct 4 + seedHnr 1 + seedUnsat 3, as the adapter sums them.
    meta: {
      seedingHnrCount: 1,
      seedingUnsatisfiedCount: 3,
      inactiveUnsatisfiedCount: 2,
      inactiveSatisfiedCount: 8,
    },
    seedingCount: 18,
    leechingCount: 2,
    hitAndRuns: 5,
    seedbonus: null,
    accentColor: "#000000",
    vipUntil: null,
    unsatisfiedCount: null,
    unsatisfiedLimit: null,
    ...overrides,
  }
  return render(<MamHealthOverview {...props} />)
}

describe("MamHealthOverview torrent health", () => {
  it("counts only satisfied seeding and own uploads as seeding", () => {
    renderOverview()

    expect(screen.getByText("Seeding: 14")).toBeInTheDocument()
    expect(screen.getByText("Seeding, unsatisfied: 3")).toBeInTheDocument()
    expect(screen.getByText("Seeding HnR: 1")).toBeInTheDocument()
  })

  it("labels unsatisfied torrents that are not seeding as such", () => {
    renderOverview()

    expect(screen.getByText("Not seeding, unsatisfied: 2")).toBeInTheDocument()
    expect(screen.getByText("Inactive HnR: 5")).toBeInTheDocument()
    expect(screen.getByText("Completed: 8")).toBeInTheDocument()
    expect(screen.getByText("Leeching: 2")).toBeInTheDocument()
  })

  it("colours unsatisfied seeding amber and satisfied seeding green", () => {
    const { container } = renderOverview()

    const segment = (title: string) =>
      container.querySelector<HTMLElement>(`[title="${title}"]`)?.style.backgroundColor
    expect(segment("Seeding: 14")).toBe("var(--color-success)")
    expect(segment("Seeding, unsatisfied: 3")).toBe("var(--color-warn)")
    expect(segment("Not seeding, unsatisfied: 2")).toBe("var(--color-warn)")
  })

  it("leaves an absent unsatisfied count out of the subtraction", () => {
    // A snapshot polled before seedingUnsatisfiedCount existed.
    renderOverview({ meta: { seedingHnrCount: 1 } })

    expect(screen.getByText("Seeding: 17")).toBeInTheDocument()
    expect(screen.queryByText(/^Seeding, unsatisfied/)).toBeNull()
  })
})
