// src/components/dashboard/__tests__/RankProgress.test.tsx
//
// The detail page's rank pills show the whole registry list, so classes that
// are not rungs of the earned ladder have to read differently from the ones
// that are, and the shared matcher has to keep finding the current class.

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RankProgress } from "@/components/dashboard/RankProgress"
import type { TrackerUserClass } from "@/data/tracker-registry"

const classes: TrackerUserClass[] = [
  { name: "Leech", requirements: "Ratio below 0.4", outsideLadder: "below" },
  { name: "User", requirements: "Ratio at or above 0.4" },
  { name: "Power User", requirements: "1 TiB uploaded" },
  { name: "Uploader", requirements: "Staff", outsideLadder: "above" },
]

function renderPills(currentRank: string) {
  return render(
    <RankProgress
      userClasses={classes}
      currentRank={currentRank}
      snapshots={[]}
      accentColor="#00d4ff"
    />
  )
}

describe("RankProgress pills", () => {
  it("dims classes outside the ladder and says why on hover", () => {
    renderPills("User")
    expect(screen.getByText("Leech")).toHaveClass("opacity-60")
    expect(screen.getByText("Leech")).toHaveAttribute(
      "title",
      "Demotion or administrative state, not a rung of the ladder"
    )
    expect(screen.getByText("Uploader")).toHaveClass("opacity-60")
    expect(screen.getByText("Uploader")).toHaveAttribute(
      "title",
      "Granted by staff, donation or invitation, not a rung of the ladder"
    )
    expect(screen.getByText("User")).not.toHaveClass("opacity-60")
    expect(screen.getByText("Power User")).not.toHaveAttribute("title")
  })

  it("still highlights the current class through the case-insensitive matcher", () => {
    renderPills("power user")
    expect(screen.getByText("Power User")).toHaveStyle({ fontWeight: 600 })
    expect(screen.getByText("User")).not.toHaveStyle({ fontWeight: 600 })
  })

  it("highlights a current class even when it sits outside the ladder", () => {
    renderPills("Uploader")
    expect(screen.getByText("Uploader")).toHaveStyle({ fontWeight: 600 })
  })
})
