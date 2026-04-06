// src/components/ui/__tests__/FilterPill.test.tsx

import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FilterPill } from "@/components/ui"

// ---------------------------------------------------------------------------
// text prop and children priority
// ---------------------------------------------------------------------------

describe("FilterPill text prop and children", () => {
  it("renders the text prop as content", () => {
    const { getByRole } = render(<FilterPill active={false} text="All" />)
    expect(getByRole("button").textContent).toContain("All")
  })

  it("renders children when provided and no text prop", () => {
    const { getByRole } = render(<FilterPill active={false}>Child</FilterPill>)
    expect(getByRole("button").textContent).toContain("Child")
  })

  it("children take priority over text when both are provided", () => {
    const { getByRole } = render(
      <FilterPill active={false} text="text prop">
        children content
      </FilterPill>
    )
    const btn = getByRole("button")
    expect(btn.textContent).toContain("children content")
    expect(btn.textContent).not.toContain("text prop")
  })
})

// ---------------------------------------------------------------------------
// active prop: aria-pressed and active styles
// ---------------------------------------------------------------------------

describe("FilterPill active prop", () => {
  it("sets aria-pressed='true' when active=true", () => {
    const { getByRole } = render(<FilterPill active={true} text="Active" />)
    expect(getByRole("button").getAttribute("aria-pressed")).toBe("true")
  })

  it("sets aria-pressed='false' when active=false", () => {
    const { getByRole } = render(<FilterPill active={false} text="Inactive" />)
    expect(getByRole("button").getAttribute("aria-pressed")).toBe("false")
  })

  it("applies nm-raised-sm when active=true", () => {
    const { getByRole } = render(<FilterPill active={true} text="Active" />)
    expect(getByRole("button").className).toContain("nm-raised-sm")
  })

  it("applies font-semibold when active=true", () => {
    const { getByRole } = render(<FilterPill active={true} text="Active" />)
    expect(getByRole("button").className).toContain("font-semibold")
  })

  it("does not apply nm-raised-sm when active=false", () => {
    const { getByRole } = render(<FilterPill active={false} text="Inactive" />)
    expect(getByRole("button").className).not.toContain("nm-raised-sm")
  })

  it("does not apply font-semibold when active=false", () => {
    const { getByRole } = render(<FilterPill active={false} text="Inactive" />)
    expect(getByRole("button").className).not.toContain("font-semibold")
  })
})

// ---------------------------------------------------------------------------
// inactive variants
// ---------------------------------------------------------------------------

describe("FilterPill inactive='transparent' (default)", () => {
  it("applies bg-transparent when active=false and no inactive prop", () => {
    const { getByRole } = render(<FilterPill active={false} text="Label" />)
    expect(getByRole("button").className).toContain("bg-transparent")
  })

  it("applies text-muted when active=false and no inactive prop", () => {
    const { getByRole } = render(<FilterPill active={false} text="Label" />)
    expect(getByRole("button").className).toContain("text-muted")
  })

  it("applies bg-transparent when inactive='transparent' explicitly", () => {
    const { getByRole } = render(<FilterPill active={false} inactive="transparent" text="Label" />)
    expect(getByRole("button").className).toContain("bg-transparent")
  })
})

describe("FilterPill inactive='strikethrough'", () => {
  it("applies line-through when inactive='strikethrough' and active=false", () => {
    const { getByRole } = render(
      <FilterPill active={false} inactive="strikethrough" text="Label" />
    )
    expect(getByRole("button").className).toContain("line-through")
  })

  it("applies opacity-50 when inactive='strikethrough' and active=false", () => {
    const { getByRole } = render(
      <FilterPill active={false} inactive="strikethrough" text="Label" />
    )
    expect(getByRole("button").className).toContain("opacity-50")
  })
})

describe("FilterPill inactive='inset'", () => {
  it("applies nm-inset-sm when inactive='inset' and active=false", () => {
    const { getByRole } = render(<FilterPill active={false} inactive="inset" text="Label" />)
    expect(getByRole("button").className).toContain("nm-inset-sm")
  })
})

