// src/components/tracker-detail/platform/__tests__/V3xLevelProgress.test.tsx

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { V3xLevelProgress } from "@/components/tracker-detail/platform/V3xLevelProgress"

describe("V3xLevelProgress", () => {
  // Level 14 starts at 23 920 XP and level 15 at 28 168, so 28 020 is 4 100 of 4 248.
  it("shows the XP through the current level and what is left to the next", () => {
    render(<V3xLevelProgress level={14} xp={28020} prestige={0} accentColor="#00d4ff" />)

    expect(screen.getByText("Second rôle N14")).toBeInTheDocument()
    expect(screen.getByText("4,100 / 4,248 XP")).toBeInTheDocument()
    expect(screen.getByText("148 XP to Second rôle N15")).toBeInTheDocument()
  })

  it("names the next rank at a rank's last level", () => {
    render(<V3xLevelProgress level={9} xp={10000} prestige={0} accentColor="#00d4ff" />)

    expect(screen.getByText("Second rôle N10")).toBeInTheDocument()
  })

  it("shows the top level full, with the prestige stars", () => {
    render(<V3xLevelProgress level={100} xp={9_000_000} prestige={2} accentColor="#00d4ff" />)

    expect(screen.getByText("Palme d'Or N100 ★★")).toBeInTheDocument()
    expect(screen.getByText("Top level, prestige available")).toBeInTheDocument()
  })
})
