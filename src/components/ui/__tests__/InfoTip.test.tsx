// src/components/ui/__tests__/InfoTip.test.tsx

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { InfoTip } from "@/components/ui/InfoTip"

// ---------------------------------------------------------------------------
// icon variant renders the correct SVG
// ---------------------------------------------------------------------------

describe("InfoTip icon variant", () => {
  it("renders info icon by default (circle + two lines)", () => {
    const { container } = render(<InfoTip content="Help text" />)
    const svg = container.querySelector("svg")
    if (!svg) throw new Error("SVG not found")
    // InfoIcon has a circle + line from y=16→12 (the "i" body) + dot at y=8
    const lines = svg.querySelectorAll("line")
    expect(lines.length).toBe(2)
    expect(lines[0].getAttribute("y1")).toBe("16")
  })

  it("renders question icon when icon='question'", () => {
    const { container } = render(<InfoTip icon="question" content="Help text" />)
    const svg = container.querySelector("svg")
    if (!svg) throw new Error("SVG not found")
    // QuestionIcon has a circle + path (the "?" curve) + line at y=17
    const path = svg.querySelector("path")
    if (!path) throw new Error("path not found")
    expect(path.getAttribute("d")).toContain("9.09 9a3")
    const lines = svg.querySelectorAll("line")
    expect(lines.length).toBe(1)
    expect(lines[0].getAttribute("y1")).toBe("17")
  })
})

// ---------------------------------------------------------------------------
// size variant applies correct classes to wrapper
// ---------------------------------------------------------------------------

describe("InfoTip size variant", () => {
  it("applies md size classes by default", () => {
    const { container } = render(<InfoTip content="Help text" />)
    const wrapper = container.querySelector("span > button")
    expect(wrapper?.className).toContain("[&>svg]:w-3.5")
    expect(wrapper?.className).toContain("[&>svg]:h-3.5")
  })

  it("applies sm size classes", () => {
    const { container } = render(<InfoTip content="Help text" size="sm" />)
    const wrapper = container.querySelector("span > button")
    expect(wrapper?.className).toContain("[&>svg]:w-3")
    expect(wrapper?.className).toContain("[&>svg]:h-3")
    // Ensure it's not the md classes (w-3.5)
    expect(wrapper?.className).not.toContain("w-3.5")
  })

  it("applies lg size classes", () => {
    const { container } = render(<InfoTip content="Help text" size="lg" />)
    const wrapper = container.querySelector("span > button")
    expect(wrapper?.className).toContain("[&>svg]:w-4")
    expect(wrapper?.className).toContain("[&>svg]:h-4")
  })
})

// ---------------------------------------------------------------------------
// tooltip content appears on hover
// ---------------------------------------------------------------------------

describe("InfoTip tooltip behavior", () => {
  it("shows tooltip content on hover", async () => {
    const user = userEvent.setup()
    const { container } = render(<InfoTip content="Explanation of the thing" />)
    const trigger = container.querySelector("span > button")
    if (!trigger) throw new Error("trigger not found")

    // Tooltip not visible initially
    expect(screen.queryByRole("tooltip")).toBeNull()

    await user.hover(trigger)
    const tooltip = screen.getByRole("tooltip")
    expect(tooltip.textContent).toContain("Explanation of the thing")
  })

  it("hides tooltip on unhover", async () => {
    const user = userEvent.setup()
    const { container } = render(<InfoTip content="Goes away" />)
    const trigger = container.querySelector("span > button")
    if (!trigger) throw new Error("trigger not found")

    await user.hover(trigger)
    expect(screen.getByRole("tooltip")).toBeTruthy()

    await user.unhover(trigger)
    // Tooltip has a 150ms hide delay
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.queryByRole("tooltip")).toBeNull()
  })

  it("passes docs prop through to Tooltip", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <InfoTip
        content="Main content"
        docs={{ href: "https://example.com", description: "Example docs" }}
      />
    )
    const trigger = container.querySelector("span > button")
    if (!trigger) throw new Error("trigger not found")
    await user.hover(trigger)

    const tooltip = screen.getByRole("tooltip")
    const link = tooltip.querySelector("a")
    if (!link) throw new Error("link not found")
    expect(link.getAttribute("href")).toBe("https://example.com")
    expect(link.textContent).toContain("Documentation")
  })
})

// ---------------------------------------------------------------------------
// className passthrough
// ---------------------------------------------------------------------------

describe("InfoTip className prop", () => {
  it("appends custom className to the wrapper", () => {
    const { container } = render(<InfoTip content="Help" className="ml-2" />)
    const wrapper = container.querySelector("span > button")
    expect(wrapper?.className).toContain("ml-2")
    // Base classes still present
    expect(wrapper?.className).toContain("cursor-help")
  })
})

// ---------------------------------------------------------------------------
// base styling is always present
// ---------------------------------------------------------------------------

describe("InfoTip base styles", () => {
  it("has cursor-help and muted text color", () => {
    const { container } = render(<InfoTip content="Help" />)
    const wrapper = container.querySelector("span > button")
    expect(wrapper?.className).toContain("cursor-help")
    expect(wrapper?.className).toContain("text-muted")
  })

  it("SVG has aria-hidden for accessibility", () => {
    const { container } = render(<InfoTip content="Help" />)
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
  })
})
