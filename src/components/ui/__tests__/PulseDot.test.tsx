// src/components/ui/__tests__/PulseDot.test.tsx

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PulseDot } from "@/components/ui/PulseDot"

// ---------------------------------------------------------------------------
// accessible labels
// ---------------------------------------------------------------------------

describe("PulseDot accessible label", () => {
  it("labels the 'no-seeds' status 'No seeds', not 'Critical'", () => {
    // On dot-only surfaces (sidebar tracker list, dashboard overview grid) the
    // label is the ONLY thing separating a zero-seed tracker from a critical
    // one. Both share the danger palette by design.
    const { getByRole } = render(<PulseDot status="no-seeds" />)
    const dot = getByRole("status")
    expect(dot.getAttribute("aria-label")).toBe("No seeds")
    expect(dot.getAttribute("aria-label")).not.toBe("Critical")
  })

  it("still labels the 'critical' status 'Critical'", () => {
    const { getByRole } = render(<PulseDot status="critical" />)
    expect(getByRole("status").getAttribute("aria-label")).toBe("Critical")
  })

  it("gives 'no-seeds' and 'critical' different labels", () => {
    // Scope each lookup to its own container: getByRole queries the whole
    // document, so two mounted dots would both match.
    const noSeeds = render(<PulseDot status="no-seeds" />)
      .container.querySelector("output")
      ?.getAttribute("aria-label")
    const critical = render(<PulseDot status="critical" />)
      .container.querySelector("output")
      ?.getAttribute("aria-label")
    expect(noSeeds).toBe("No seeds")
    expect(critical).toBe("Critical")
    expect(noSeeds).not.toBe(critical)
  })

  it("lets an explicit aria-label override the status label", () => {
    const { getByRole } = render(<PulseDot status="no-seeds" aria-label="Zero active seeds" />)
    expect(getByRole("status").getAttribute("aria-label")).toBe("Zero active seeds")
  })
})

// ---------------------------------------------------------------------------
// appearance
// ---------------------------------------------------------------------------

describe("PulseDot 'no-seeds' appearance", () => {
  it("uses the danger palette", () => {
    const { getByRole } = render(<PulseDot status="no-seeds" />)
    expect(getByRole("status").className).toContain("bg-danger")
  })

  it("pulses rather than dimming", () => {
    const { getByRole } = render(<PulseDot status="no-seeds" />)
    const dot = getByRole("status")
    expect(dot.className).toContain("animate-pulse-glow")
    expect(dot.className).not.toContain("opacity-50")
  })
})
