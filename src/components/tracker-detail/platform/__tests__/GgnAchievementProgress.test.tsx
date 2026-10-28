// src/components/tracker-detail/platform/__tests__/GgnAchievementProgress.test.tsx

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { GgnAchievementProgress } from "@/components/tracker-detail/platform/GgnAchievementProgress"
import type { GGnPlatformMeta } from "@/types/api"

const meta = (totalPoints: number, pointsToNextLvl: number) =>
  ({
    achievements: { userLevel: "Amateur", nextLevel: "Gamer", totalPoints, pointsToNextLvl },
  }) as GGnPlatformMeta

describe("GgnAchievementProgress", () => {
  it("reads totalPoints as the points earned, out of earned plus remaining", () => {
    render(<GgnAchievementProgress ggMeta={meta(150, 450)} accentColor="#00d4ff" />)

    expect(screen.getByText("150 / 600 pts")).toBeInTheDocument()
    expect(screen.getByText("450 pts to Gamer")).toBeInTheDocument()
  })

  it("renders nothing without achievements", () => {
    const { container } = render(
      <GgnAchievementProgress ggMeta={{} as GGnPlatformMeta} accentColor="#00d4ff" />
    )

    expect(container).toBeEmptyDOMElement()
  })
})
