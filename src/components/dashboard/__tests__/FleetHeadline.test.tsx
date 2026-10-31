// src/components/dashboard/__tests__/FleetHeadline.test.tsx

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { FleetHeadline } from "@/components/dashboard/FleetHeadline"
import { hexToRgba } from "@/lib/color-utils"

function fleet(ratioChange: number | null, overrides: Record<string, unknown> = {}) {
  return {
    uploadDelta: "0",
    downloadDelta: "0",
    bufferDelta: "0",
    ratioChange,
    seedbonusChange: 0,
    uploadDeltaYesterday: null,
    downloadDeltaYesterday: null,
    bufferDeltaYesterday: null,
    ...overrides,
  }
}

const card = (label: string) => screen.getByTestId(`stat-card-${label}`)

/** The card's glow, which StatCard draws in its accent colour */
const glowOf = (color: string) => hexToRgba(color, 0.09)

describe("FleetHeadline ratio change", () => {
  it("shows no change, without a sign, when the ratio did not move", () => {
    render(<FleetHeadline fleet={fleet(0)} />)

    expect(card("Ratio change")).toHaveTextContent("0.0000")
    expect(card("Ratio change")).not.toHaveTextContent("+0.0000")
    expect(card("Ratio change")).toHaveTextContent("No change")
    expect(card("Ratio change").style.filter).toContain(glowOf(CHART_THEME.neutral))
  })

  it("shows a change too small for four decimals as no change", () => {
    const { unmount } = render(<FleetHeadline fleet={fleet(0.00001)} />)
    expect(card("Ratio change")).toHaveTextContent("No change")
    expect(card("Ratio change")).not.toHaveTextContent("+0.0000")
    unmount()

    render(<FleetHeadline fleet={fleet(-0.00001)} />)
    expect(card("Ratio change")).toHaveTextContent("No change")
    expect(card("Ratio change")).not.toHaveTextContent("-0.0000")
  })

  it("shows a gain as trending up in the success colour", () => {
    render(<FleetHeadline fleet={fleet(0.0123)} />)

    expect(card("Ratio change")).toHaveTextContent("+0.0123")
    expect(card("Ratio change")).toHaveTextContent("Trending up")
    expect(card("Ratio change").style.filter).toContain(glowOf(CHART_THEME.success))
  })

  it("shows a loss as trending down in the danger colour", () => {
    render(<FleetHeadline fleet={fleet(-0.0123)} />)

    expect(card("Ratio change")).toHaveTextContent("-0.0123")
    expect(card("Ratio change")).toHaveTextContent("Trending down")
    expect(card("Ratio change").style.filter).toContain(glowOf(CHART_THEME.danger))
  })

  it("shows a dash without a trend when there is nothing to measure", () => {
    render(<FleetHeadline fleet={fleet(null)} />)

    expect(card("Ratio change")).toHaveTextContent("—")
    expect(card("Ratio change")).not.toHaveTextContent(/\d/)
    expect(card("Ratio change")).not.toHaveTextContent(/Trending|No change/)
    expect(card("Ratio change").style.filter).toContain(glowOf(CHART_THEME.neutral))
  })
})

describe("FleetHeadline other changes", () => {
  it("shows an unchanged day-on-day percentage without a sign", () => {
    render(
      <FleetHeadline fleet={fleet(null, { uploadDelta: "1000", uploadDeltaYesterday: "1000" })} />
    )

    expect(card("Upload gained")).toHaveTextContent("0.0% vs yesterday")
    expect(card("Upload gained")).not.toHaveTextContent("+0.0%")
  })

  it("shows a percentage that rounds to zero without a sign", () => {
    render(
      <FleetHeadline fleet={fleet(null, { uploadDelta: "10004", uploadDeltaYesterday: "10000" })} />
    )

    expect(card("Upload gained")).toHaveTextContent("0.0% vs yesterday")
    expect(card("Upload gained")).not.toHaveTextContent(/[+-]0\.0%/)
  })

  it("keeps the sign of a rise and a fall", () => {
    const { unmount } = render(
      <FleetHeadline fleet={fleet(null, { uploadDelta: "1500", uploadDeltaYesterday: "1000" })} />
    )
    expect(card("Upload gained")).toHaveTextContent("+50.0% vs yesterday")
    unmount()

    render(
      <FleetHeadline fleet={fleet(null, { uploadDelta: "997", uploadDeltaYesterday: "1000" })} />
    )
    expect(card("Upload gained")).toHaveTextContent("-0.3% vs yesterday")
  })

  it("compares yesterday with the day before", () => {
    render(
      <FleetHeadline
        day="yesterday"
        fleet={fleet(null, { uploadDelta: "1003", uploadDeltaYesterday: "1000" })}
      />
    )
    expect(card("Upload gained")).toHaveTextContent("+0.3% vs the day before")
  })

  it("shows an unchanged bonus, or one under a point, without a sign", () => {
    const { unmount } = render(<FleetHeadline fleet={fleet(null, { seedbonusChange: 0 })} />)
    expect(card("Bonus gained")).toHaveTextContent(/^Bonus gained0pts$/)
    unmount()

    render(<FleetHeadline fleet={fleet(null, { seedbonusChange: 0.4 })} />)
    expect(card("Bonus gained")).toHaveTextContent(/^Bonus gained0pts$/)
  })

  it("shows a missing bonus change as 0, without a sign", () => {
    render(<FleetHeadline fleet={fleet(null, { seedbonusChange: null })} />)
    expect(card("Bonus gained")).toHaveTextContent(/^Bonus gained0pts$/)
  })

  it("keeps the sign of a bonus change", () => {
    const { unmount } = render(<FleetHeadline fleet={fleet(null, { seedbonusChange: 12.7 })} />)
    expect(card("Bonus gained")).toHaveTextContent("+12")
    unmount()

    render(<FleetHeadline fleet={fleet(null, { seedbonusChange: -1234.5 })} />)
    expect(card("Bonus gained")).toHaveTextContent("-1,234")
  })
})
