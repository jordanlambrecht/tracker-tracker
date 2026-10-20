// src/components/tracker-detail/__tests__/RankTooltip.test.tsx
//
// The tooltip lists every registry class, so a class that is not a rung of the
// earned ladder has to read differently from one that is, the same as the pills.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { RankTooltip } from "@/components/tracker-detail/RankTooltip"
import type { TrackerUserClass } from "@/data/tracker-registry"

const classes: TrackerUserClass[] = [
  { name: "Leech", requirements: "Ratio below 0.4", outsideLadder: "below" },
  { name: "User", requirements: "Ratio at or above 0.4" },
  { name: "Power User", requirements: "1 TiB uploaded" },
  { name: "Uploader", requirements: "Staff", outsideLadder: "above" },
]

describe("RankTooltip rows", () => {
  it("dims classes outside the ladder and says why on hover", async () => {
    const user = userEvent.setup()
    render(<RankTooltip currentRank="User" userClasses={classes} accentColor="#00d4ff" />)
    await user.hover(screen.getByText("User"))

    const tooltip = within(screen.getByRole("tooltip"))
    const row = (name: string) => tooltip.getByText(name).closest("div")
    expect(row("Leech")).toHaveClass("opacity-60")
    expect(row("Leech")).toHaveAttribute(
      "title",
      "Demotion or administrative state, not a rung of the ladder"
    )
    expect(row("Uploader")).toHaveClass("opacity-60")
    expect(row("Uploader")).toHaveAttribute(
      "title",
      "Granted by staff, donation or invitation, not a rung of the ladder"
    )
    expect(row("Power User")).not.toHaveClass("opacity-60")
    expect(row("Power User")).not.toHaveAttribute("title")
  })
})
