// src/components/tracker-detail/platform/__tests__/RutrackerRareUpload.test.tsx

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  RutrackerRareUpload,
  TOP_BONUS_LEVELS,
  topBonusProgress,
} from "@/components/tracker-detail/platform/RutrackerRareUpload"

const GiB = 2 ** 30
const TiB = 2 ** 40

describe("topBonusProgress", () => {
  it("counts toward the entry threshold below it", () => {
    expect(topBonusProgress(150 * GiB)).toEqual({
      level: 0,
      nextThreshold: 300 * GiB,
      percent: 50,
    })
  })

  it("measures progress between the reached level and the next", () => {
    // 3 TB reaches level 04; level 05 starts at 10 TB.
    const progress = topBonusProgress(6.5 * TiB)
    expect(progress.level).toBe(4)
    expect(progress.nextThreshold).toBe(10 * TiB)
    expect(progress.percent).toBeCloseTo(50)
  })

  it("counts a threshold as reached", () => {
    expect(topBonusProgress(300 * GiB).level).toBe(1)
  })

  it("stops at the last level", () => {
    expect(topBonusProgress(TOP_BONUS_LEVELS[10] * 2)).toEqual({
      level: 11,
      nextThreshold: null,
      percent: 100,
    })
  })
})

describe("RutrackerRareUpload", () => {
  it("shows the next level and the one reached", () => {
    render(<RutrackerRareUpload meta={{ rareUploadedBytes: 5 * TiB }} accentColor="#4a76a8" />)
    expect(screen.getByText("Top Bonus 05")).toBeTruthy()
    expect(screen.getByText("Top Bonus 04 reached")).toBeTruthy()
  })
})
