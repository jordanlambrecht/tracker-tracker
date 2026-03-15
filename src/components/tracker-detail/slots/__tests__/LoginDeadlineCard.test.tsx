// src/components/tracker-detail/slots/__tests__/LoginDeadlineCard.test.tsx

import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CHART_THEME } from "@/components/charts/theme"
import { StatCard } from "@/components/ui/StatCard"

const ACCENT = CHART_THEME.accent
const DAY_MS = 24 * 60 * 60 * 1000

describe("LoginDeadlineCard", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows days remaining at 50% elapsed (accent color)", () => {
    // 90-day interval, 45 days elapsed → 45 days remaining
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)
    const lastAccess = new Date(now.getTime() - 45 * DAY_MS).toISOString()

    const { container } = render(
      <StatCard type="ring" lastAccessAt={lastAccess} loginIntervalDays={90} accentColor={ACCENT} />
    )

    expect(screen.getByText("45")).toBeInTheDocument()
    expect(screen.getByText("days")).toBeInTheDocument()
    // At exactly 50%, should be accent color (< 0.5 threshold is strict <)
    const progressCircle = container.querySelectorAll("circle")[1]
    expect(progressCircle?.getAttribute("stroke")).toBe(ACCENT)
  })

  it("shows danger color when >80% elapsed", () => {
    // 90-day interval, 85 days elapsed → 5 days remaining
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)
    const lastAccess = new Date(now.getTime() - 85 * DAY_MS).toISOString()

    const { container } = render(
      <StatCard type="ring" lastAccessAt={lastAccess} loginIntervalDays={90} accentColor={ACCENT} />
    )

    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("days")).toBeInTheDocument()
    const progressCircle = container.querySelectorAll("circle")[1]
    expect(progressCircle?.getAttribute("stroke")).toBe(CHART_THEME.danger)
  })

  it("switches to hours when <24h remaining", () => {
    // 90-day interval, 89.5 days elapsed → ~12 hours remaining
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)
    const lastAccess = new Date(now.getTime() - (89.5 * DAY_MS)).toISOString()

    render(
      <StatCard type="ring" lastAccessAt={lastAccess} loginIntervalDays={90} accentColor={ACCENT} />
    )

    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("hrs")).toBeInTheDocument()
  })

  it("shows OVERDUE when past deadline", () => {
    // 90-day interval, 100 days elapsed → 10 days overdue
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)
    const lastAccess = new Date(now.getTime() - 100 * DAY_MS).toISOString()

    render(
      <StatCard type="ring" lastAccessAt={lastAccess} loginIntervalDays={90} accentColor={ACCENT} />
    )

    expect(screen.getByText("OVERDUE")).toBeInTheDocument()
    expect(screen.getByText("10 days overdue")).toBeInTheDocument()
  })

  it("shows full interval remaining when just logged in", () => {
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)
    const lastAccess = now.toISOString()

    const { container } = render(
      <StatCard type="ring" lastAccessAt={lastAccess} loginIntervalDays={90} accentColor={ACCENT} />
    )

    expect(screen.getByText("90")).toBeInTheDocument()
    expect(screen.getByText("days")).toBeInTheDocument()
    // 0% elapsed → accent color
    const progressCircle = container.querySelectorAll("circle")[1]
    expect(progressCircle?.getAttribute("stroke")).toBe(ACCENT)
  })

  it("shows warn color at 50-80% range", () => {
    // 90-day interval, 60 days elapsed → 66.7% → warn
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)
    const lastAccess = new Date(now.getTime() - 60 * DAY_MS).toISOString()

    const { container } = render(
      <StatCard type="ring" lastAccessAt={lastAccess} loginIntervalDays={90} accentColor={ACCENT} />
    )

    expect(screen.getByText("30")).toBeInTheDocument()
    const progressCircle = container.querySelectorAll("circle")[1]
    expect(progressCircle?.getAttribute("stroke")).toBe(CHART_THEME.warn)
  })

  it("shows 1 day overdue singular", () => {
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)
    const lastAccess = new Date(now.getTime() - 91 * DAY_MS).toISOString()

    render(
      <StatCard type="ring" lastAccessAt={lastAccess} loginIntervalDays={90} accentColor={ACCENT} />
    )

    expect(screen.getByText("1 day overdue")).toBeInTheDocument()
  })

  it("renders nothing for unparseable date string (XSS-safe)", () => {
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)

    const { container } = render(
      <StatCard type="ring"
        lastAccessAt="<script>alert(1)</script>"
        loginIntervalDays={90}
        accentColor={ACCENT}
      />
    )

    // new Date("<script>...") returns Invalid Date → NaN guard returns null
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing for empty string date", () => {
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)

    const { container } = render(
      <StatCard type="ring" lastAccessAt="" loginIntervalDays={90} accentColor={ACCENT} />
    )

    expect(container.innerHTML).toBe("")
  })

  it("handles negative loginIntervalDays gracefully", () => {
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)

    render(
      <StatCard type="ring" lastAccessAt={now.toISOString()} loginIntervalDays={-1} accentColor={ACCENT} />
    )

    // Negative interval → totalMs negative → remainingMs always negative → overdue
    expect(screen.getByText("OVERDUE")).toBeInTheDocument()
  })

  it("does not crash with extremely large loginIntervalDays", () => {
    const now = new Date("2026-06-15T00:00:00Z")
    vi.setSystemTime(now)

    expect(() => {
      render(
        <StatCard type="ring" lastAccessAt={now.toISOString()} loginIntervalDays={999999} accentColor={ACCENT} />
      )
    }).not.toThrow()
  })
})
