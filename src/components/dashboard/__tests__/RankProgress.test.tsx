// src/components/dashboard/__tests__/RankProgress.test.tsx
//
// The detail page's rank pills show the whole registry list, so classes that
// are not rungs of the earned ladder have to read differently from the ones
// that are, and the shared matcher has to keep finding the current class.
// The timeline arrows follow ladder position rather than list order, and a move
// into or out of an above class gets neither arrow.

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RankProgress } from "@/components/dashboard/RankProgress"
import type { TrackerUserClass } from "@/data/tracker-registry"
import { v3xClassLevel, v3xUserClasses } from "@/data/v3x-levels"
import type { Snapshot } from "@/types/api"

const classes: TrackerUserClass[] = [
  { name: "Leech", requirements: "Ratio below 0.4", outsideLadder: "below" },
  { name: "User", requirements: "Ratio at or above 0.4" },
  { name: "Power User", requirements: "1 TiB uploaded" },
  { name: "Uploader", requirements: "Staff", outsideLadder: "above" },
]

// Shaped like Upload.cx, which lists its Parked below state after the top rung,
// so list order alone would read Archivist to Parked as a climb.
const uploadcx: TrackerUserClass[] = [
  { name: "Leech", requirements: "Ratio below 0.6", outsideLadder: "below" },
  { name: "User", requirements: "Ratio at or above 0.6" },
  { name: "Member", requirements: "1 TiB up" },
  { name: "Archivist", requirements: "10 TiB seeded" },
  { name: "Parked", requirements: "Staff-assigned", outsideLadder: "below" },
  { name: "Uploader", requirements: "Staff", outsideLadder: "above" },
  { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
]

const baseSnapshot: Snapshot = {
  polledAt: "2026-08-13T12:00:00.000Z",
  ratio: null,
  ratioIsInfinite: false,
  uploadedBytes: "0",
  downloadedBytes: "0",
  bufferBytes: "0",
  seedingCount: null,
  leechingCount: null,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  hitAndRuns: null,
  seedbonus: null,
  shareScore: null,
  username: null,
  group: null,
  isManual: false,
}

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

  it("styles no rung as past for a member in a below state", () => {
    render(
      <RankProgress
        userClasses={uploadcx}
        currentRank="Parked"
        snapshots={[]}
        accentColor="#00d4ff"
      />
    )
    for (const rung of ["User", "Member", "Archivist"]) {
      expect(screen.getByText(rung)).not.toHaveStyle({
        backgroundColor: "rgba(0, 212, 255, 0.06)",
      })
    }
  })

  it("styles a class outside the ladder as neither past nor future", () => {
    renderPills("Power User")
    const leech = screen.getByText("Leech")
    expect(leech).not.toHaveStyle({ backgroundColor: "rgba(0, 212, 255, 0.06)" })
    expect(leech).not.toHaveStyle({ borderStyle: "dashed" })
    expect(leech).toHaveStyle({ color: "rgb(148, 163, 184)" })
  })
})

function renderChange(from: string, to: string) {
  return render(
    <RankProgress
      userClasses={uploadcx}
      currentRank={null}
      snapshots={[
        { ...baseSnapshot, group: from },
        { ...baseSnapshot, polledAt: "2026-08-14T12:00:00.000Z", group: to },
      ]}
      accentColor="#00d4ff"
    />
  )
}

describe("RankProgress timeline direction", () => {
  it("reads a drop from the top rung into a below state as a demotion", () => {
    renderChange("Archivist", "Parked")
    expect(screen.getByText("▼")).toBeInTheDocument()
    expect(screen.queryByText("▲")).not.toBeInTheDocument()
  })

  it("reads a drop from the first rung into a below state as a demotion", () => {
    renderChange("User", "Leech")
    expect(screen.getByText("▼")).toBeInTheDocument()
    expect(screen.queryByText("▲")).not.toBeInTheDocument()
  })

  it("reads a move between two above classes as neither promotion nor demotion", () => {
    renderChange("Uploader", "Moderator")
    expect(screen.getByText("Moderator")).toBeInTheDocument()
    expect(screen.queryByText("▲")).not.toBeInTheDocument()
    expect(screen.queryByText("▼")).not.toBeInTheDocument()
  })

  it("reads a move from a rung into an above class as neither promotion nor demotion", () => {
    renderChange("Member", "Uploader")
    expect(screen.getByText("Uploader")).toBeInTheDocument()
    expect(screen.queryByText("▲")).not.toBeInTheDocument()
    expect(screen.queryByText("▼")).not.toBeInTheDocument()
  })

  it("reads a move from an above class down to a rung as neither promotion nor demotion", () => {
    renderChange("Uploader", "Member")
    expect(screen.getByText("Member")).toBeInTheDocument()
    expect(screen.queryByText("▲")).not.toBeInTheDocument()
    expect(screen.queryByText("▼")).not.toBeInTheDocument()
  })
})

// V3X names a level inside each rank, so a level-up within a rank is a promotion.
describe("RankProgress with levels inside ranks", () => {
  function renderLevels(from: string, to: string, currentRank: string | null = null) {
    return render(
      <RankProgress
        userClasses={v3xUserClasses()}
        currentRank={currentRank}
        classLevel={v3xClassLevel}
        snapshots={[
          { ...baseSnapshot, group: from },
          { ...baseSnapshot, polledAt: "2026-08-14T12:00:00.000Z", group: to },
        ]}
        accentColor="#00d4ff"
      />
    )
  }

  it("reads a level-up inside a rank as a promotion", () => {
    renderLevels("Figurant N4", "Figurant N5")
    expect(screen.getByText("▲")).toBeInTheDocument()
  })

  it("reads a prestige restart as a demotion", () => {
    renderLevels("Palme d'Or N100", "Figurant N1")
    expect(screen.getByText("▼")).toBeInTheDocument()
  })

  it("lists the five ranks and highlights the one the level is in", () => {
    renderLevels("Second rôle N13", "Second rôle N14", "Second rôle N14")
    expect(screen.getByText("Tête d'affiche")).toBeInTheDocument()
    expect(screen.queryByText("Figurant N1")).not.toBeInTheDocument()
  })
})
