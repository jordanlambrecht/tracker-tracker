// src/components/ui/__tests__/StatusDot.test.tsx

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StatusDot } from "@/components/ui/StatusDot"
import { getHealthDot } from "@/lib/tracker-status"

describe("StatusDot", () => {
  it("sets the text colour with every tone, since the glow is drawn in it", () => {
    const { container, rerender } = render(<StatusDot tone="accent" />)
    const dot = container.firstElementChild as HTMLElement

    for (const tone of ["accent", "success", "warn", "danger", "secondary", "muted"] as const) {
      rerender(<StatusDot tone={tone} />)
      expect(dot).toHaveClass(`bg-${tone}`, `text-${tone}`)
    }
  })

  it("glows only when asked to, and is dimmed when still", () => {
    const { container, rerender } = render(<StatusDot tone="success" glow />)
    const dot = container.firstElementChild as HTMLElement
    expect(dot).toHaveClass("animate-pulse-glow")
    expect(dot).not.toHaveClass("opacity-50")

    rerender(<StatusDot tone="success" />)
    expect(dot).not.toHaveClass("animate-pulse-glow")
    expect(dot).toHaveClass("opacity-50")
  })

  it("gives a colour override to the glow as well as the fill", () => {
    const { container } = render(<StatusDot tone="accent" glow color="#ff00aa" />)
    expect(container.firstElementChild).toHaveStyle({
      backgroundColor: "#ff00aa",
      color: "#ff00aa",
    })
  })

  it("announces the label it is given", () => {
    const { getByRole } = render(<StatusDot tone="danger" glow label="Zero active seeds" />)
    expect(getByRole("status")).toHaveAttribute("aria-label", "Zero active seeds")
  })

  it("is hidden from screen readers without a label, since the text beside it names the state", () => {
    const { container } = render(<StatusDot tone="danger" />)
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
  })
})

// On dot-only surfaces (sidebar tracker list, dashboard overview grid) the label
// is the only thing separating a zero-seed tracker from a critical one. Both
// share the danger dot by design.
describe("StatusDot for tracker health", () => {
  it("announces 'no-seeds' as No Seeds and 'critical' as Critical", () => {
    // Scope each lookup to its own container: getByRole queries the whole
    // document, so two mounted dots would both match.
    const noSeeds = render(<StatusDot {...getHealthDot("no-seeds")} />).container.querySelector(
      "output"
    )
    const critical = render(<StatusDot {...getHealthDot("critical")} />).container.querySelector(
      "output"
    )
    expect(noSeeds).toHaveAttribute("aria-label", "No Seeds")
    expect(critical).toHaveAttribute("aria-label", "Critical")
  })

  it("shows 'no-seeds' in the danger colour, glowing rather than dimmed", () => {
    const { getByRole } = render(<StatusDot {...getHealthDot("no-seeds")} />)
    const dot = getByRole("status")
    expect(dot).toHaveClass("bg-danger", "animate-pulse-glow")
    expect(dot).not.toHaveClass("opacity-50")
  })
})
