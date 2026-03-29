// src/components/ui/__tests__/ProgressBar.test.tsx

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProgressBar } from "@/components/ui/ProgressBar"

// ---------------------------------------------------------------------------
// aria attributes
// ---------------------------------------------------------------------------

describe("ProgressBar aria attributes", () => {
  it("renders an element with role='progressbar'", () => {
    const { getByRole } = render(<ProgressBar percent={50} />)
    expect(getByRole("progressbar")).toBeDefined()
  })

  it("sets aria-valuenow to the clamped percent value", () => {
    const { getByRole } = render(<ProgressBar percent={75} />)
    const bar = getByRole("progressbar")
    expect(bar.getAttribute("aria-valuenow")).toBe("75")
  })

  it("sets aria-valuemin to 0", () => {
    const { getByRole } = render(<ProgressBar percent={50} />)
    expect(getByRole("progressbar").getAttribute("aria-valuemin")).toBe("0")
  })

  it("sets aria-valuemax to 100", () => {
    const { getByRole } = render(<ProgressBar percent={50} />)
    expect(getByRole("progressbar").getAttribute("aria-valuemax")).toBe("100")
  })
})

// ---------------------------------------------------------------------------
// width computation
// ---------------------------------------------------------------------------

describe("ProgressBar fill width", () => {
  it("at 50% the fill has width 50%", () => {
    const { getByRole } = render(<ProgressBar percent={50} />)
    const bar = getByRole("progressbar")
    expect(bar.style.width).toBe("50%")
  })

  it("at 100% the fill has width 100%", () => {
    const { getByRole } = render(<ProgressBar percent={100} />)
    const bar = getByRole("progressbar")
    expect(bar.style.width).toBe("100%")
  })

  it("at 0% the fill has width 0% and aria-valuenow is 0", () => {
    const { getByRole } = render(<ProgressBar percent={0} />)
    const bar = getByRole("progressbar")
    expect(bar.style.width).toBe("0%")
    expect(bar.getAttribute("aria-valuenow")).toBe("0")
  })

  it("at 0% the fill element has the 'invisible' class applied", () => {
    const { getByRole } = render(<ProgressBar percent={0} />)
    const bar = getByRole("progressbar")
    expect(bar.className).toContain("invisible")
  })

  it("at 50% the fill element does NOT have the 'invisible' class", () => {
    const { getByRole } = render(<ProgressBar percent={50} />)
    const bar = getByRole("progressbar")
    expect(bar.className).not.toContain("invisible")
  })
})

// ---------------------------------------------------------------------------
// clamping
// ---------------------------------------------------------------------------

describe("ProgressBar clamping", () => {
  it("negative values are clamped to 0", () => {
    const { getByRole } = render(<ProgressBar percent={-10} />)
    const bar = getByRole("progressbar")
    expect(bar.getAttribute("aria-valuenow")).toBe("0")
    expect(bar.style.width).toBe("0%")
  })

  it("values over 100 are clamped to 100", () => {
    const { getByRole } = render(<ProgressBar percent={150} />)
    const bar = getByRole("progressbar")
    expect(bar.getAttribute("aria-valuenow")).toBe("100")
    expect(bar.style.width).toBe("100%")
  })

  it("aria-valuenow reflects the clamped value, not the raw input", () => {
    const { getByRole } = render(<ProgressBar percent={-999} />)
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0")
  })

  it("exactly 0 is not clamped further", () => {
    const { getByRole } = render(<ProgressBar percent={0} />)
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0")
  })

  it("exactly 100 is not clamped further", () => {
    const { getByRole } = render(<ProgressBar percent={100} />)
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100")
  })
})

// ---------------------------------------------------------------------------
// color prop
// ---------------------------------------------------------------------------

describe("ProgressBar color prop", () => {
  it("applies custom color to the fill's backgroundColor", () => {
    const { getByRole } = render(<ProgressBar percent={50} color="#ff0000" />)
    const bar = getByRole("progressbar")
    expect(bar.style.backgroundColor).toBe("rgb(255, 0, 0)")
  })

  it("uses var(--color-accent) when no color prop is provided", () => {
    const { getByRole } = render(<ProgressBar percent={50} />)
    const bar = getByRole("progressbar")
    // jsdom renders CSS variable references as-is in the style attribute
    expect(bar.style.backgroundColor).toBe("var(--color-accent)")
  })

  it("applies a CSS variable as color", () => {
    const { getByRole } = render(<ProgressBar percent={50} color="var(--color-warn)" />)
    const bar = getByRole("progressbar")
    expect(bar.style.backgroundColor).toBe("var(--color-warn)")
  })
})

// ---------------------------------------------------------------------------
// glow / drop-shadow filter
// ---------------------------------------------------------------------------

describe("ProgressBar glow", () => {
  it("applies drop-shadow filter when percent > 0", () => {
    const { getByRole } = render(<ProgressBar percent={50} color="#00d4ff" />)
    const bar = getByRole("progressbar")
    expect(bar.style.filter).toContain("drop-shadow")
  })

  it("does not apply filter when percent is 0 (fill invisible)", () => {
    const { getByRole } = render(<ProgressBar percent={0} color="#00d4ff" />)
    const bar = getByRole("progressbar")
    expect(bar.style.filter).toBe("")
  })
})

// ---------------------------------------------------------------------------
// showLabel
// ---------------------------------------------------------------------------

describe("ProgressBar showLabel prop", () => {
  it("does not render label by default", () => {
    const { queryByText } = render(<ProgressBar percent={50} />)
    expect(queryByText("50%")).toBeNull()
  })

  it("does not render label on lg size when percent <= 10", () => {
    const { queryByText } = render(<ProgressBar percent={10} size="lg" showLabel />)
    expect(queryByText("10%")).toBeNull()
  })

  it("renders label text on lg size when percent > 10 and showLabel is true", () => {
    const { getByText } = render(<ProgressBar percent={50} size="lg" showLabel />)
    expect(getByText("50%")).toBeDefined()
  })

  it("does not render label on md size even when showLabel is true", () => {
    const { queryByText } = render(<ProgressBar percent={50} size="md" showLabel />)
    expect(queryByText("50%")).toBeNull()
  })

  it("rounds the percent label to the nearest integer", () => {
    const { getByText } = render(<ProgressBar percent={50.7} size="lg" showLabel />)
    expect(getByText("51%")).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// animated prop
// ---------------------------------------------------------------------------

describe("ProgressBar animated prop", () => {
  it("includes transition class by default", () => {
    const { getByRole } = render(<ProgressBar percent={50} />)
    const bar = getByRole("progressbar")
    expect(bar.className).toContain("transition-all")
  })

  it("omits transition class when animated=false", () => {
    const { getByRole } = render(<ProgressBar percent={50} animated={false} />)
    const bar = getByRole("progressbar")
    expect(bar.className).not.toContain("transition-all")
  })
})
