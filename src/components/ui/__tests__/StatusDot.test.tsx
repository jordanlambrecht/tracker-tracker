// src/components/ui/__tests__/StatusDot.test.tsx

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StatusDot } from "@/components/ui/StatusDot"

describe("StatusDot", () => {
  it("glows in its own colour for every tone but muted, like PulseDot", () => {
    const { container, rerender } = render(<StatusDot tone="success" />)
    const dot = container.firstElementChild as HTMLElement

    for (const tone of ["success", "warn", "danger"] as const) {
      rerender(<StatusDot tone={tone} />)
      expect(dot).toHaveClass(`bg-${tone}`, `text-${tone}`, "animate-pulse-glow")
    }
    rerender(<StatusDot tone="muted" />)
    expect(dot).toHaveClass("bg-muted", "text-muted")
    expect(dot).not.toHaveClass("animate-pulse-glow")
  })

  it("is hidden from screen readers, since the text beside it names the state", () => {
    const { container } = render(<StatusDot tone="danger" />)
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
  })
})
