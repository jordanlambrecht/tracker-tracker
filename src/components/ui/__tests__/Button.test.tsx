// src/components/ui/__tests__/Button.test.tsx

import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Button } from "@/components/ui/Button"

// ---------------------------------------------------------------------------
// default type attribute
// ---------------------------------------------------------------------------

describe("Button type attribute", () => {
  it("defaults to type='button'", () => {
    const { getByRole } = render(<Button>Click</Button>)
    expect(getByRole("button").getAttribute("type")).toBe("button")
  })

  it("can be explicitly set to type='submit'", () => {
    const { getByRole } = render(<Button type="submit">Submit</Button>)
    expect(getByRole("button").getAttribute("type")).toBe("submit")
  })

  it("can be explicitly set to type='reset'", () => {
    const { getByRole } = render(<Button type="reset">Reset</Button>)
    expect(getByRole("button").getAttribute("type")).toBe("reset")
  })
})

// ---------------------------------------------------------------------------
// text prop and children priority
// ---------------------------------------------------------------------------

describe("Button text prop and children", () => {
  it("renders the text prop as content when no children provided", () => {
    const { getByRole } = render(<Button text="Save changes" />)
    expect(getByRole("button").textContent).toContain("Save changes")
  })

  it("renders children when provided and no text prop", () => {
    const { getByRole } = render(<Button>Child content</Button>)
    expect(getByRole("button").textContent).toContain("Child content")
  })

  it("children take priority over text when both are provided", () => {
    const { getByRole } = render(<Button text="text prop">children content</Button>)
    const btn = getByRole("button")
    expect(btn.textContent).toContain("children content")
    expect(btn.textContent).not.toContain("text prop")
  })
})

// ---------------------------------------------------------------------------
// icon props
// ---------------------------------------------------------------------------

describe("Button icon props", () => {
  it("renders leftIcon before content", () => {
    const { getByRole, getByTestId } = render(
      <Button leftIcon={<span data-testid="left-icon">L</span>}>Label</Button>
    )
    const btn = getByRole("button")
    const icon = getByTestId("left-icon")
    const label = btn.lastChild as ChildNode
    // icon node should come before the text node
    expect(btn.contains(icon)).toBe(true)
    expect(btn.firstChild).toBe(icon)
    expect(label.textContent).toBe("Label")
  })

  it("renders rightIcon after content", () => {
    const { getByRole, getByTestId } = render(
      <Button rightIcon={<span data-testid="right-icon">R</span>}>Label</Button>
    )
    const btn = getByRole("button")
    const icon = getByTestId("right-icon")
    expect(btn.contains(icon)).toBe(true)
    expect(btn.lastChild).toBe(icon)
  })

  it("renders both leftIcon and rightIcon simultaneously", () => {
    const { getByTestId } = render(
      <Button
        leftIcon={<span data-testid="left-icon">L</span>}
        rightIcon={<span data-testid="right-icon">R</span>}
      >
        Label
      </Button>
    )
    expect(getByTestId("left-icon")).toBeDefined()
    expect(getByTestId("right-icon")).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// loading state
// ---------------------------------------------------------------------------

describe("Button loading prop", () => {
  it("disables the button when loading=true", () => {
    const { getByRole } = render(<Button loading>Saving</Button>)
    expect((getByRole("button") as HTMLButtonElement).disabled).toBe(true)
  })

  it("sets aria-busy='true' when loading=true", () => {
    const { getByRole } = render(<Button loading>Saving</Button>)
    expect(getByRole("button").getAttribute("aria-busy")).toBe("true")
  })

  it("does not set aria-busy when loading=false", () => {
    const { getByRole } = render(<Button>Idle</Button>)
    expect(getByRole("button").getAttribute("aria-busy")).toBeNull()
  })

  it("shows SpinnerIcon (svg) when loading=true", () => {
    const { getByRole } = render(<Button loading>Saving</Button>)
    const btn = getByRole("button")
    const svg = btn.querySelector("svg")
    expect(svg).not.toBeNull()
  })

  it("replaces leftIcon with SpinnerIcon when loading=true", () => {
    const { getByRole, queryByTestId } = render(
      <Button loading leftIcon={<span data-testid="left-icon">L</span>}>
        Saving
      </Button>
    )
    const btn = getByRole("button")
    const svg = btn.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(queryByTestId("left-icon")).toBeNull()
  })

  it("SpinnerIcon has animate-spin class when loading=true", () => {
    const { getByRole } = render(<Button loading>Saving</Button>)
    const svg = getByRole("button").querySelector("svg")
    // SVG elements expose className as SVGAnimatedString; read via getAttribute
    expect(svg?.getAttribute("class")).toContain("animate-spin")
  })
})

// ---------------------------------------------------------------------------
// size="icon"
// ---------------------------------------------------------------------------

describe("Button size='icon'", () => {
  it("applies p-1.5 when size='icon'", () => {
    const { getByRole } = render(<Button size="icon">i</Button>)
    expect(getByRole("button").className).toContain("p-1.5")
  })

  it("applies rounded-nm-sm when size='icon'", () => {
    const { getByRole } = render(<Button size="icon">i</Button>)
    expect(getByRole("button").className).toContain("rounded-nm-sm")
  })
})

// ---------------------------------------------------------------------------
// variants
// ---------------------------------------------------------------------------

describe("Button variants render without error", () => {
  const variants = ["primary", "secondary", "ghost", "danger", "minimal"] as const

  for (const variant of variants) {
    it(`renders variant='${variant}'`, () => {
      const { getByRole } = render(<Button variant={variant}>Label</Button>)
      expect(getByRole("button")).toBeDefined()
    })
  }
})

// ---------------------------------------------------------------------------
// disabled prop
// ---------------------------------------------------------------------------

describe("Button disabled prop", () => {
  it("is not disabled by default", () => {
    const { getByRole } = render(<Button>Click</Button>)
    expect((getByRole("button") as HTMLButtonElement).disabled).toBe(false)
  })

  it("disables the button when disabled=true", () => {
    const { getByRole } = render(<Button disabled>Click</Button>)
    expect((getByRole("button") as HTMLButtonElement).disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// onClick handler
// ---------------------------------------------------------------------------

describe("Button onClick", () => {
  it("fires onClick when clicked", async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    const { getByRole } = render(<Button onClick={handler}>Click</Button>)
    await user.click(getByRole("button"))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    const { getByRole } = render(
      <Button disabled onClick={handler}>
        Click
      </Button>
    )
    await user.click(getByRole("button"))
    expect(handler).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// className is appended (not overriding base classes)
// ---------------------------------------------------------------------------

describe("Button className prop", () => {
  it("appends the custom className alongside base classes", () => {
    const { getByRole } = render(<Button className="my-custom-class">Click</Button>)
    const cls = getByRole("button").className
    expect(cls).toContain("my-custom-class")
    // base classes from CVA should still be present
    expect(cls).toContain("inline-flex")
  })

  it("base classes remain when className is provided", () => {
    const { getByRole } = render(<Button className="override-attempt">Click</Button>)
    const cls = getByRole("button").className
    expect(cls).toContain("items-center")
    expect(cls).toContain("justify-center")
  })
})
