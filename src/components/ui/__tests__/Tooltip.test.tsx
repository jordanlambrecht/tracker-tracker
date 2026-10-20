// src/components/ui/__tests__/Tooltip.test.tsx

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Tooltip } from "@/components/ui/Tooltip"

const RECT = { top: 100, bottom: 120, left: 40, right: 76, width: 36, height: 20 }

describe("Tooltip placement", () => {
  it("opens six pixels under the trigger, left-aligned with it", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Tooltip content="Explained">
        <span>trigger</span>
      </Tooltip>
    )
    const trigger = container.querySelector("span")
    if (!trigger) throw new Error("trigger not found")
    trigger.getBoundingClientRect = () => ({
      ...RECT,
      x: RECT.left,
      y: RECT.top,
      toJSON: () => RECT,
    })

    await user.hover(trigger)
    const tip = screen.getByRole("tooltip")
    expect(tip.style.top).toBe("126px")
    expect(tip.style.left).toBe("40px")
  })

  it("slides up so a tall popup stays inside the viewport", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Tooltip content="Very long">
        <span>trigger</span>
      </Tooltip>
    )
    const trigger = container.querySelector("span")
    if (!trigger) throw new Error("trigger not found")
    trigger.getBoundingClientRect = () => ({
      ...RECT,
      x: RECT.left,
      y: RECT.top,
      toJSON: () => RECT,
    })
    const heightSpy = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(500)
    const innerHeight = window.innerHeight
    window.innerHeight = 400

    await user.hover(trigger)
    // 400 - 500 - 8 is negative, so the popup pins to the 8px top margin.
    expect(screen.getByRole("tooltip").style.top).toBe("8px")

    heightSpy.mockRestore()
    window.innerHeight = innerHeight
  })

  it("opens when a focusable child receives keyboard focus", async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Explained">
        <button type="button">trigger</button>
      </Tooltip>
    )
    expect(screen.queryByRole("tooltip")).toBeNull()
    await user.tab()
    expect(screen.getByRole("button")).toHaveFocus()
    expect(screen.getByRole("tooltip").textContent).toContain("Explained")
  })
})
