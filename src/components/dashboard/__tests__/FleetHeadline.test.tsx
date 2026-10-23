// src/components/dashboard/__tests__/FleetHeadline.test.tsx

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FleetHeadline } from "@/components/dashboard/FleetHeadline"

function fleet(ratioChange: number | null, overrides: Record<string, unknown> = {}) {
  return {
    uploadDelta: "0",
    downloadDelta: "0",
    bufferDelta: "0",
    ratioChange,
    seedbonusChange: null,
    uploadDeltaYesterday: null,
    downloadDeltaYesterday: null,
    bufferDeltaYesterday: null,
    ...overrides,
  }
}

function card(label: string): HTMLElement {
  const node = screen.getByText(label)
  const found = node.closest("[class*='rounded']") ?? node.parentElement?.parentElement
  if (!found) throw new Error(`${label} card not found`)
  return found as HTMLElement
}

function ratioCard(): HTMLElement {
  const label = screen.getByText("Ratio change")
  const card = label.closest("[class*='rounded']") ?? label.parentElement?.parentElement
  if (!card) throw new Error("ratio card not found")
  return card as HTMLElement
}

describe("FleetHeadline ratio change", () => {
  it("shows no change, without a sign, when the ratio did not move", () => {
    render(<FleetHeadline fleet={fleet(0)} />)

    expect(ratioCard()).toHaveTextContent("0.0000")
    expect(ratioCard()).not.toHaveTextContent("+0.0000")
    expect(ratioCard()).toHaveTextContent("No change")
  })

  it("keeps the sign and arrow of a change too small for four decimals", () => {
    render(<FleetHeadline fleet={fleet(0.00001)} />)

    expect(ratioCard()).toHaveTextContent("+0.0000")
    expect(ratioCard()).toHaveTextContent("Trending up")
  })

  it("shows a gain as trending up", () => {
    render(<FleetHeadline fleet={fleet(0.0123)} />)

    expect(ratioCard()).toHaveTextContent("+0.0123")
    expect(ratioCard()).toHaveTextContent("Trending up")
  })

  it("shows a loss as trending down", () => {
    render(<FleetHeadline fleet={fleet(-0.0123)} />)

    expect(ratioCard()).toHaveTextContent("-0.0123")
    expect(ratioCard()).toHaveTextContent("Trending down")
  })

  it("treats a change of Number.EPSILON as no change", () => {
    const { unmount } = render(<FleetHeadline fleet={fleet(Number.EPSILON)} />)
    expect(ratioCard()).toHaveTextContent("No change")
    unmount()

    render(<FleetHeadline fleet={fleet(-Number.EPSILON)} />)
    expect(ratioCard()).toHaveTextContent("No change")
    expect(ratioCard()).not.toHaveTextContent("-0.0000")
  })

  it("shows no trend without upload activity", () => {
    render(<FleetHeadline fleet={fleet(null)} />)

    expect(ratioCard()).toHaveTextContent("0.0000")
    expect(ratioCard()).not.toHaveTextContent(/Trending|No change/)
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

  it("keeps the sign of a day-on-day percentage", () => {
    render(
      <FleetHeadline fleet={fleet(null, { uploadDelta: "1500", uploadDeltaYesterday: "1000" })} />
    )

    expect(card("Upload gained")).toHaveTextContent("+50.0% vs yesterday")
  })

  it("shows a small day-on-day percentage to one decimal with its sign", () => {
    render(
      <FleetHeadline fleet={fleet(null, { uploadDelta: "1003", uploadDeltaYesterday: "1000" })} />
    )
    expect(card("Upload gained")).toHaveTextContent("+0.3% vs yesterday")
  })

  it("shows an unchanged or unknown bonus without a sign", () => {
    const { unmount } = render(<FleetHeadline fleet={fleet(null, { seedbonusChange: 0 })} />)
    expect(card("Bonus gained")).not.toHaveTextContent("+0")
    unmount()

    render(<FleetHeadline fleet={fleet(null)} />)
    expect(card("Bonus gained")).not.toHaveTextContent("+0")
  })

  it("keeps the sign of a bonus change smaller than one point", () => {
    render(<FleetHeadline fleet={fleet(null, { seedbonusChange: 0.4 })} />)

    expect(card("Bonus gained")).toHaveTextContent("+0")
  })
})
