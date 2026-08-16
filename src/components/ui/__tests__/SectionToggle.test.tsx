// src/components/ui/__tests__/SectionToggle.test.tsx
//
// SectionToggle drives every collapsible dashboard section. It had no coverage at
// all, which is how both of these regressed unnoticed:
//   1. the sections' <h2>s were replaced by bare <button>s, so the page kept an H1
//      and a set of orphaned subordinate headings under no parent;
//   2. the button never exposed aria-expanded, so assistive tech could not tell a
//      collapsed section from an expanded one.
//
// The two assertions are deliberately independent: reverting the <h2> wrapper
// reddens the heading test alone, reverting aria-expanded reddens the other alone.

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SectionToggle } from "@/components/ui/SectionToggle"

describe("SectionToggle", () => {
  it("renders the label as a level-2 heading so the page keeps its outline", () => {
    render(<SectionToggle label="Trackers" expanded onToggle={() => {}} />)

    expect(screen.getByRole("heading", { level: 2, name: /Trackers/ })).toBeInTheDocument()
  })

  it("reports its expanded state to assistive tech", () => {
    const { rerender } = render(<SectionToggle label="Trackers" expanded onToggle={() => {}} />)
    expect(screen.getByRole("button", { name: /Trackers/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    )

    rerender(<SectionToggle label="Trackers" expanded={false} onToggle={() => {}} />)
    expect(screen.getByRole("button", { name: /Trackers/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })

  it("still works as a control", async () => {
    const onToggle = vi.fn()
    render(<SectionToggle label="Trackers" expanded onToggle={onToggle} />)

    screen.getByRole("button", { name: /Trackers/ }).click()

    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