// ---------------------------------------------------------------------------
// inactive styles are NOT applied when active=true
// ---------------------------------------------------------------------------

describe("FilterPill inactive styles suppressed when active=true", () => {
  it("does not apply line-through when active=true despite inactive='strikethrough'", () => {
    const { getByRole } = render(<FilterPill active={true} inactive="strikethrough" text="Label" />)
    expect(getByRole("button").className).not.toContain("line-through")
  })

  it("does not apply nm-inset-sm when active=true despite inactive='inset'", () => {
    const { getByRole } = render(<FilterPill active={true} inactive="inset" text="Label" />)
    expect(getByRole("button").className).not.toContain("nm-inset-sm")
  })
})

// ---------------------------------------------------------------------------
// size prop
// ---------------------------------------------------------------------------

describe("FilterPill size prop", () => {
  it("applies text-xs when size='md' (default)", () => {
    const { getByRole } = render(<FilterPill active={false} text="Label" />)
    expect(getByRole("button").className).toContain("text-xs")
  })

  it("applies text-2xs when size='sm'", () => {
    const { getByRole } = render(<FilterPill active={false} size="sm" text="Label" />)
    expect(getByRole("button").className).toContain("text-2xs")
  })

  it("does not apply text-2xs for default (md) size", () => {
    const { getByRole } = render(<FilterPill active={false} text="Label" />)
    expect(getByRole("button").className).not.toContain("text-2xs")
  })
})

// ---------------------------------------------------------------------------
// activeColor prop
// ---------------------------------------------------------------------------

describe("FilterPill activeColor prop", () => {
  it("applies the activeColor class when active=true", () => {
    const { getByRole } = render(
      <FilterPill active={true} activeColor="text-accent" text="Label" />
    )
    expect(getByRole("button").className).toContain("text-accent")
  })

  it("uses default activeColor 'text-primary' when not specified and active=true", () => {
    const { getByRole } = render(<FilterPill active={true} text="Label" />)
    expect(getByRole("button").className).toContain("text-primary")
  })

  it("does not apply activeColor when active=false", () => {
    const { getByRole } = render(
      <FilterPill active={false} activeColor="text-accent" text="Label" />
    )
    expect(getByRole("button").className).not.toContain("text-accent")
  })
})

// ---------------------------------------------------------------------------
// disabled prop
// ---------------------------------------------------------------------------

describe("FilterPill disabled prop", () => {
  it("is not disabled by default", () => {
    const { getByRole } = render(<FilterPill active={false} text="Label" />)
    expect((getByRole("button") as HTMLButtonElement).disabled).toBe(false)
  })

  it("disables the button when disabled=true", () => {
    const { getByRole } = render(<FilterPill active={false} disabled text="Label" />)
    expect((getByRole("button") as HTMLButtonElement).disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// onClick handler
// ---------------------------------------------------------------------------

describe("FilterPill onClick", () => {
  it("fires onClick when clicked", async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    const { getByRole } = render(<FilterPill active={false} onClick={handler} text="Click me" />)
    await user.click(getByRole("button"))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    const { getByRole } = render(
      <FilterPill active={false} disabled onClick={handler} text="Click me" />
    )
    await user.click(getByRole("button"))
    expect(handler).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// always type="button"
// ---------------------------------------------------------------------------

describe("FilterPill type attribute", () => {
  it("always has type='button'", () => {
    const { getByRole } = render(<FilterPill active={false} text="Label" />)
    expect(getByRole("button").getAttribute("type")).toBe("button")
  })
})

// ---------------------------------------------------------------------------
// className is appended
// ---------------------------------------------------------------------------

describe("FilterPill className prop", () => {
  it("appends custom className alongside base classes", () => {
    const { getByRole } = render(
      <FilterPill active={false} className="my-custom-class" text="Label" />
    )
    const cls = getByRole("button").className
    expect(cls).toContain("my-custom-class")
    expect(cls).toContain("font-mono")
  })
})
