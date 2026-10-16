// src/components/ui/__tests__/StatCard.deadline.test.tsx
//
// The "deadline" ring counts down to an absolute date (an API key's expiry)
// rather than to lastAccess + interval. The ring fills over the last
// `windowDays`, so a far-off deadline shows an empty ring in the accent
// colour and the warn/danger thresholds land where the login ring's do.

import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { StatCard } from "@/components/ui/StatCard"

const ACCENT = CHART_THEME.accent
const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date("2026-08-30T12:00:00Z")

function deadlineIn(days: number): string {
  return new Date(NOW.getTime() + days * DAY_MS).toISOString()
}

function renderDeadline(daysFromNow: number, extra: { windowDays?: number; title?: string } = {}) {
  const { windowDays = 30, ...rest } = extra
  return render(
    <StatCard
      type="deadline"
      deadlineAt={deadlineIn(daysFromNow)}
      windowDays={windowDays}
      accentColor={ACCENT}
      {...rest}
    />
  )
}

function progressStroke(container: HTMLElement): string | null {
  return container.querySelectorAll("circle")[1]?.getAttribute("stroke") ?? null
}

describe("StatCard deadline ring", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows the days left and an empty accent ring when the deadline is beyond the window", () => {
    const { container } = renderDeadline(100)

    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByText("days")).toBeInTheDocument()
    expect(progressStroke(container)).toBe(ACCENT)
  })

  it("turns warn inside the window past the halfway mark", () => {
    // 10 of 30 days left: 20 elapsed, progress 0.67
    const { container } = renderDeadline(10)

    expect(screen.getByText("10")).toBeInTheDocument()
    expect(progressStroke(container)).toBe(CHART_THEME.warn)
  })

  it("turns danger in the last fifth of the window", () => {
    // 4 of 30 days left: progress 0.87
    const { container } = renderDeadline(4)

    expect(screen.getByText("4")).toBeInTheDocument()
    expect(progressStroke(container)).toBe(CHART_THEME.danger)
  })

  it("scales the thresholds to the window", () => {
    // The same 4 days left is only progress 0.6 inside a 10-day window.
    const { container } = renderDeadline(4, { windowDays: 10 })

    expect(progressStroke(container)).toBe(CHART_THEME.warn)
  })

  it("names the deadline date in the footer", () => {
    renderDeadline(100)

    // Formatted in the runner's local zone, the same way the card does it.
    const expected = new Date(deadlineIn(100)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    expect(screen.getByText(`by ${expected}`)).toBeInTheDocument()
  })

  it("says EXPIRED once the deadline has passed", () => {
    renderDeadline(-3)

    expect(screen.getByText("EXPIRED")).toBeInTheDocument()
    expect(screen.getByText("expired 3 days ago")).toBeInTheDocument()
    expect(screen.queryByText("OVERDUE")).not.toBeInTheDocument()
  })

  it("keeps the singular for one day", () => {
    renderDeadline(-1)

    expect(screen.getByText("expired 1 day ago")).toBeInTheDocument()
  })

  it("renders the given title", () => {
    renderDeadline(50, { title: "API Key Expiry" })

    expect(screen.getByText("API Key Expiry")).toBeInTheDocument()
  })

  it("renders nothing for an unparseable date", () => {
    const { container } = render(
      <StatCard type="deadline" deadlineAt="soon" windowDays={30} accentColor={ACCENT} />
    )

    expect(container).toBeEmptyDOMElement()
  })
})
